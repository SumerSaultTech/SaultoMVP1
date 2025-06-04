import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MetricProgressChartProps {
  metric: {
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
  };
  timePeriod: string;
}

// Get data for the selected time period using authentic calculated data
function getTimeSeriesData(metric: MetricProgressChartProps['metric'], timePeriod: string) {
  switch (timePeriod) {
    case "weekly":
      return metric.timeSeriesData.weekly || [];
    case "monthly":
      return metric.timeSeriesData.monthly || [];
    case "quarterly":
      return metric.timeSeriesData.quarterly || [];
    case "ytd":
      return metric.timeSeriesData.ytd || [];
    default:
      return metric.timeSeriesData.monthly || [];
  }
}

export default function MetricProgressChart({ metric, timePeriod }: MetricProgressChartProps) {
  const data = getTimeSeriesData(metric, timePeriod);
  
  if (!data || data.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-gray-500 text-sm">
        No data available for {timePeriod} view
      </div>
    );
  }

  const formatValue = (value: number): string => {
    if (metric.format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    } else if (metric.format === 'percentage') {
      return `${value.toFixed(1)}%`;
    } else {
      return new Intl.NumberFormat('en-US').format(value);
    }
  };

  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="period" 
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis 
            tick={{ fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={formatValue}
          />
          <Tooltip 
            formatter={(value: number, name: string) => [
              formatValue(value), 
              name === 'actual' ? 'Actual' : 'Goal'
            ]}
            labelStyle={{ fontSize: '12px' }}
            contentStyle={{ 
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '12px'
            }}
          />
          <Line 
            type="monotone" 
            dataKey="goal" 
            stroke="#9ca3af" 
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
          />
          <Line 
            type="monotone" 
            dataKey="actual" 
            stroke="#2563eb" 
            strokeWidth={2}
            dot={{ fill: '#2563eb', r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}