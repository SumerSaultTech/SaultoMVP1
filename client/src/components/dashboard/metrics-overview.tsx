import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Calendar } from "lucide-react";
import MetricProgressChart from "./metric-progress-chart";
import NorthStarMetrics from "./north-star-metrics";
import type { KpiMetric } from "@/../../shared/schema";

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
  const [selectedTimePeriod, setSelectedTimePeriod] = useState("monthly");

  // Fetch KPI metrics from database
  const { data: metrics = [], isLoading: metricsLoading } = useQuery<KpiMetric[]>({
    queryKey: ["/api/kpi-metrics"],
  });

  // Fetch dashboard data for all metrics at once
  const { data: dashboardData = [], isLoading: dashboardLoading } = useQuery<DashboardMetricData[]>({
    queryKey: ["/api/dashboard/metrics-data"],
    enabled: metrics.length > 0,
  });

  const formatValue = (value: number, format: string): string => {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
        return value.toLocaleString();
      default:
        return value.toString();
    }
  };

  const calculateProgress = (current: number, goal: number): number => {
    if (goal === 0) return 0;
    return Math.round((current / goal) * 100);
  };

  const getProgressColor = (progress: number): string => {
    if (progress >= 100) return "text-green-600";
    if (progress >= 75) return "text-blue-600";
    if (progress >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const isLoading = metricsLoading || dashboardLoading;

  // Combine metrics with their dashboard data
  const metricsWithData = metrics.map(metric => {
    const dashboardMetric = dashboardData.find(d => d.metricId === metric.id);
    return {
      metricInfo: metric,
      data: dashboardMetric
    };
  });

  // Split into North Star and regular metrics
  const northStarMetrics = metricsWithData.filter(m => m.metricInfo.isNorthStar);
  const regularMetrics = metricsWithData.filter(m => !m.metricInfo.isNorthStar);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Metrics Overview</h2>
          <p className="text-gray-600">Track your key performance indicators</p>
        </div>
        <div className="flex gap-3">
          <Select value={selectedTimePeriod} onValueChange={setSelectedTimePeriod}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            onClick={onRefresh} 
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* North Star Metrics */}
      {northStarMetrics.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">North Star Metrics</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {northStarMetrics.map(({ data: dashboardData, metricInfo }) => {
              if (!dashboardData) return null;
              
              const progress = calculateProgress(dashboardData.currentValue, dashboardData.yearlyGoal);
              
              return (
                <Card key={metricInfo.id} className="border-2 border-blue-200 bg-blue-50/30">
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg font-semibold text-gray-900">
                          {metricInfo.name}
                        </CardTitle>
                        <p className="text-sm text-gray-600 mt-1">
                          {metricInfo.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-gray-900">
                          {formatValue(dashboardData.currentValue, dashboardData.format)}
                        </div>
                        <div className={`text-sm font-medium ${getProgressColor(progress)}`}>
                          {progress}% of goal
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Annual Goal</span>
                        <span className="font-medium">
                          {formatValue(dashboardData.yearlyGoal, dashboardData.format)}
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-3">
                        <div 
                          className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        ></div>
                      </div>
                      {dashboardData.timeSeriesData && (
                        <MetricProgressChart
                          data={dashboardData.timeSeriesData[selectedTimePeriod as keyof typeof dashboardData.timeSeriesData] || []}
                          timePeriod={selectedTimePeriod}
                          format={dashboardData.format}
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Regular KPI Metrics */}
      {regularMetrics.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">KPI Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {regularMetrics.map(({ data: dashboardData, metricInfo }) => {
              if (!dashboardData) return null;
              
              const progress = calculateProgress(dashboardData.currentValue, dashboardData.yearlyGoal);
              
              return (
                <Card key={metricInfo.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold text-gray-900">
                      {metricInfo.name}
                    </CardTitle>
                    <div className="flex justify-between items-baseline">
                      <div className="text-xl font-bold text-gray-900">
                        {formatValue(dashboardData.currentValue, dashboardData.format)}
                      </div>
                      <div className={`text-sm font-medium ${getProgressColor(progress)}`}>
                        {progress}%
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Goal: {formatValue(dashboardData.yearlyGoal, dashboardData.format)}</span>
                        <span>{metricInfo.category}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min(progress, 100)}%` }}
                        ></div>
                      </div>
                      {dashboardData.timeSeriesData && (
                        <div className="pt-2">
                          <MetricProgressChart
                            data={dashboardData.timeSeriesData[selectedTimePeriod as keyof typeof dashboardData.timeSeriesData] || []}
                            timePeriod={selectedTimePeriod}
                            format={dashboardData.format}
                            compact={true}
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Calculated Metrics
            </h3>
            <p className="text-gray-600 mb-4 max-w-md">
              Add SQL queries to your metrics to see real-time calculations and visualizations.
            </p>
            <Button variant="outline" size="sm">
              Configure Metrics
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Show message if no metrics at all */}
      {metrics.length === 0 && (
        <Card className="border-dashed border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="rounded-full bg-gray-100 p-3 mb-4">
              <Calendar className="w-6 h-6 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Metrics Found
            </h3>
            <p className="text-gray-600 mb-4 max-w-md">
              Create your first metric to start tracking your business performance.
            </p>
            <Button variant="outline" size="sm">
              Create Metric
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}