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
  
  // Extract numeric values (remove currency symbols, commas, etc.)
  const currentValue = parseFloat(currentValueStr.replace(/[$,%]/g, '')) || 0;
  const yearlyGoal = parseFloat(yearlyGoalStr.replace(/[$,%]/g, '')) || 100;
  
  // Generate monthly data points
  const monthlyData = months.slice(0, currentMonth).map((month, index) => {
    const monthNumber = index + 1;
    
    // Goal trajectory (linear progression through the year)
    const goalProgress = (yearlyGoal / 12) * monthNumber;
    
    // Simulated actual values with some variance around the goal
    // In a real app, this would come from your data source
    const variance = 0.8 + (Math.random() * 0.4); // 80% to 120% of goal pace
    const actualValue = goalProgress * variance;
    
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } else if (format === 'percentage') {
    return `${value}%`;
  } else {
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
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold line-clamp-1">
                {metric.name}
              </CardTitle>
              {metric.description && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-4 w-4 p-0">
                      <Info className="h-3 w-3 text-gray-400" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="max-w-xs">{metric.description}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            <Badge 
              variant="outline" 
              className={`text-xs ${progressStatus.textColor} border-current`}
            >
              {progressStatus.status === 'on-track' ? 'On Track' : 
               progressStatus.status === 'at-risk' ? 'At Risk' : 'Behind'}
            </Badge>
          </div>
        </CardHeader>
        
        <CardContent className="pt-0 space-y-4">
          {/* Current Values with Annual Progress */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Current (YTD)</div>
              <div className="text-lg font-bold">
                {formatValue(currentData.actual, metric.format)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Goal (YTD)</div>
              <div className="text-lg font-medium text-gray-700">
                {formatValue(currentData.goal, metric.format)}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Annual Progress</div>
              <div className="space-y-1">
                <div className="text-sm font-medium">{goalProgress}%</div>
                <Progress value={goalProgress} className="h-1.5" />
              </div>
            </div>
          </div>

          {/* YTD Chart Visualization */}
          <div className="space-y-2">
            <div className="text-xs text-gray-600 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Year-to-Date Progress
            </div>
            
            {/* Simple chart using CSS */}
            <div className="relative h-20 bg-gray-50 rounded-lg p-2">
              <div className="h-full flex items-end justify-between gap-1">
                {ytdData.map((point, index) => {
                  const maxValue = Math.max(...ytdData.map(d => Math.max(d.actual, d.goal)));
                  const actualHeight = (point.actual / maxValue) * 100;
                  const goalHeight = (point.goal / maxValue) * 100;
                  
                  return (
                    <div key={point.month} className="flex-1 flex items-end justify-center gap-0.5">
                      {/* Goal bar (background) */}
                      <div 
                        className="w-1 bg-gray-300 rounded-sm opacity-60"
                        style={{ height: `${goalHeight}%` }}
                        title={`${point.month} Goal: ${formatValue(point.goal, metric.format)}`}
                      />
                      {/* Actual bar */}
                      <div 
                        className={`w-1.5 rounded-sm ${
                          point.actual >= point.goal ? 'bg-green-500' : 'bg-red-400'
                        } ${point.isCurrentMonth ? 'ring-2 ring-blue-400' : ''}`}
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
                  <span key={point.month} className="flex-1 text-center">
                    {point.month.substring(0, 1)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}