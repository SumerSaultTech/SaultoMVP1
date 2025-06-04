import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, Calendar, BarChart3, RefreshCw, Star } from "lucide-react";
import MetricProgressChart from "./metric-progress-chart";

interface MetricsOverviewProps {
  onRefresh: () => void;
}

interface DashboardMetricData {
  metricId: number;
  currentValue: number;
  yearlyGoal: number;
  format: string;
  timeSeriesData: {
    weekly: Array<{ period: string; actual: number; goal: number }>;
    monthly: Array<{ period: string; actual: number; goal: number }>;
    quarterly: Array<{ period: string; actual: number; goal: number }>;
    ytd: Array<{ period: string; actual: number; goal: number }>;
  };
}

export default function MetricsOverview({ onRefresh }: MetricsOverviewProps) {
  const [selectedTimePeriod, setSelectedTimePeriod] = useState("ytd");

  const { data: metrics = [], isLoading: metricsLoading, refetch: refetchMetrics } = useQuery({
    queryKey: ['/api/kpi-metrics'],
  });

  const { data: dashboardMetrics = [], isLoading: dashboardLoading, refetch: refetchDashboard } = useQuery({
    queryKey: ['/api/dashboard/metrics-data'],
  });

  const isLoading = metricsLoading || dashboardLoading;

  const handleRefresh = () => {
    refetchMetrics();
    refetchDashboard();
    onRefresh();
  };

  const formatValue = (value: number | string, format: string) => {
    const numValue = typeof value === 'string' ? parseFloat(value.replace(/[$,%]/g, '')) : value;
    
    if (format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(numValue);
    }
    
    if (format === 'percentage') {
      return `${numValue.toFixed(1)}%`;
    }
    
    return numValue.toLocaleString();
  };

  const getChangeIcon = (changePercent: string) => {
    const change = parseFloat(changePercent?.replace(/[+%]/g, '') || '0');
    return change >= 0 ? (
      <TrendingUp className="w-4 h-4 text-green-500" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-500" />
    );
  };

  const getChangeColor = (changePercent: string) => {
    const change = parseFloat(changePercent?.replace(/[+%]/g, '') || '0');
    return change >= 0 ? 'text-green-600' : 'text-red-600';
  };

  // Create a map of dashboard data by metric ID for easy lookup
  const dashboardDataMap = dashboardMetrics.reduce((acc, data: DashboardMetricData) => {
    acc[data.metricId] = data;
    return acc;
  }, {} as Record<number, DashboardMetricData>);

  // Filter metrics that have corresponding dashboard data
  const metricsWithData = metrics.filter(metric => dashboardDataMap[metric.id]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Business Metrics</h2>
          <Button variant="outline" size="sm" disabled>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-2 bg-gray-200 rounded w-full"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (metricsWithData.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Business Metrics</h2>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
        <Card className="border-dashed border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-gray-100 p-3 mb-4">
              <BarChart3 className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Metrics Available</h3>
            <p className="text-gray-600 mb-4">Configure your first business metric to start tracking performance.</p>
            <Button onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Sort metrics so North Star appears first
  const sortedMetrics = [...metricsWithData].sort((a, b) => {
    if (a.isNorthStar && !b.isNorthStar) return -1;
    if (!a.isNorthStar && b.isNorthStar) return 1;
    return a.priority - b.priority;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Business Metrics</h2>
        <div className="flex items-center gap-2">
          <Tabs value={selectedTimePeriod} onValueChange={setSelectedTimePeriod}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
              <TabsTrigger value="ytd">YTD</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {sortedMetrics.map((metric) => {
          const dashboardData = dashboardDataMap[metric.id];
          if (!dashboardData) return null;

          const currentValue = dashboardData.currentValue;
          const yearlyGoal = dashboardData.yearlyGoal;
          const progress = yearlyGoal > 0 ? Math.min((currentValue / yearlyGoal) * 100, 100) : 0;

          return (
            <Card key={metric.id} className={`relative ${metric.isNorthStar ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}>
              {metric.isNorthStar && (
                <div className="absolute -top-2 -right-2">
                  <Badge variant="secondary" className="bg-blue-500 text-white">
                    <Star className="w-3 h-3 mr-1" />
                    North Star
                  </Badge>
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-600">
                    {metric.name}
                  </CardTitle>
                  <div className="flex items-center gap-1 text-sm">
                    {getChangeIcon(metric.changePercent || '+0%')}
                    <span className={getChangeColor(metric.changePercent || '+0%')}>
                      {metric.changePercent || '+0%'} vs. last period
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="text-2xl font-bold">
                    {formatValue(currentValue, dashboardData.format)}
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600 mt-1">
                    <span>Progress</span>
                    <span>{progress.toFixed(1)}%</span>
                  </div>
                  <div className="mt-2">
                    <Progress value={progress} className="h-2" />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Goal: {formatValue(yearlyGoal, dashboardData.format)}</span>
                    </div>
                  </div>
                </div>

                {dashboardData.timeSeriesData && (
                  <div className="mt-4">
                    <MetricProgressChart
                      metric={dashboardData}
                      timePeriod={selectedTimePeriod}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* North Star Metrics Section */}
      {sortedMetrics.some(m => m.isNorthStar) && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-blue-500" />
            North Star Metrics
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {sortedMetrics.filter(metric => metric.isNorthStar).map((metric) => {
              const dashboardData = dashboardDataMap[metric.id];
              if (!dashboardData) return null;

              const currentValue = dashboardData.currentValue;
              const yearlyGoal = dashboardData.yearlyGoal;
              const progress = yearlyGoal > 0 ? Math.min((currentValue / yearlyGoal) * 100, 100) : 0;

              return (
                <Card key={`north-star-${metric.id}`} className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-blue-900">{metric.name}</h4>
                      <div className="flex items-center gap-1 text-sm">
                        {getChangeIcon(metric.changePercent || '+0%')}
                        <span className={getChangeColor(metric.changePercent || '+0%')}>
                          {metric.changePercent || '+0%'}
                        </span>
                      </div>
                    </div>
                    <div className="text-xl font-bold text-blue-900 mb-2">
                      {formatValue(currentValue, dashboardData.format)}
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm text-blue-700">
                        <span>Progress</span>
                        <span>{progress.toFixed(1)}%</span>
                      </div>
                      <Progress value={progress} className="h-1" />
                      <div className="text-xs text-blue-600">
                        Goal: {formatValue(yearlyGoal, dashboardData.format)}
                      </div>
                      {dashboardData.timeSeriesData && (
                        <div className="pt-2">
                          <MetricProgressChart
                            metric={dashboardData}
                            timePeriod={selectedTimePeriod}
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Show message if no metrics with SQL queries */}
      {metrics.length > 0 && metricsWithData.length === 0 && (
        <Card className="border-dashed border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-gray-100 p-3 mb-4">
              <Calendar className="w-6 h-6 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Metrics Need Data Sources</h3>
            <p className="text-gray-600 mb-4">
              Your metrics are configured but need SQL queries to calculate values from your data warehouse.
            </p>
            <Button onClick={handleRefresh}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh Data
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}