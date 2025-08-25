import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { KpiMetric } from '@shared/schema';

interface MetricProgressChartProps {
  metric: Partial<KpiMetric>;
  timePeriod?: string;
  timeSeriesData?: any[]; // Real time-series data from API
}

interface ChartDataPoint {
  period: string;
  goal: number;
  actual: number | null;
  isCurrent: boolean;
}

// Format currency values for chart axes
function formatCurrencyValue(value: number): string {
  if (!value && value !== 0) return '$0';
  
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  } else {
    return `$${Math.round(value).toLocaleString()}`;
  }
}

// Get appropriate X-axis interval for different time periods
function getXAxisInterval(timePeriod: string, data: ChartDataPoint[]): number | "preserveStartEnd" {
  if (!data || data.length === 0) return "preserveStartEnd";
  
  switch (timePeriod) {
    case "monthly":
      // For monthly data (31 days), show every 5th day to avoid crowding
      return Math.floor(data.length / 6) || 4;
    case "quarterly":
      // For quarterly data, show fewer ticks
      return Math.floor(data.length / 8) || 1;
    case "weekly":
    case "daily":
      // For weekly/daily, show all days
      return 0;
    case "ytd":
    default:
      // For yearly data (12 months), show every other month
      return Math.floor(data.length / 6) || 1;
  }
}

