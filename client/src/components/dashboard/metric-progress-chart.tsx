import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatNumber } from '@/lib/format-utils';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import type { Metric } from '@shared/schema';

interface MetricProgressChartProps {
  metric: Partial<Metric>;
  timePeriod?: string;
}

interface ChartDataPoint {
  period: string;
  goal: number | null;
  actual: number | null;
  isCurrent: boolean;
}

// Map metric names to metric keys for API calls
function getMetricKey(metricName: string): string | null {
  if (!metricName) return null;
  
  // For the new tenant-isolated metrics system, we need to use the actual metric_key
  // This should match the metric_key from the database
  const mapping: Record<string, string> = {
    'jira story points completed': 'jira_story_points_completed',
    'jira issues resolved': 'jira_issues_resolved', 
    'average jira cycle time': 'average_jira_cycle_time',
    'test': 'test',
    'testing b2': 'testing_b2',
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

// Map time period to backend period type and granularity
function getPeriodMapping(timePeriod: string) {
  const periodTypeMap = {
    'weekly view': 'weekly',
    'weekly': 'weekly',
    'monthly view': 'monthly', 
    'monthly': 'monthly',
    'quarterly view': 'quarterly',
    'quarterly': 'quarterly',
    'yearly view': 'yearly',
    'yearly': 'yearly'
  };
  
  return periodTypeMap[timePeriod.toLowerCase() as keyof typeof periodTypeMap] || 'weekly';
}

export default function MetricProgressChart({ metric, timePeriod = "Monthly View" }: MetricProgressChartProps) {
  console.log('🔍 Chart Rendering for:', metric.name);
  console.log('🔍 MetricProgressChart component loaded and executing');
  
  // Get the metric key for API calls
  const metricKey = getMetricKey(metric.name || '');
  console.log('🔍 Metric key mapping result:', { name: metric.name, metricKey });
  const periodType = getPeriodMapping(timePeriod);
  
  // Fetch chart data from original working API
  const { data: chartDataResponse, isLoading, error } = useQuery({
    queryKey: ['chart-data', metricKey, periodType],
    queryFn: async () => {
      if (!metricKey) {
        console.warn('No metric key found for:', metric.name);
        return [];
      }
      
      console.log('📊 Fetching chart data:', { metricKey, timePeriod });
      console.log('📊 Making API call to:', `/api/company/chart-data?metric_keys=${metricKey}&period_type=${periodType}`);
      
      const response = await fetch(`/api/company/chart-data?metric_keys=${metricKey}&period_type=${periodType}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch chart data: ${response.statusText}`);
      }
      const result = await response.json();
      return result.data || [];
    },
    enabled: !!metricKey,
  });

  // Chart data is directly from the API response
  const rawChartData = chartDataResponse || [];

  // Process the real API data
  const chartData = React.useMemo(() => {
    if (!rawChartData || rawChartData.length === 0) {
      console.warn('No chart data available for:', metric.name);
      return [];
    }

    // Process real data points
    const processedPoints = rawChartData
      .filter((item: any) => item.metric_key === metricKey)
      .map((item: any) => ({
        ts: item.ts,
        value: parseFloat(item.value) || 0,
        is_goal: item.is_goal
      }))
      .sort((a: any, b: any) => a.ts.localeCompare(b.ts));

    // Group by date to combine actual and goal values
    const dataByDate: Record<string, any> = {};
    
    processedPoints.forEach((item: any) => {
      const dateKey = item.ts.split('T')[0];
      if (!dataByDate[dateKey]) {
        dataByDate[dateKey] = {};
      }
      
      if (item.is_goal) {
        dataByDate[dateKey].goal = item.value;
      } else {
        dataByDate[dateKey].actual = item.value;
      }
    });

    // Convert to chart format with appropriate date formatting based on period type
    return Object.entries(dataByDate)
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, data]: [string, any]) => {
        let periodLabel = '';
        
        // Format period label based on period type
        switch (periodType) {
          case 'weekly':
          case 'monthly':
            periodLabel = format(new Date(date), 'MMM dd');
            break;
          case 'quarterly':
            periodLabel = format(new Date(date), 'MMM dd');
            break;
          case 'yearly':
            periodLabel = format(new Date(date), 'MMM');
            break;
          default:
            periodLabel = format(new Date(date), 'MMM dd');
        }
        
        return {
          period: periodLabel,
          actual: data.actual !== undefined ? data.actual : null,
          goal: data.goal !== undefined ? data.goal : null,
          isCurrent: true
        };
      });
  }, [rawChartData, metricKey]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-gray-500">Loading chart data...</div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-red-500">Error loading chart data</div>
      </div>
    );
  }

  // Show no data state
  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-sm text-gray-500">No chart data available</div>
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
          formatter={(value: any) => {
            if (typeof value === 'number') {
              return formatNumber(value);
            }
            return value;
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
          dot={{ fill: '#10b981', strokeWidth: 2, r: 2 }}
          name="Actual"
          connectNulls={false} // Don't connect lines across null values (future dates)
        />
      </LineChart>
    </ResponsiveContainer>
  );
}