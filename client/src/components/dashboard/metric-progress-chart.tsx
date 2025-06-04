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

// Adaptive calculations to match the main component
function getAdaptiveActual(yearlyValue: string, timePeriod: string, metricId: number) {
  const yearly = parseFloat(yearlyValue.replace(/[$,]/g, ''));
  
  const performanceMultipliers: Record<string, Record<number, number>> = {
    weekly: {
      1: 1.3, 2: 0.8, 3: 1.1, 4: 0.9, 5: 1.4, 6: 1.2, 7: 1.1, 8: 1.5, 9: 0.7, 10: 0.8, 11: 0.9, 12: 1.3
    },
    monthly: {
      1: 1.1, 2: 0.95, 3: 1.05, 4: 1.0, 5: 1.2, 6: 1.1, 7: 0.9, 8: 1.2, 9: 0.85, 10: 0.9, 11: 1.05, 12: 1.1
    },
    quarterly: {
      1: 1.05, 2: 0.98, 3: 1.08, 4: 0.95, 5: 1.1, 6: 1.08, 7: 0.95, 8: 1.15, 9: 0.9, 10: 0.85, 11: 1.02, 12: 1.05
    }
  };
  
  const multiplier = performanceMultipliers[timePeriod]?.[metricId] || 1.0;
  
  switch (timePeriod) {
    case "weekly":
      return (yearly / 52) * multiplier;
    case "monthly":
      return (yearly / 12) * multiplier;
    case "quarterly":
      return (yearly / 4) * multiplier;
    case "ytd":
    default:
      return yearly;
  }
}

// Generate progress data based on metric and time period
function generateProgressData(metric: any, timePeriod: string = "ytd") {
  const currentValueStr = metric?.value || metric?.currentValue || "0";
  const yearlyGoalStr = metric?.yearlyGoal || "0";
  const metricId = metric?.id || metric?.metricId || 1;
  
  const yearlyGoal = parseFloat(yearlyGoalStr.replace(/[$,%\s]/g, '')) || 100;
  const currentValue = getAdaptiveActual(currentValueStr, timePeriod, metricId);
  
  if (isNaN(currentValue) || isNaN(yearlyGoal) || yearlyGoal <= 0) {
    return [];
  }

  switch (timePeriod) {
    case "weekly":
      return generateWeeklyData(currentValue, yearlyGoal);
    case "monthly":
      return generateMonthlyData(currentValue, yearlyGoal);
    case "quarterly":
      return generateQuarterlyData(currentValue, yearlyGoal);
    case "ytd":
    default:
      return generateYTDData(currentValue, yearlyGoal);
  }
}

function generateWeeklyData(currentValue: number, yearlyGoal: number) {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyGoal = yearlyGoal / 52;
  const dailyGoal = weeklyGoal / 7;
  const currentDay = new Date().getDay();
  const currentDayIndex = currentDay === 0 ? 6 : currentDay - 1;
  
  return weekdays.map((day, index) => {
    const cumulativeGoal = dailyGoal * (index + 1);
    const cumulativeActual = index <= currentDayIndex ? (currentValue / 7) * (index + 1) : null;
    
    return {
      period: day,
      goal: Math.round(cumulativeGoal),
      actual: cumulativeActual ? Math.round(cumulativeActual) : null,
      isCurrent: index === currentDayIndex
    };
  });
}

function generateMonthlyData(currentValue: number, yearlyGoal: number) {
  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  
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