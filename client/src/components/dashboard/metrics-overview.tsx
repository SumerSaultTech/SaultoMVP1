import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCw, Target, DollarSign, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { KpiMetric } from "@shared/schema";
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

function formatValue(value: number | string, format: string): string {
  if (!value && value !== 0) return '0';
  
  const numValue = typeof value === 'string' ? parseFloat(value.replace(/[$,]/g, '')) : value;
  
  if (isNaN(numValue) || numValue === null || numValue === undefined) {
    return format === 'currency' ? '$0' : '0';
  }

  if (format === 'currency') {
    if (numValue >= 1000000) {
      return `$${(numValue / 1000000).toFixed(1)}M`;
    } else if (numValue >= 1000) {
      return `$${(numValue / 1000).toFixed(0)}K`;
    } else {
      return `$${numValue.toLocaleString()}`;
    }
  } else if (format === 'percentage') {
    return `${numValue.toFixed(1)}%`;
  } else {
    return numValue.toLocaleString();
  }
}

function calculateProgress(currentValue: number, goalValue: number): number {
  if (!currentValue && currentValue !== 0) return 0;
  if (!goalValue && goalValue !== 0) return 0;
  
  return goalValue > 0 ? Math.round((currentValue / goalValue) * 100) : 0;
}

function getProgressStatus(progress: number) {
  if (progress >= 90) return { color: 'text-green-600', bgColor: 'bg-green-100', barColor: 'bg-green-500' };
  if (progress >= 75) return { color: 'text-blue-600', bgColor: 'bg-blue-100', barColor: 'bg-blue-500' };
  if (progress >= 50) return { color: 'text-yellow-600', bgColor: 'bg-yellow-100', barColor: 'bg-yellow-500' };
  return { color: 'text-red-600', bgColor: 'bg-red-100', barColor: 'bg-red-500' };
}

export default function MetricsOverview({ onRefresh }: MetricsOverviewProps) {
  const [selectedTimePeriod, setSelectedTimePeriod] = useState("monthly");

  // Fetch KPI metrics from database
  const { data: metrics = [], isLoading: metricsLoading } = useQuery<KpiMetric[]>({
    queryKey: ["/api/kpi-metrics"],
  });

  // Fetch dashboard data for all metrics at once
  const { data: dashboardData = [], isLoading: dashboardLoading } = useQuery<DashboardMetricData[]>({
    queryKey: ["/api/dashboard/metrics-data", selectedTimePeriod],
    queryFn: () => fetch(`/api/dashboard/metrics-data?timePeriod=${selectedTimePeriod}`).then(res => res.json()),
    enabled: metrics.length > 0,
  });

  const isLoading = metricsLoading || dashboardLoading;

  const getTimePeriodLabel = (period: string) => {
    switch (period) {
      case "weekly": return "Weekly View";
      case "monthly": return "Monthly View";
      case "quarterly": return "Quarterly View";
      case "ytd": return "Year to Date";
      default: return "Monthly View";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Metrics Overview</h2>
            <p className="text-gray-600">Track your key performance indicators</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  // Combine metrics with dashboard data
  const metricsWithData = metrics.map(metric => {
    const dashboardItem = dashboardData.find(d => d.metricId === metric.id);
    return {
      ...metric,
      dashboardData: dashboardItem
    };
  });

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

      {/* KPI Cards */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
          <CardTitle>Core Business KPIs - {getTimePeriodLabel(selectedTimePeriod)}</CardTitle>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-1 h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {metricsWithData.map((metric) => {
              const hasCalculatedValue = metric.dashboardData;
              const currentValue = hasCalculatedValue ? metric.dashboardData.currentValue : 0;
              const yearlyGoal = hasCalculatedValue ? metric.dashboardData.yearlyGoal : parseFloat(metric.yearlyGoal?.replace(/[$,]/g, '') || '0');
              const progress = hasCalculatedValue ? calculateProgress(currentValue, yearlyGoal) : 0;
              
              // Determine icon based on metric name
              const getMetricIcon = (name: string) => {
                if (name.toLowerCase().includes('revenue') || name.toLowerCase().includes('deal')) {
                  return DollarSign;
                } else if (name.toLowerCase().includes('expense')) {
                  return Target;
                } else {
                  return TrendingUp;
                }
              };
              
              const Icon = getMetricIcon(metric.name);
              const isPositive = progress >= 100 || (metric.name.toLowerCase().includes('expense') && progress < 50);

              console.log(`Progress calculation: ${currentValue} / ${yearlyGoal} = ${progress}%`);

              return (
                <div key={metric.id} className="bg-white rounded-lg p-6 border border-purple-100 hover:border-purple-200 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-700 text-sm">{metric.name}</h4>
                    <Icon className="h-5 w-5 text-purple-500" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-3xl font-bold text-gray-900">
                      {hasCalculatedValue ? formatValue(currentValue, metric.format || 'currency') : 'N/A'}
                    </p>
                    {hasCalculatedValue && (
                      <>
                        <div className="flex items-center space-x-2">
                          <span className={`text-sm px-2 py-1 rounded-full font-medium ${
                            isPositive 
                              ? "bg-green-100 text-green-800" 
                              : "bg-red-100 text-red-800"
                          }`}>
                            {progress}% of goal
                          </span>
                          <span className="text-sm text-gray-500">vs {getTimePeriodLabel(selectedTimePeriod).toLowerCase()}</span>
                        </div>
                        {/* Mini Progress Chart */}
                        <div className="h-16 -mx-2 mt-3">
                          <MetricProgressChart 
                            metric={metric.dashboardData} 
                            timePeriod={selectedTimePeriod}
                          />
                        </div>
                      </>
                    )}
                    {!hasCalculatedValue && (
                      <div className="text-sm text-gray-500">
                        Calculate to see {getTimePeriodLabel(selectedTimePeriod).toLowerCase()} progress
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}