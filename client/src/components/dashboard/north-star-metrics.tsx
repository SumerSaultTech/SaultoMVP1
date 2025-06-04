import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Calendar } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

// Fetch North Star metrics from metrics management system
function useNorthStarMetrics() {
  return useQuery({
    queryKey: ["/api/kpi-metrics"],
    select: (data: any[]) => {
      // Filter for metrics marked as North Star using the isNorthStar field
      return data.filter(metric => metric.isNorthStar === true);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 10 * 60 * 1000, // 10 minutes
  });
}

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

export default function NorthStarMetrics() {
  const [northStarTimePeriod, setNorthStarTimePeriod] = useState("ytd");
  
  // Fetch authentic metrics from database
  const { data: northStarMetrics, isLoading, error } = useNorthStarMetrics();

  // Time period options for North Star metrics
  const northStarTimePeriodOptions = [
    { value: "weekly", label: "Weekly View" },
    { value: "monthly", label: "Monthly View" }, 
    { value: "quarterly", label: "Quarterly View" },
    { value: "ytd", label: "Year to Date" }
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">North Star Metrics</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-48 bg-gray-100 animate-pulse rounded-lg"></div>
          <div className="h-48 bg-gray-100 animate-pulse rounded-lg"></div>
        </div>
      </div>
    );
  }

  if (error || !northStarMetrics || northStarMetrics.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Target className="h-5 w-5 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">North Star Metrics</h3>
          </div>
        </div>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-blue-700">No North Star metrics found.</p>
          <p className="text-blue-600 text-sm mt-1">Create metrics and mark them as North Star using the checkbox in Metrics Management.</p>
        </div>
      </div>
    );
  }

  const getTimePeriodLabel = (period: string) => {
    const option = northStarTimePeriodOptions.find(opt => opt.value === period);
    return option?.label || "Year to Date";
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
          <Select value={northStarTimePeriod} onValueChange={setNorthStarTimePeriod}>
            <SelectTrigger className="w-40 border-purple-200 focus:ring-purple-500">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {northStarTimePeriodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {northStarMetrics.map((metric: any) => {
          // Only show authentic calculated values
          const hasCalculatedValue = metric.value && metric.value.trim() !== '';
          const currentValue = hasCalculatedValue ? parseFloat(metric.value.replace(/[$,]/g, '')) : 0;
          const yearlyGoal = parseFloat(metric.yearlyGoal?.replace(/[$,]/g, '') || '0');
          const progress = hasCalculatedValue ? calculateProgress(currentValue, yearlyGoal) : 0;
          const progressStatus = getProgressStatus(progress);

          return (
            <Card key={metric.id} className="relative overflow-hidden border-2 border-purple-100 bg-gradient-to-br from-white to-purple-50 dark:from-gray-800 dark:to-purple-900/20">
              {/* Progress indicator bar */}
              <div className={`absolute top-0 left-0 w-full h-2 ${
                hasCalculatedValue ? (
                  progress >= 90 ? 'bg-green-500' : 
                  progress >= 75 ? 'bg-blue-500' : 
                  progress >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                ) : 'bg-gray-300 dark:bg-gray-600'
              }`}></div>
              
              <CardHeader className="pb-3 pt-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                      {metric.name}
                    </CardTitle>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {metric.description || 'North Star metric'}
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
                        of {formatValue(yearlyGoal, metric.format || 'currency')} {getTimePeriodLabel(northStarTimePeriod).toLowerCase()} goal
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

                {/* Chart placeholder or message */}
                <div className="h-24 -mx-2">
                  {hasCalculatedValue ? (
                    <div className="flex items-center justify-center h-full bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <div className="text-center">
                        <div className="text-purple-600 dark:text-purple-400 text-sm font-medium">
                          Progress Chart
                        </div>
                        <div className="text-xs text-purple-500 dark:text-purple-400 mt-1">
                          Chart available when historical data exists
                        </div>
                      </div>
                    </div>
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