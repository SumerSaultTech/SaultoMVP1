import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line } from 'recharts';

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

// Get data for the selected time period and calculate cumulative sums
function getCumulativeData(metric: MetricProgressChartProps['metric'], timePeriod: string) {
  let rawData: Array<{ period: string; actual: number; goal: number }> = [];
  
  switch (timePeriod) {
    case "weekly":
      rawData = metric.timeSeriesData.weekly || [];
      break;
    case "monthly":
      rawData = metric.timeSeriesData.monthly || [];
      break;
    case "quarterly":
      rawData = metric.timeSeriesData.quarterly || [];
      break;
    case "ytd":
      rawData = metric.timeSeriesData.ytd || [];
      break;
    default:
      rawData = metric.timeSeriesData.monthly || [];
  }

  // Calculate cumulative sums
  let cumulativeActual = 0;
  let cumulativeGoal = 0;
  
  return rawData.map((item) => {
    cumulativeActual += item.actual;
    cumulativeGoal += item.goal;
    
    return {
      period: item.period,
      actual: item.actual,
      goal: item.goal,
      cumulativeActual,
      cumulativeGoal,
      // Calculate cumulative percentage
      cumulativeProgress: cumulativeGoal > 0 ? (cumulativeActual / cumulativeGoal) * 100 : 0
    };
  });
}

export default function MetricProgressChart({ metric, timePeriod }: MetricProgressChartProps) {
  const data = getCumulativeData(metric, timePeriod);
  
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
        notation: 'compact',
        maximumFractionDigits: 1,
      }).format(value);
    }
    return new Intl.NumberFormat('en-US', { notation: 'compact' }).format(value);
  };

  const formatTooltipValue = (value: number): string => {
    if (metric.format === 'currency') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    }
    return new Intl.NumberFormat('en-US').format(value);
  };

  return (
    <div className="h-32">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id={`cumulativeGradient-${metric.metricId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
          <XAxis 
            dataKey="period" 
            axisLine={false}
            tickLine={false}
            fontSize={9}
            tick={{ fill: '#666' }}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            fontSize={9}
            tick={{ fill: '#666' }}
            tickFormatter={formatValue}
            domain={['dataMin', 'dataMax']}
          />
          <Tooltip 
            labelStyle={{ color: '#666', fontSize: '11px' }}
            contentStyle={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid #e2e8f0',
              borderRadius: '6px',
              fontSize: '11px',
              padding: '8px'
            }}
            formatter={(value: number, name: string) => {
              if (name === 'cumulativeActual') return [formatTooltipValue(value), 'Cumulative Total'];
              if (name === 'cumulativeGoal') return [formatTooltipValue(value), 'Cumulative Goal'];
              return [formatTooltipValue(value), name];
            }}
          />
          <Area
            type="monotone"
            dataKey="cumulativeActual"
            stroke="#8b5cf6"
            strokeWidth={2}
            fill={`url(#cumulativeGradient-${metric.metricId})`}
            dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}