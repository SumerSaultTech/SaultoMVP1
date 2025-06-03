import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { KpiMetric } from '@shared/schema';

interface MetricProgressChartProps {
  metric: Partial<KpiMetric>;
  timePeriod?: string;
}

interface ChartDataPoint {
  period: string;
  goal: number;
  actual: number | null;
  isCurrent: boolean;
}

// Generate progress data based on metric and time period
function generateProgressData(metric: Partial<KpiMetric>, timePeriod: string = "ytd") {
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

  // Generate different data based on time period
  switch (timePeriod) {
    case "weekly":
      return generateWeeklyData(metric, currentValue, yearlyGoal);
    case "monthly":
      return generateMonthlyData(metric, currentValue, yearlyGoal);
    case "quarterly":
      return generateQuarterlyData(metric, currentValue, yearlyGoal);
    case "ytd":
    default:
      return generateYTDData(metric, currentValue, yearlyGoal);
  }
}

function generateWeeklyData(metric: Partial<KpiMetric>, currentValue: number, yearlyGoal: number) {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Show all weekdays for goal line, but actual only up to current day
  const currentDayIndex = currentDay === 0 ? 6 : currentDay - 1; // Convert to 0-6 where Mon=0
  
  const dailyGoal = yearlyGoal / 365; // Daily goal based on yearly target
  const performancePattern = getPerformancePattern(metric.name || '');
  
  return weekdays.map((day, index) => {
    const dayProgress = dailyGoal * (index + 1);
    const performanceMultiplier = performancePattern[index % 7] || 1.0;
    const actualValue = index <= currentDayIndex ? dayProgress * performanceMultiplier : null;
    
    return {
      period: day,
      goal: Math.round(dayProgress),
      actual: actualValue !== null ? Math.round(actualValue) : null,
      isCurrent: index === currentDayIndex
    };
  });
}

function generateMonthlyData(metric: Partial<KpiMetric>, currentValue: number, yearlyGoal: number) {
  const today = new Date();
  const currentDay = today.getDate(); // Current day of month (1-31)
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  
  // Show all days in month for goal line, but actual only up to today
  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  
  const dailyGoal = yearlyGoal / 365; // Daily goal based on yearly target
  const performancePattern = getPerformancePattern(metric.name || '');
  
  return allDays.map((day, index) => {
    const dayProgress = dailyGoal * day;
    const performanceMultiplier = performancePattern[index % 30] || 1.0;
    const actualValue = day <= currentDay ? dayProgress * performanceMultiplier : null;
    
    return {
      period: day.toString(),
      goal: Math.round(dayProgress),
      actual: actualValue !== null ? Math.round(actualValue) : null,
      isCurrent: day === currentDay
    };
  });
}

function generateQuarterlyData(metric: Partial<KpiMetric>, currentValue: number, yearlyGoal: number) {
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
  
  const weeklyGoal = yearlyGoal / 52; // Weekly goal based on yearly target
  const performancePattern = getPerformancePattern(metric.name || '');
  
  return weeks.map((weekStart, index) => {
    const weekProgress = weeklyGoal * (index + 1);
    const performanceMultiplier = performancePattern[index % 12] || 1.0;
    const actualValue = weekStart <= today ? weekProgress * performanceMultiplier : null;
    
    const weekLabel = `${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
    
    return {
      period: weekLabel,
      goal: Math.round(weekProgress),
      actual: actualValue !== null ? Math.round(actualValue) : null,
      isCurrent: weekStart <= today && (index === weeks.length - 1 || weeks[index + 1] > today)
    };
  });
}

function generateYTDData(metric: Partial<KpiMetric>, currentValue: number, yearlyGoal: number) {
  const today = new Date();
  const currentMonth = today.getMonth(); // 0-11
  const currentYear = today.getFullYear();
  
  // Generate all months in the year
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];
  
  const monthlyGoal = yearlyGoal / 12; // Monthly goal based on yearly target
  const performancePattern = getPerformancePattern(metric.name || '');
  
  return months.map((month, index) => {
    const monthProgress = monthlyGoal * (index + 1);
    const performanceMultiplier = performancePattern[index % 12] || 1.0;
    const actualValue = index <= currentMonth ? monthProgress * performanceMultiplier : null;
    
    return {
      period: month,
      goal: Math.round(monthProgress),
      actual: actualValue !== null ? Math.round(actualValue) : null,
      isCurrent: index === currentMonth
    };
  });
}

function getPerformancePattern(metricName: string) {
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
}

function formatValue(value: number, format: string | null | undefined): string {
  if (format === 'currency') {
    return formatCurrency(value);
  } else if (format === 'percentage') {
    return `${value.toFixed(1)}%`;
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

export default function MetricProgressChart({ metric, timePeriod = "ytd" }: MetricProgressChartProps) {
  const progressData = generateProgressData(metric, timePeriod);
  
  if (progressData.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={progressData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis 
          dataKey="period"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: '#6b7280' }}
        />
        <YAxis 
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: '#6b7280' }}
          tickFormatter={(value) => formatValue(value, metric.format)}
        />
        <Tooltip 
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
          }}
          labelFormatter={(period) => `${period}`}
          formatter={(value: any, name: string) => [
            formatValue(value?.toString() ? parseFloat(value.toString()) : 0, metric.format),
            name === 'actual' ? 'Actual' : 'Goal'
          ]}
        />
        <Line 
          type="monotone" 
          dataKey="goal" 
          stroke="#9ca3af" 
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={false}
          name="goal"
          connectNulls={false}
        />
        <Line 
          type="monotone" 
          dataKey="actual" 
          stroke="#3b82f6" 
          strokeWidth={2}
          connectNulls={false}
          dot={(props: any) => {
            const { cx, cy, payload } = props;
            if (!payload || payload.actual === null) return <g />;
            return payload?.isCurrent ? (
              <circle cx={cx} cy={cy} r={4} fill="#3b82f6" stroke="#fff" strokeWidth={2} />
            ) : (
              <circle cx={cx} cy={cy} r={2} fill="#3b82f6" />
            );
          }}
          name="actual"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}