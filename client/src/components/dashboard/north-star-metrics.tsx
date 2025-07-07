import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TrendingUp, TrendingDown, DollarSign, Target, Calendar, Info, Database, Table, Columns } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface NorthStarMetric {
  id: string;
  name: string;
  value: string;
  yearlyGoal: string;
  changePercent: string;
  description: string;
  format: string;
}

// Format large numbers as millions for display
const formatLargeNumber = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    } else if (value > 0) {
      return `$${value.toLocaleString()}`;
    } else {
      return "$0";
    }
  };


function formatValue(value: string | number, format: string): string {
  if (!value && value !== 0) return '0';

  const valueStr = typeof value === 'number' ? value.toString() : value;

  if (format === 'currency') {
    const numValue = parseFloat(valueStr.replace(/[$,]/g, '')) || 0;
    if (numValue >= 1000000) {
      return `$${(numValue / 1000000).toFixed(1)}M`;
    } else if (numValue >= 1000) {
      return `$${(numValue / 1000).toFixed(0)}K`;
    } else {
      return `$${numValue.toLocaleString()}`;
    }
  }
  return valueStr;
}

function calculateProgress(currentValue: string | number, goalValue: string | number): number {
  if (!currentValue && currentValue !== 0) return 0;
  if (!goalValue && goalValue !== 0) return 0;

  const currentStr = typeof currentValue === 'number' ? currentValue.toString() : currentValue;
  const goalStr = typeof goalValue === 'number' ? goalValue.toString() : goalValue;

  const current = parseFloat(currentStr.replace(/[$,]/g, '')) || 0;
  const goal = parseFloat(goalStr.replace(/[$,]/g, '')) || 1;

  return goal > 0 ? Math.round((current / goal) * 100) : 0;
}

