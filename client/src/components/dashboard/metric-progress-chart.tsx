import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { KpiMetric } from '@shared/schema';

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

interface ChartDataPoint {
  period: string;
  goal: number;
  actual: number | null;
  isCurrent: boolean;
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
  
  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const monthlyGoal = yearlyGoal / 12;
  const dailyGoal = monthlyGoal / daysInMonth;
  
  return allDays.map((day, index) => {
    const cumulativeGoal = dailyGoal * day;
    const cumulativeActual = day <= currentDay ? (currentValue / daysInMonth) * day : null;
    
    return {
      period: day.toString(),
      goal: Math.round(cumulativeGoal),
      actual: cumulativeActual ? Math.round(cumulativeActual) : null,
      isCurrent: day === currentDay
    };
  });
}

function generateQuarterlyData(currentValue: number, yearlyGoal: number) {
  const today = new Date();
  const currentQuarter = Math.floor(today.getMonth() / 3) + 1;
  const quarterStartMonth = (currentQuarter - 1) * 3;
  const quarterStart = new Date(today.getFullYear(), quarterStartMonth, 1);
  const quarterEnd = new Date(today.getFullYear(), quarterStartMonth + 3, 0);
  
  // Generate all weeks in the quarter
  const weeks: Date[] = [];
  const currentWeekStart = new Date(quarterStart);
  
  // Find the Monday of the first week of the quarter
  const dayOfWeek = currentWeekStart.getDay();
  currentWeekStart.setDate(currentWeekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  
  while (currentWeekStart <= quarterEnd) {
    weeks.push(new Date(currentWeekStart));
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }
  
  const weeklyGoal = yearlyGoal / 52;
  
  return weeks.map((weekStart, index) => {
    const cumulativeGoal = weeklyGoal * (index + 1);
    const actualValue = weekStart <= today ? (currentValue / weeks.length) * (index + 1) : null;
    
    const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    
    return {
      period: weekLabel,
      goal: Math.round(cumulativeGoal),
      actual: actualValue !== null ? Math.round(actualValue) : null,
      isCurrent: index === weeks.length - 1
    };
  });
}

function generateYTDData(currentValue: number, yearlyGoal: number) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyGoal = yearlyGoal / 12;
  const currentMonth = new Date().getMonth();
  
  return months.map((month, index) => {
    const cumulativeGoal = monthlyGoal * (index + 1);
    const cumulativeActual = index <= currentMonth ? (currentValue / (currentMonth + 1)) * (index + 1) : null;
    
    return {
      period: month,
      goal: Math.round(cumulativeGoal),
      actual: cumulativeActual ? Math.round(cumulativeActual) : null,
      isCurrent: index === currentMonth
    };
  });
}

export default function MetricProgressChart({ metric, timePeriod = "ytd" }: MetricProgressChartProps) {
  const data = generateProgressData(metric, timePeriod);
  
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
        <span className="text-sm">No data available</span>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
          stroke="#3b82f6" 
          strokeWidth={3}
          dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
          name="Actual"
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}