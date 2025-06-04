import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar, RefreshCw, Target } from "lucide-react";
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

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metricsWithData.map((metric) => {
          const hasCalculatedValue = metric.dashboardData;
          const currentValue = hasCalculatedValue ? metric.dashboardData.currentValue : 0;
          const yearlyGoal = hasCalculatedValue ? metric.dashboardData.yearlyGoal : parseFloat(metric.yearlyGoal?.replace(/[$,]/g, '') || '0');
          const progress = hasCalculatedValue ? calculateProgress(currentValue, yearlyGoal) : 0;
          const progressStatus = getProgressStatus(progress);

          console.log(`Progress calculation: ${currentValue} / ${yearlyGoal} = ${progress}%`);

          return (
            <Card key={metric.id} className="relative overflow-hidden border-2 border-purple-100 bg-gradient-to-br from-white to-purple-50 dark:from-gray-800 dark:to-purple-900/20">
              {/* Progress indicator bar */}
              <div className={`absolute top-0 left-0 w-full h-2 ${
                hasCalculatedValue ? progressStatus.barColor : 'bg-gray-300 dark:bg-gray-600'
              }`}></div>
              
              <CardHeader className="pb-3 pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                      {metric.name}
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {metric.description || 'Key performance metric'}
                    </p>
                  </div>
                  <div className={`ml-3 px-3 py-1 rounded-full text-xs font-semibold ${
                    hasCalculatedValue ? progressStatus.color + ' ' + progressStatus.bgColor : 'text-gray-500 bg-gray-100'
                  }`}>
                    {hasCalculatedValue ? `${progress}%` : 'No data'}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                {/* Current Value */}
                <div className="text-center">
                  {hasCalculatedValue ? (
                    <>
                      <div className="text-4xl font-bold text-purple-700 dark:text-purple-300 mb-1">
                        {formatValue(currentValue, metric.format || 'currency')}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        of {formatValue(yearlyGoal, metric.format || 'currency')} {getTimePeriodLabel(selectedTimePeriod).toLowerCase()} goal
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-4xl font-bold text-gray-400 dark:text-gray-500 mb-1">
                        Not calculated
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-500">
                        Calculate metric to see progress toward {formatValue(yearlyGoal, metric.format || 'currency')} goal
                      </div>
                    </>
                  )}
                </div>

                {/* Progress Chart */}
                <div className="h-24 -mx-2">
                  {hasCalculatedValue && metric.dashboardData ? (
                    <MetricProgressChart 
                      metric={metric.dashboardData} 
                      timePeriod={selectedTimePeriod}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="text-center">
                        <div className="text-gray-400 dark:text-gray-500 text-sm">
                          Calculate metric to view progress chart
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}