function getProgressStatus(progress: number) {
  if (progress >= 90) return { color: 'text-green-600', bgColor: 'bg-green-100' };
  if (progress >= 75) return { color: 'text-blue-600', bgColor: 'bg-blue-100' };
  if (progress >= 50) return { color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
  return { color: 'text-red-600', bgColor: 'bg-red-100' };
}

interface NorthStarMetricsProps {
  dashboardData?: any;
  timePeriod: string;
  setTimePeriod: (period: string) => void;
  periodOffset?: number;
  setPeriodOffset?: (offset: number) => void;
}

export default function NorthStarMetrics({ 
  dashboardData, 
  timePeriod, 
  setTimePeriod, 
  periodOffset = 0, 
  setPeriodOffset 
}: NorthStarMetricsProps) {
  // No longer making API call - using props from parent component
  const isLoading = !dashboardData;

  // Data source mapping for Snowflake metrics
  const getDataSourceInfo = (metricName: string) => {
    const sources = {
      'revenue': {
        source: 'QuickBooks',
        warehouse: 'Snowflake',
        database: 'MIAS_DATA_DB',
        schema: 'CORE',
        table: 'CORE_QUICKBOOKS_REVENUE',
        column: 'INVOICE_AMOUNT',
        description: 'Total revenue from QuickBooks invoices stored in Snowflake data warehouse'
      },
      'profit': {
        source: 'QuickBooks (Calculated)',
        warehouse: 'Snowflake',
        database: 'MIAS_DATA_DB',
        schema: 'CORE',
        table: 'CORE_QUICKBOOKS_REVENUE - CORE_QUICKBOOKS_EXPENSES',
        column: 'INVOICE_AMOUNT - AMOUNT',
        description: 'Net profit calculated as total revenue minus total expenses from QuickBooks'
      }
    };

    const metricKey = metricName.toLowerCase().includes('revenue') ? 'revenue' :
                     metricName.toLowerCase().includes('profit') ? 'profit' : null;

    if (metricKey && sources[metricKey]) {
      return sources[metricKey];
    }

    return {
      source: 'QuickBooks Integration',
      warehouse: 'Snowflake',
      database: 'MIAS_DATA_DB',
      schema: 'CORE',
      table: 'Financial Data',
      column: 'Calculated Field',
      description: 'Real-time business metric from your Snowflake data warehouse'
    };
  };


  // Client-side goal calculation based on time period
  const calculateGoalForPeriod = (yearlyGoal: number, period: string, monthlyGoals?: any, quarterlyGoals?: any) => {
    switch (period) {
      case 'daily':
        return yearlyGoal / 365;
      case 'weekly':
        return yearlyGoal / 52;
      case 'monthly':
        if (monthlyGoals) {
          const currentMonth = new Date().toLocaleString('default', { month: 'long' });
          return monthlyGoals[currentMonth] || (yearlyGoal / 12);
        }
        return yearlyGoal / 12;
      case 'quarterly':
        if (quarterlyGoals) {
          const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
          return quarterlyGoals[`Q${currentQuarter}`] || (yearlyGoal / 4);
        }
        return yearlyGoal / 4;
      case 'yearly':
      default:
        return yearlyGoal;
    }
  };


  // Format values for display
  const formatMetricValue = (value: number, format: string): string => {
    if (format === 'currency') {
      return formatLargeNumber(value);
    } else if (format === 'percentage') {
      return `${value.toFixed(1)}%`;
    } else {
      return value.toLocaleString();
    }
  };

  // Get North Star metrics from API response
  const northStarMetrics: NorthStarMetric[] = (() => {
    if (!dashboardData?.northStarMetrics || !Array.isArray(dashboardData.northStarMetrics)) {
      return [];
    }

    return dashboardData.northStarMetrics.map((metric: any) => {
      const currentGoal = calculateGoalForPeriod(
        metric.yearlyGoal, 
        timePeriod, 
        metric.monthlyGoals, 
        metric.quarterlyGoals
      );

      // Backend already provides period-specific currentValue based on SQL query
      const adjustedCurrentValue = metric.currentValue;

      return {
        id: metric.id.toString(),
        name: metric.name,
        value: formatMetricValue(adjustedCurrentValue, metric.format),
        yearlyGoal: formatMetricValue(currentGoal, metric.format),
        changePercent: metric.changePercent || "+0%",
        description: metric.description || "",
        format: metric.format
      };
    });
  })();

  // Generate simple chart data based on real values and time period
  const generateChartData = (metric: NorthStarMetric) => {
    const { current, goal } = getRealDisplayValues(metric);
    
    // Create a simple progress chart showing current vs goal over time periods
    const periods = timePeriod === 'daily' ? 7 : 
                   timePeriod === 'weekly' ? 4 : 
                   timePeriod === 'monthly' ? 12 : 
                   timePeriod === 'quarterly' ? 4 : 12;
    
    const periodGoal = goal / periods;
    
    return Array.from({ length: periods }, (_, index) => {
      const periodLabel = timePeriod === 'daily' ? `Day ${index + 1}` :
                         timePeriod === 'weekly' ? `Week ${index + 1}` :
                         timePeriod === 'monthly' ? new Date(2024, index).toLocaleDateString('en-US', { month: 'short' }) :
                         timePeriod === 'quarterly' ? `Q${index + 1}` :
                         new Date(2024, index).toLocaleDateString('en-US', { month: 'short' });
      
      const cumulativeGoal = periodGoal * (index + 1);
      const actualProgress = index <= periods - 1 ? (current / periods) * (index + 1) : null;
      
      return {
        period: periodLabel,
        goal: Math.round(cumulativeGoal),
        actual: actualProgress ? Math.round(actualProgress) : null
      };
    });
  };

  // Only show metrics with real Snowflake data - no fallback
  const metrics = northStarMetrics;

  // Use real API data for current values and goals
  const getRealDisplayValues = (metric: NorthStarMetric) => {
    // Parse the actual values from the metric (which come from real Snowflake data)
    const currentValue = parseFloat(metric.value.replace(/[$,M]/g, '')) * (metric.value.includes('M') ? 1000000 : 1);
    const goalValue = parseFloat(metric.yearlyGoal.replace(/[$,M]/g, '')) * (metric.yearlyGoal.includes('M') ? 1000000 : 1);

    return {
      current: currentValue,
      goal: goalValue
    };
  };

  // Calculate YTD progress from real API data only
  const getYTDProgress = (metric: NorthStarMetric) => {
    const { current, goal } = getRealDisplayValues(metric);
    
    return {
      current,
      goal,
      progress: goal > 0 ? Math.round((current / goal) * 100) : 0
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Target className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">North Star Metrics</h3>
          <div className="h-px bg-gradient-to-r from-purple-300 to-transparent flex-1 ml-4"></div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-purple-600" />
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-32 border-purple-200 focus:ring-purple-500">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="yearly">Yearly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <>
            <Card className="h-64 animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-2 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
            <Card className="h-64 animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-2 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : metrics.length > 0 ? (
          metrics.map((metric) => {
          // Use real API data for all calculations
          const realDisplayValues = getRealDisplayValues(metric);
          const progress = calculateProgress(realDisplayValues.current, realDisplayValues.goal);
          const progressStatus = getProgressStatus(progress);

          // Use YTD progress for "on pace" indicator regardless of selected time period
          const ytdProgress = getYTDProgress(metric);
          const onPaceProgressStatus = getProgressStatus(ytdProgress.progress);

          const changeValue = parseFloat(metric.changePercent);
          const isPositive = changeValue >= 0;

          return (
            <Card key={metric.id} className="relative overflow-hidden border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500"></div>

              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 flex-1">
                    <DollarSign className="h-4 w-4 text-purple-600" />
                    <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                      {metric.name}
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-purple-100 dark:hover:bg-purple-900/30">
                          <Info className="h-3 w-3 text-purple-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-80">
                        <div className="p-3 space-y-3">
                          <div className="font-semibold text-sm text-gray-900 dark:text-white">
                            Data Source Information
                          </div>

                          <div className="space-y-2 text-xs">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 bg-orange-500 rounded-full" />
                              <span className="font-medium">Original Source:</span>
                              <span className="text-gray-600 dark:text-gray-400">{getDataSourceInfo(metric.name).source}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Database className="h-3 w-3 text-blue-500" />
                              <span className="font-medium">Data Warehouse:</span>
                              <span className="text-gray-600 dark:text-gray-400">{getDataSourceInfo(metric.name).warehouse}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Table className="h-3 w-3 text-green-500" />
                              <span className="font-medium">Table:</span>
                              <span className="text-gray-600 dark:text-gray-400">{getDataSourceInfo(metric.name).table}</span>
                            </div>

                            <div className="flex items-center gap-2">
                              <Columns className="h-3 w-3 text-purple-500" />
                              <span className="font-medium">Column:</span>
                              <span className="text-gray-600 dark:text-gray-400">{getDataSourceInfo(metric.name).column}</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="font-medium text-xs text-gray-900 dark:text-white mb-1">
                              Description:
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {getDataSourceInfo(metric.name).description}
                            </div>
                          </div>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className={`flex items-center space-x-1 text-sm font-medium ${onPaceProgressStatus.color}`}>
                    {ytdProgress.progress >= 100 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    <span>{ytdProgress.progress}% on pace</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                {/* Current Value */}
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {metric.value}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    of {metric.yearlyGoal} annual goal
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Progress
                    </span>
                    <span className={`text-xs font-bold ${progressStatus.color}`}>
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 ease-out"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Chart - Same format as Business metrics */}
                <div className="h-32 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={generateChartData(metric)} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis 
                        dataKey="period" 
                        tick={{ fontSize: 10 }}
                        stroke="#6b7280"
                      />
                      <YAxis 
                        tick={{ fontSize: 10 }}
                        stroke="#6b7280"
                      />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: '#f9fafb',
                          border: '1px solid #e5e7eb',
                          borderRadius: '6px',
                          fontSize: '12px'
                        }}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="goal" 
                        stroke="#9ca3af" 
                        strokeDasharray="5 5" 
                        strokeWidth={2}
                        dot={false}
                        name="Goal"
                      />
                      <Line 
                        type="monotone" 
                        dataKey="actual" 
                        stroke="#8b5cf6" 
                        strokeWidth={3}
                        dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 4 }}
                        name="Actual"
                        connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

              </CardContent>
            </Card>
            );
          })
        ) : (
          <div className="col-span-1 md:col-span-2 text-center py-8">
            <div className="text-gray-500 dark:text-gray-400">
              <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No North Star metrics available</p>
              <p className="text-sm">Metrics will appear when real Snowflake data is found</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}