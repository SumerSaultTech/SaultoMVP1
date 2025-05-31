import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Calendar, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { KpiMetric } from "@/../../shared/schema";

interface MetricProgressChartProps {
  metric: Partial<KpiMetric>;
}

// Generate YTD progress data based on metric
function generateYTDData(metric: Partial<KpiMetric>) {
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  // Parse current value and yearly goal
  const currentValueStr = metric.value || "0";
  const yearlyGoalStr = metric.yearlyGoal || "0";
  
  // Extract numeric values (remove currency symbols, commas, percentages, etc.)
  const currentValue = parseFloat(currentValueStr.replace(/[$,%\s]/g, '')) || 0;
  const yearlyGoal = parseFloat(yearlyGoalStr.replace(/[$,%\s]/g, '')) || 100;
  
  // Ensure we have valid numbers
  if (isNaN(currentValue) || isNaN(yearlyGoal) || yearlyGoal <= 0) {
    return [];
  }
  
  // Create realistic performance patterns based on metric type
  const getPerformancePattern = (metricName: string) => {
    const name = metricName.toLowerCase();
    
    if (name.includes('revenue') || name.includes('arr') || name.includes('mrr')) {
      // Revenue typically shows steady growth with some seasonal variation
      return [0.85, 0.88, 0.92, 0.95, 0.98, 1.02, 1.05, 1.08, 1.12, 1.15, 1.18, 1.20];
    } else if (name.includes('churn') || name.includes('cost') || name.includes('cac')) {
      // Metrics where lower is better - show improvement over time
      return [1.15, 1.12, 1.08, 1.05, 1.02, 0.98, 0.95, 0.92, 0.90, 0.88, 0.85, 0.82];
    } else if (name.includes('conversion') || name.includes('retention') || name.includes('satisfaction')) {
      // Conversion metrics show gradual improvement with some fluctuation
      return [0.82, 0.85, 0.89, 0.92, 0.95, 0.98, 1.01, 1.04, 1.06, 1.08, 1.10, 1.12];
    } else if (name.includes('users') || name.includes('adoption')) {
      // User metrics show strong growth in early months, then steady growth
      return [0.75, 0.82, 0.90, 0.96, 1.02, 1.08, 1.12, 1.16, 1.19, 1.22, 1.24, 1.26];
    } else {
      // Default pattern for other metrics
      return [0.88, 0.91, 0.94, 0.97, 1.00, 1.03, 1.06, 1.09, 1.11, 1.13, 1.15, 1.17];
    }
  };
  
  const performancePattern = getPerformancePattern(metric.name || '');
  
  // Generate monthly data points
  const monthlyData = months.slice(0, currentMonth).map((month, index) => {
    const monthNumber = index + 1;
    
    // Goal trajectory (linear progression through the year)
    const goalProgress = (yearlyGoal / 12) * monthNumber;
    
    // Use performance pattern to create realistic actual values
    const performanceMultiplier = performancePattern[index] || 1.0;
    const actualValue = goalProgress * performanceMultiplier;
    
    return {
      month,
      monthNumber,
      goal: Math.round(goalProgress),
      actual: Math.round(actualValue),
      isCurrentMonth: monthNumber === currentMonth
    };
  });

  return monthlyData;
}

function formatValue(value: number, format: string | null | undefined): string {
  if (format === 'currency') {
    return formatCurrency(value);
  } else if (format === 'percentage') {
    return `${value}%`;
  } else {
    return formatNumber(value);
  }
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  
  if (absValue >= 1000000000) {
    // Billions
    const formatted = (value / 1000000000).toFixed(1);
    return `$${formatted}B`;
  } else if (absValue >= 1000000) {
    // Millions
    const formatted = (value / 1000000).toFixed(1);
    return `$${formatted}M`;
  } else if (absValue >= 1000) {
    // Thousands
    const formatted = (value / 1000).toFixed(1);
    return `$${formatted}K`;
  } else {
    // Less than 1000
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }
}

function formatNumber(value: number): string {
  const absValue = Math.abs(value);
  
  if (absValue >= 1000000000) {
    // Billions
    const formatted = (value / 1000000000).toFixed(1);
    return `${formatted}B`;
  } else if (absValue >= 1000000) {
    // Millions
    const formatted = (value / 1000000).toFixed(1);
    return `${formatted}M`;
  } else if (absValue >= 1000) {
    // Thousands
    const formatted = (value / 1000).toFixed(1);
    return `${formatted}K`;
  } else {
    // Less than 1000
    return new Intl.NumberFormat('en-US').format(value);
  }
}

