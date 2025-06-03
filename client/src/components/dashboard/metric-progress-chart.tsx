import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { KpiMetric } from '@shared/schema';

interface MetricProgressChartProps {
  metric: Partial<KpiMetric>;
  timePeriod?: string;
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
  const currentWeek = Math.floor((new Date().getTime() - new Date(new Date().getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;
  const weeks = Array.from({ length: Math.min(currentWeek, 12) }, (_, i) => `W${i + 1}`);
  
  const performancePattern = getPerformancePattern(metric.name || '');
  const weeklyGoal = yearlyGoal / 52;
  
  return weeks.map((week, index) => {
    const weekNumber = index + 1;
    const goalProgress = weeklyGoal * weekNumber;
    const performanceMultiplier = performancePattern[index % 12] || 1.0;
    const actualValue = goalProgress * performanceMultiplier;
    
    return {
      period: week,
      goal: Math.round(goalProgress),
      actual: Math.round(actualValue),
      isCurrent: weekNumber === currentWeek
    };
  });
}

function generateMonthlyData(metric: Partial<KpiMetric>, currentValue: number, yearlyGoal: number) {
  const currentMonth = new Date().getMonth() + 1;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const performancePattern = getPerformancePattern(metric.name || '');
  const monthlyGoal = yearlyGoal / 12;
  
  return months.slice(0, currentMonth).map((month, index) => {
    const monthNumber = index + 1;
    const goalProgress = monthlyGoal * monthNumber;
    const performanceMultiplier = performancePattern[index] || 1.0;
    const actualValue = goalProgress * performanceMultiplier;
    
    return {
      period: month,
      goal: Math.round(goalProgress),
      actual: Math.round(actualValue),
      isCurrent: monthNumber === currentMonth
    };
  });
}

function generateQuarterlyData(metric: Partial<KpiMetric>, currentValue: number, yearlyGoal: number) {
  const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  
  const performancePattern = getPerformancePattern(metric.name || '');
  const quarterlyGoal = yearlyGoal / 4;
  
  return quarters.slice(0, currentQuarter).map((quarter, index) => {
    const quarterNumber = index + 1;
    const goalProgress = quarterlyGoal * quarterNumber;
    const performanceMultiplier = performancePattern[index * 3] || 1.0;
    const actualValue = goalProgress * performanceMultiplier;
    
    return {
      period: quarter,
      goal: Math.round(goalProgress),
      actual: Math.round(actualValue),
      isCurrent: quarterNumber === currentQuarter
    };
  });
}

function generateYTDData(metric: Partial<KpiMetric>, currentValue: number, yearlyGoal: number) {
  const currentMonth = new Date().getMonth() + 1;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const performancePattern = getPerformancePattern(metric.name || '');
  
  return months.slice(0, currentMonth).map((month, index) => {
    const monthNumber = index + 1;
    const goalProgress = (yearlyGoal / 12) * monthNumber;
    const performanceMultiplier = performancePattern[index] || 1.0;
    const actualValue = goalProgress * performanceMultiplier;
    
    return {
      period: month,
      goal: Math.round(goalProgress),
      actual: Math.round(actualValue),
      isCurrent: monthNumber === currentMonth
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
  if (value >= 1000000000) {
    return `$${(value / 1000000000).toFixed(1)}B`;
  } else if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  } else {
    return `$${value.toFixed(0)}`;
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

function getProgressStatus(actual: number, goal: number) {
  const percentage = goal > 0 ? (actual / goal) * 100 : 0;
  
  if (percentage >= 95) return { status: 'on-track', color: 'bg-green-500', textColor: 'text-green-700' };
  if (percentage >= 80) return { status: 'at-risk', color: 'bg-yellow-500', textColor: 'text-yellow-700' };
  return { status: 'behind', color: 'bg-red-500', textColor: 'text-red-700' };
}

export default function MetricProgressChart({ metric, timePeriod = "ytd" }: MetricProgressChartProps) {
  const progressData = generateProgressData(metric, timePeriod);
  const currentData = progressData[progressData.length - 1];
  const goalProgress = parseFloat(metric.goalProgress || "0");
  
  if (!currentData) return null;

  const progressStatus = getProgressStatus(currentData.actual, currentData.goal);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border p-6 space-y-4">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            {metric.name || 'Metric'}
          </h3>
          {metric.description && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {metric.description}
            </p>
          )}
        </div>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${progressStatus.color} text-white`}>
          {progressStatus.status}
        </div>
      </div>

      {/* Current Value */}
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {formatValue(currentData.actual, metric.format)}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            of {formatValue(currentData.goal, metric.format)} goal
          </div>
        </div>
        
        {metric.changePercent && (
          <div className={`flex items-center text-sm font-medium ${
            parseFloat(metric.changePercent) >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {parseFloat(metric.changePercent) >= 0 ? '↗' : '↘'} {Math.abs(parseFloat(metric.changePercent))}%
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>Progress</span>
          <span>{Math.round((currentData.actual / currentData.goal) * 100)}%</span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${progressStatus.color}`}
            style={{ width: `${Math.min((currentData.actual / currentData.goal) * 100, 100)}%` }}
          />
        </div>
      </div>

      {/* Chart */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {timePeriod === 'weekly' ? 'Weekly Progress' : 
           timePeriod === 'monthly' ? 'Monthly Progress' :
           timePeriod === 'quarterly' ? 'Quarterly Progress' : 'Year-to-Date Progress'}
        </h4>
        
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={progressData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="period"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: '#6b7280' }}
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
                formatValue(value, metric.format),
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
            />
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="#3b82f6" 
              strokeWidth={3}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                return payload?.isCurrent ? (
                  <circle cx={cx} cy={cy} r={6} fill="#3b82f6" stroke="#fff" strokeWidth={2} />
                ) : (
                  <circle cx={cx} cy={cy} r={3} fill="#3b82f6" />
                );
              }}
              name="actual"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}