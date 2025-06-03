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
function generateProgressData(metric: Partial<KpiMetric>, timePeriod: string = "ytd") {
  const currentValueStr = metric.value || "0";
  const yearlyGoalStr = metric.yearlyGoal || "0";
  const metricId = (metric as any).id || 1;
  
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
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  const weeklyGoal = yearlyGoal / 52;
  const dailyGoal = weeklyGoal / 5;
  
  return weekdays.map((day, index) => {
    const isToday = index === 4; // Friday is current for demo
    return {
      period: day,
      goal: Math.round(dailyGoal * (index + 1)),
      actual: index <= 4 ? Math.round((currentValue / 5) * (index + 1)) : null,
      isCurrent: isToday
    };
  });
}

function generateMonthlyData(currentValue: number, yearlyGoal: number) {
  const weeks = ['Week 1', 'Week 2', 'Week 3', 'Week 4'];
  const monthlyGoal = yearlyGoal / 12;
  const weeklyGoal = monthlyGoal / 4;
  
  return weeks.map((week, index) => {
    const isCurrentWeek = index === 3; // Week 4 is current for demo
    return {
      period: week,
      goal: Math.round(weeklyGoal * (index + 1)),
      actual: index <= 3 ? Math.round((currentValue / 4) * (index + 1)) : null,
      isCurrent: isCurrentWeek
    };
  });
}

function generateQuarterlyData(currentValue: number, yearlyGoal: number) {
  const months = ['Jan-Mar', 'Apr-Jun', 'Jul-Sep', 'Oct-Dec'];
  const quarterlyGoal = yearlyGoal / 4;
  
  return months.map((month, index) => {
    const isCurrentQuarter = index === 2; // Q3 is current for demo
    return {
      period: month,
      goal: Math.round(quarterlyGoal * (index + 1)),
      actual: index <= 2 ? Math.round((currentValue / 3) * (index + 1)) : null,
      isCurrent: isCurrentQuarter
    };
  });
}

function generateYTDData(currentValue: number, yearlyGoal: number) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyGoal = yearlyGoal / 12;
  const currentMonth = new Date().getMonth();
  
  // Generate monthly progression showing individual month performance
  return months.map((month, index) => {
    const isCurrentMonth = index === currentMonth;
    const monthlyActual = index <= currentMonth ? monthlyGoal * (0.8 + Math.random() * 0.4) : null; // Varied monthly performance
    
    return {
      period: month,
      goal: Math.round(monthlyGoal),
      actual: monthlyActual ? Math.round(monthlyActual) : null,
      isCurrent: isCurrentMonth
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