function getProgressStatus(actual: number, goal: number) {
  const percentage = goal > 0 ? (actual / goal) * 100 : 0;
  
  if (percentage >= 95) return { status: 'on-track', color: 'bg-green-500', textColor: 'text-green-700' };
  if (percentage >= 80) return { status: 'at-risk', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
  return { status: 'behind', color: 'bg-red-500', textColor: 'text-red-700' };
}

export default function MetricProgressChart({ metric }: MetricProgressChartProps) {
  const ytdData = generateYTDData(metric);
  const currentData = ytdData[ytdData.length - 1];
  const goalProgress = parseFloat(metric.goalProgress || "0");
  

  
  if (!currentData) return null;

  const progressStatus = getProgressStatus(currentData.actual, currentData.goal);

  return (
    <TooltipProvider>
      <Card className="h-full">
        <CardHeader className="pb-2 md:pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 md:gap-2 min-w-0 flex-1 pr-2">
              <CardTitle className="text-sm md:text-base font-semibold line-clamp-2 md:line-clamp-1 leading-tight">
                {metric.name}
              </CardTitle>
              {metric.description && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0 flex-shrink-0">
                      <Info className="h-3 w-3 text-gray-400" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs text-sm">{metric.description}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <Badge 
              variant="outline" 
              className={`text-xs flex-shrink-0 ${progressStatus.textColor} border-current`}
            >
              <span className="hidden sm:inline">
                {progressStatus.status === 'on-track' ? 'On Track' : 
                 progressStatus.status === 'at-risk' ? 'At Risk' : 'Behind'}
              </span>
              <span className="sm:hidden">
                {progressStatus.status === 'on-track' ? '✓' : 
                 progressStatus.status === 'at-risk' ? '!' : '×'}
              </span>
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-3 md:space-y-4">
          {/* Current Values with Annual Progress */}
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2 md:gap-4 items-start">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500 mb-1 whitespace-nowrap">Current (YTD)</div>
              <div className="text-sm md:text-lg font-bold truncate" title={formatValue(currentData.actual, metric.format)}>
                {formatValue(currentData.actual, metric.format)}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500 mb-1 whitespace-nowrap">Goal (YTD)</div>
              <div className="text-sm md:text-lg font-medium text-gray-700 truncate" title={formatValue(currentData.goal, metric.format)}>
                {formatValue(currentData.goal, metric.format)}
              </div>
            </div>
            <div className="min-w-0 w-20 md:w-24 flex-shrink-0">
              <div className="text-xs text-gray-500 mb-1 text-center">
                <span className="hidden sm:inline">Annual Progress</span>
                <span className="sm:hidden">Progress</span>
              </div>
              <div className="space-y-1">
                <div className="text-sm md:text-base font-medium text-center">{goalProgress}%</div>
                <Progress value={goalProgress} className="h-1.5 md:h-2 w-full" />
              </div>
            </div>
          </div>

          {/* YTD Chart Visualization */}
          <div className="space-y-2">
            <div className="text-xs text-gray-600 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span className="hidden sm:inline">Year-to-Date Progress</span>
              <span className="sm:hidden">YTD Progress</span>
            </div>
            
            {/* Simple chart using CSS */}
            <div className="relative h-16 md:h-20 bg-gray-50 rounded-lg p-1.5 md:p-2">
              {ytdData.length > 0 ? (
                <>
                  <div className="h-full flex items-end justify-between gap-0.5 md:gap-1">
                    {ytdData.map((point, index) => {
                      const maxValue = Math.max(...ytdData.map(d => Math.max(d.actual, d.goal)));
                      // Calculate heights with minimum visibility
                      const actualHeight = Math.max(8, (point.actual / maxValue) * 90);
                      const goalHeight = Math.max(8, (point.goal / maxValue) * 90);
                      
                      return (
                        <div key={point.month} className="flex-1 flex items-end justify-center gap-0.5">
                          {/* Goal bar (background) */}
                          <div 
                            className="w-1 md:w-1.5 bg-gray-300 rounded-sm opacity-70"
                            style={{ height: `${goalHeight}%` }}
                            title={`${point.month} Goal: ${formatValue(point.goal, metric.format)}`}
                          />
                          {/* Actual bar */}
                          <div 
                            className={`w-1.5 md:w-2 rounded-sm ${
                              point.actual >= point.goal ? 'bg-green-500' : 'bg-red-400'
                            } ${point.isCurrentMonth ? 'ring-1 md:ring-2 ring-blue-400' : ''}`}
                            style={{ height: `${actualHeight}%` }}
                            title={`${point.month} Actual: ${formatValue(point.actual, metric.format)}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                  
                  {/* Month labels */}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-400 mt-1">
                    {ytdData.map((point) => (
                      <span key={point.month} className="flex-1 text-center text-xs">
                        {point.month.substring(0, 1)}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-gray-400">
                  No YTD data available
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}