// Adaptive calculations to EXACTLY match the main Business Metrics component  
function getAdaptiveActual(yearlyValue: number, timePeriod: string, metricId: number) {
  const yearly = yearlyValue;
  
  // Use EXACT same performance multipliers as Business Metrics main component
  const performanceMultipliers: Record<string, Record<number, number>> = {
    "daily": {
      1: 1.1,   // ARR: Good daily performance
      2: 0.9,   // MRR: Slightly behind today
      3: 1.05,  // CAC: A bit higher today
      4: 1.0,   // LTV: On track today
      5: 1.3,   // Churn: Higher churn today
      6: 1.1,   // NRR: Strong daily retention
      7: 0.95,  // DAU: Slower today
      8: 1.2,   // Conversion: Strong conversion today
      9: 0.8,   // Deal size: Smaller deals today
      10: 0.9,  // Sales cycle: Faster today
      11: 1.02, // CSAT: Slightly better today
      12: 1.1   // Adoption: Good daily progress
    },
    "weekly": {
      1: 1.3,   // ARR: Strong weekly performance
      2: 0.8,   // MRR: Weak this week
      3: 1.1,   // CAC: Slightly higher cost this week
      4: 0.9,   // LTV: Lower this week
      5: 1.4,   // Churn: Much worse this week
      6: 1.2,   // NRR: Strong weekly retention
      7: 1.1,   // DAU: Good week for users
      8: 1.5,   // Conversion: Excellent week
      9: 0.7,   // Deal size: Smaller deals this week
      10: 0.8,  // Sales cycle: Faster this week (better)
      11: 0.9,  // CSAT: Lower this week
      12: 1.3   // Adoption: Great weekly adoption
    },
    "monthly": {
      1: 1.1,   // ARR: Good monthly growth
      2: 0.95,  // MRR: Slightly behind this month
      3: 1.05,  // CAC: A bit higher this month
      4: 1.0,   // LTV: On track this month
      5: 1.2,   // Churn: Bad month for retention
      6: 1.1,   // NRR: Strong month
      7: 0.9,   // DAU: Slower month
      8: 1.2,   // Conversion: Strong conversion month
      9: 0.85,  // Deal size: Smaller deals this month
      10: 0.9,  // Sales cycle: Faster this month
      11: 1.05, // CSAT: Slightly better
      12: 1.1   // Adoption: Good monthly progress
    },
    "quarterly": {
      1: 1.05,  // ARR: Slightly ahead for quarter
      2: 0.98,  // MRR: A bit behind quarterly target
      3: 1.08,  // CAC: Higher costs this quarter
      4: 0.95,  // LTV: Lower this quarter
      5: 1.1,   // Churn: Higher churn this quarter
      6: 1.08,  // NRR: Good quarterly retention
      7: 0.95,  // DAU: Behind quarterly target
      8: 1.15,  // Conversion: Excellent quarter
      9: 0.9,   // Deal size: Smaller average deals
      10: 0.85, // Sales cycle: Much faster quarter
      11: 1.02, // CSAT: Slightly up
      12: 1.05  // Adoption: Steady quarterly growth
    }
  };
  
  const multiplier = performanceMultipliers[timePeriod]?.[metricId] || 1.0;
  
  switch (timePeriod) {
    case "daily":
      return (yearly / 365) * multiplier;
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

// Normalize time period to match Business Metrics format
function normalizeTimePeriod(timePeriod: string): string {
  switch (timePeriod?.toLowerCase()) {
    case "daily view":
    case "daily":
      return "daily";
    case "weekly view":  
    case "weekly":
      return "weekly";
    case "monthly view":
    case "monthly":
      return "monthly";
    case "quarterly view":
    case "quarterly":
      return "quarterly";
    case "yearly view":
    case "yearly":
    case "ytd":
    default:
      return "ytd";
  }
}

// Realistic performance patterns for different metrics (like North Star uses)
function getPerformancePattern(metricId: number) {
  // Different realistic business performance patterns for different metrics
  const patterns: Record<number, number[]> = {
    1: [0.75, 0.82, 0.88, 0.95, 1.02, 1.08, 1.15, 1.22, 1.18, 1.25, 1.32, 1.40], // ARR - growth pattern
    2: [0.65, 0.72, 0.79, 0.86, 0.93, 1.00, 1.07, 1.14, 1.10, 1.17, 1.24, 1.31], // MRR - steady growth
    3: [1.2, 1.1, 0.9, 1.0, 1.1, 0.8, 0.95, 1.05, 1.15, 0.9, 1.0, 1.1], // CAC - varies
    4: [0.8, 0.9, 1.0, 1.1, 1.2, 1.15, 1.25, 1.3, 1.2, 1.1, 1.0, 1.35], // LTV - improving
    5: [1.3, 1.2, 1.1, 0.9, 0.8, 1.0, 1.1, 0.95, 1.05, 1.2, 1.1, 0.85], // Churn - variable
    6: [0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.15, 1.1, 1.05, 1.3], // NRR - growth
  };
  
  // Default pattern if metric not found
  return patterns[metricId] || [0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.15, 1.1, 1.05, 1.0, 1.2];
}

// Generate progress data based on metric and time period
function generateProgressData(metric: Partial<KpiMetric>, timePeriod: string = "ytd") {
  const metricId = (metric as any).id || 1;
  const normalizedTimePeriod = normalizeTimePeriod(timePeriod);
  const performancePattern = getPerformancePattern(metricId);
  
  // Use raw values if available (from Business Metrics), otherwise use formatted values
  let currentValue: number;
  let yearlyGoal: number;
  
  if ((metric as any).rawCurrentValue !== undefined && (metric as any).rawYearlyGoal !== undefined) {
    // Use raw yearly values from Business Metrics - these are the actual yearly numbers
    currentValue = (metric as any).rawCurrentValue;
    yearlyGoal = (metric as any).rawYearlyGoal;
  } else {
    // Fallback to parsing formatted values (for backward compatibility)
    const currentValueStr = metric.value || "0";
    const yearlyGoalStr = metric.yearlyGoal || "0";
    currentValue = parseFloat(currentValueStr.replace(/[$,%\s]/g, '')) || 0;
    yearlyGoal = parseFloat(yearlyGoalStr.replace(/[$,%\s]/g, '')) || 100;
  }
  
  if (isNaN(currentValue) || isNaN(yearlyGoal) || yearlyGoal <= 0) {
    return [];
  }

  switch (normalizedTimePeriod) {
    case "daily":
      return generateDailyData(currentValue, yearlyGoal, performancePattern);
    case "weekly":
      return generateWeeklyData(currentValue, yearlyGoal, performancePattern);
    case "monthly":
      return generateMonthlyData(currentValue, yearlyGoal, performancePattern);
    case "quarterly":
      return generateQuarterlyData(currentValue, yearlyGoal, performancePattern);
    case "ytd":
    default:
      return generateYTDData(currentValue, yearlyGoal, performancePattern);
  }
}

function generateDailyData(currentValue: number, yearlyGoal: number, pattern: number[]) {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const currentDay = today.getDay();
  const currentDayIndex = currentDay === 0 ? 6 : currentDay - 1;
  
  const dailyGoal = yearlyGoal / 365;
  
  return weekdays.map((day, index) => {
    const dayProgress = dailyGoal * (index + 1);
    const performanceMultiplier = pattern[index % pattern.length] || 1.0;
    const actualValue = index <= currentDayIndex ? dayProgress * performanceMultiplier : null;
    
    return {
      period: day,
      goal: Math.round(dayProgress),
      actual: actualValue !== null ? Math.round(actualValue) : null,
      isCurrent: index === currentDayIndex
    };
  });
}

function generateWeeklyData(currentValue: number, yearlyGoal: number, pattern: number[]) {
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const today = new Date();
  const currentDay = today.getDay();
  const currentDayIndex = currentDay === 0 ? 6 : currentDay - 1;
  
  const dailyGoal = yearlyGoal / 365;
  
  return weekdays.map((day, index) => {
    const dayProgress = dailyGoal * (index + 1);
    const performanceMultiplier = pattern[index % pattern.length] || 1.0;
    const actualValue = index <= currentDayIndex ? dayProgress * performanceMultiplier : null;
    
    return {
      period: day,
      goal: Math.round(dayProgress),
      actual: actualValue !== null ? Math.round(actualValue) : null,
      isCurrent: index === currentDayIndex
    };
  });
}

function generateMonthlyData(currentValue: number, yearlyGoal: number, pattern: number[]) {
  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  
  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const dailyGoal = yearlyGoal / 365;
  
  return allDays.map((day, index) => {
    const dayProgress = dailyGoal * day;
    const performanceMultiplier = pattern[index % pattern.length] || 1.0;
    const actualValue = day <= currentDay ? dayProgress * performanceMultiplier : null;
    
    return {
      period: day.toString(),
      goal: Math.round(dayProgress),
      actual: actualValue !== null ? Math.round(actualValue) : null,
      isCurrent: day === currentDay
    };
  });
}

function generateQuarterlyData(currentValue: number, yearlyGoal: number, pattern: number[]) {
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
    const weekProgress = weeklyGoal * (index + 1);
    const performanceMultiplier = pattern[index % pattern.length] || 1.0;
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

function generateYTDData(currentValue: number, yearlyGoal: number, pattern: number[]) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthlyGoal = yearlyGoal / 12;
  const currentMonth = new Date().getMonth();
  
  return months.map((month, index) => {
    const cumulativeGoal = monthlyGoal * (index + 1);
    const performanceMultiplier = pattern[index % pattern.length] || 1.0;
    // Use cumulative pattern-based calculation for realistic curves
    const cumulativeActual = index <= currentMonth ? cumulativeGoal * performanceMultiplier : null;
    
    return {
      period: month,
      goal: Math.round(cumulativeGoal),
      actual: cumulativeActual ? Math.round(cumulativeActual) : null,
      isCurrent: index === currentMonth
    };
  });
}

export default function MetricProgressChart({ metric, timePeriod = "ytd", timeSeriesData }: MetricProgressChartProps) {
  // Use real time-series data if available, otherwise generate synthetic data
  const data = timeSeriesData && timeSeriesData.length > 0 
    ? timeSeriesData.map((point: any) => ({
        period: point.period,
        goal: Math.round(point.goal || 0),
        actual: point.actual !== null ? Math.round(point.actual) : null, // Preserve null to end line cleanly
        isCurrent: point.isCurrent || false
      }))
    : generateProgressData(metric, timePeriod);
  
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
          interval={getXAxisInterval(normalizeTimePeriod(timePeriod || "ytd"), data)}
        />
        <YAxis 
          tick={{ fontSize: 10 }}
          stroke="#6b7280"
          tickFormatter={(value) => formatCurrencyValue(value)}
        />
        <Tooltip 
          contentStyle={{
            backgroundColor: '#f9fafb',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '12px'
          }}
          formatter={(value: any, name: string) => [
            value !== null ? formatCurrencyValue(Number(value)) : 'No data',
            name === 'actual' ? 'Actual' : 'Goal'
          ]}
        />
        <Line 
          type="monotone" 
          dataKey="goal" 
          stroke="#9ca3af" 
          strokeDasharray="5 5" 
          strokeWidth={2}
          dot={false}
          name="Goal"
          connectNulls={true}
        />
        <Line 
          type="monotone" 
          dataKey="actual" 
          stroke="#3b82f6" 
          strokeWidth={3}
          dot={false}
          name="Actual"
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}