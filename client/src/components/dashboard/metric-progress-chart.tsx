import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { KpiMetric } from '@shared/schema';

interface MetricProgressChartProps {
  metric: Partial<KpiMetric>;
  timePeriod?: string;
}

interface ChartDataPoint {
  period: string;
  goal: number | null;
  actual: number | null;
  isCurrent: boolean;
}

// Map metric names to our analytics series names
function getSeriesName(metricName: string): string | null {
  if (!metricName) return null;
  
  const mapping: Record<string, string> = {
    'jira story points completed': 'Jira Story Points Completed',
    'jira issues resolved': 'Jira Issues Resolved', 
    'average jira cycle time': 'Average Jira Cycle Time',
  };
  
  const key = metricName.toLowerCase().trim();
  return mapping[key] || null;
}

// Get dot configuration based on granularity for chart cleanup
function getDotConfig(granularity: string) {
  switch (granularity) {
    case 'day':
      return { fill: '#10b981', strokeWidth: 2, r: 2 }; // Small uniform dots for daily data
    case 'week':
      return { fill: '#10b981', strokeWidth: 2, r: 1 }; // Very small dots for weekly data  
    case 'month':
      return { fill: '#10b981', strokeWidth: 2, r: 2 }; // Small uniform dots for monthly data
    default:
      return { fill: '#10b981', strokeWidth: 2, r: 2 }; // Small uniform default
  }
}

// Get date range based on time period
function getDateRange(timePeriod: string) {
  // For testing with July-August 2025 data, simulate "today" as mid-August
  const today = new Date(); // Use actual current date
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-based
  const currentDate = today.getDate();
  
  switch (timePeriod.toLowerCase()) {
    case 'weekly view':
    case 'weekly':
      // Last 7 days (including today)
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - 6);
      return {
        start: format(weekStart, 'yyyy-MM-dd'),
        end: format(today, 'yyyy-MM-dd'),
        granularity: 'day'
      };
      
    case 'monthly view':
    case 'monthly':
      // Current month - full month but actuals only through today
      const monthStart = new Date(currentYear, currentMonth, 1);
      const monthEnd = new Date(currentYear, currentMonth + 1, 0); // Last day of month
      return {
        start: format(monthStart, 'yyyy-MM-dd'),
        end: format(monthEnd, 'yyyy-MM-dd'),
        granularity: 'day'
      };
      
    case 'quarterly view':
    case 'quarterly':
      // Current quarter - full quarter but actuals only through today
      const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
      const quarterStart = new Date(currentYear, quarterStartMonth, 1);
      const quarterEnd = new Date(currentYear, quarterStartMonth + 3, 0); // Last day of quarter
      return {
        start: format(quarterStart, 'yyyy-MM-dd'),
        end: format(quarterEnd, 'yyyy-MM-dd'),
        granularity: 'week'
      };
      
    case 'yearly view':
    case 'yearly':
    default:
      // Current year - full year but actuals only through today
      const yearStart = new Date(currentYear, 0, 1);
      const yearEnd = new Date(currentYear, 11, 31); // Dec 31
      return {
        start: format(yearStart, 'yyyy-MM-dd'),
        end: format(yearEnd, 'yyyy-MM-dd'),
        granularity: 'month'
      };
  }
}

export default function MetricProgressChart({ metric, timePeriod = "Monthly View" }: MetricProgressChartProps) {
  const seriesName = getSeriesName(metric.name || '');
  const { start, end, granularity } = getDateRange(timePeriod);
  
  
  const { data: seriesData, isLoading } = useQuery({
    queryKey: ['metric-series', seriesName, start, end, granularity],
    queryFn: async () => {
      const params = new URLSearchParams({
        start,
        end,
        granularity,
        include_goals: 'true',
        cumulative: 'true', // Request cumulative data from backend
        relative: 'true', // Request period-relative values starting from 0
      });

      const response = await fetch(`/api/series?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch metrics series data');
      }
      return response.json();
    },
    enabled: !!seriesName, // Only fetch if we have a valid series name
  });

  // Process the data for the chart (backend provides cumulative data)
  const chartData: ChartDataPoint[] = React.useMemo(() => {
    if (!seriesData?.data || !seriesName) return [];
    
    const today = new Date();
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    // Filter actual data for this specific metric and date range
    const actualDataPoints = seriesData.data
      .filter((item: any) => {
        const itemDate = new Date(item.ts);
        return item.series === seriesName && 
               itemDate >= startDate && 
               itemDate <= endDate;
      })
      .map((item: any) => ({
        ts: item.ts,
        value: parseFloat(item.value) || 0
      }))
      .sort((a: any, b: any) => a.ts.localeCompare(b.ts));
    
    // Filter goal data for this specific metric and date range
    const goalSeriesName = `Goal: ${seriesName}`;
    const goalDataPoints = seriesData.data
      .filter((item: any) => {
        const itemDate = new Date(item.ts);
        return item.series === goalSeriesName && 
               itemDate >= startDate && 
               itemDate <= endDate;
      })
      .map((item: any) => ({
        ts: item.ts,
        value: parseFloat(item.value) || 0
      }))
      .sort((a: any, b: any) => a.ts.localeCompare(b.ts));
    
    // Create a map of goal data by date for easy lookup
    const goalDataMap = goalDataPoints.reduce((acc: any, item: any) => {
      acc[item.ts] = item.value;
      return acc;
    }, {} as Record<string, number>);
    
    // Build chart data using actual dates from backend within the selected range
    return actualDataPoints.map((item: any, index: number) => {
      const date = new Date(item.ts);
      const isInFuture = date > today;
      
      // Format period label based on granularity
      let periodLabel = '';
      if (granularity === 'day') {
        periodLabel = format(date, 'MMM dd');
      } else if (granularity === 'week') {
        periodLabel = format(date, 'MMM dd');
      } else if (granularity === 'month') {
        periodLabel = format(date, 'MMM yyyy');
      }
      
      return {
        period: periodLabel,
        actual: isInFuture ? null : item.value,
        goal: goalDataMap[item.ts] || null,
        isCurrent: !isInFuture && index === actualDataPoints.length - 1
      };
    });
  }, [seriesData, seriesName, granularity, start, end]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  if (!seriesName || !chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
        <span className="text-sm">No analytics data available</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
        {/* Goal line - will be added when goals are implemented */}
        {chartData.some(d => d.goal !== null) && (
          <Line 
            type="monotone" 
            dataKey="goal" 
            stroke="#9ca3af" 
            strokeDasharray="5 5" 
            strokeWidth={2}
            dot={false}
            name="Goal"
          />
        )}
        <Line 
          type="monotone" 
          dataKey="actual" 
          stroke="#10b981" 
          strokeWidth={3}
          dot={getDotConfig(granularity)}
          name="Actual"
          connectNulls={false} // Don't connect lines across null values (future dates)
        />
      </LineChart>
    </ResponsiveContainer>
  );
}