// Mock data service for dashboard demonstration
export interface MockMetricData {
  id: string;
  name: string;
  currentValue: number;
  yearlyGoal: number;
  format: 'currency' | 'percentage' | 'number';
  description: string;
  category: 'revenue' | 'profit' | 'customer' | 'operational';
}

export interface MockTimeSeriesData {
  period: string;
  actual: number;
  goal: number;
}

// Mock North Star metrics with realistic business scenarios
export const mockNorthStarMetrics: MockMetricData[] = [
  {
    id: 'annual-revenue',
    name: 'Annual Revenue',
    currentValue: 2850000, // $2.85M current
    yearlyGoal: 3500000,   // $3.5M goal
    format: 'currency',
    description: 'Total revenue for the current fiscal year',
    category: 'revenue'
  },
  {
    id: 'annual-profit',
    name: 'Annual Profit',
    currentValue: 485000,  // $485K current
    yearlyGoal: 700000,    // $700K goal
    format: 'currency',
    description: 'Net profit after all expenses for the current fiscal year',
    category: 'profit'
  }
];

// Mock KPI metrics for comprehensive dashboard
export const mockKPIMetrics: MockMetricData[] = [
  {
    id: 'monthly-recurring-revenue',
    name: 'Monthly Recurring Revenue',
    currentValue: 285000,
    yearlyGoal: 350000,
    format: 'currency',
    description: 'Predictable monthly revenue from subscriptions',
    category: 'revenue'
  },
  {
    id: 'customer-acquisition-cost',
    name: 'Customer Acquisition Cost',
    currentValue: 120,
    yearlyGoal: 100,
    format: 'currency',
    description: 'Average cost to acquire a new customer',
    category: 'customer'
  },
  {
    id: 'customer-lifetime-value',
    name: 'Customer Lifetime Value',
    currentValue: 2400,
    yearlyGoal: 2800,
    format: 'currency',
    description: 'Average revenue generated per customer over their lifetime',
    category: 'customer'
  },
  {
    id: 'churn-rate',
    name: 'Monthly Churn Rate',
    currentValue: 3.2,
    yearlyGoal: 2.5,
    format: 'percentage',
    description: 'Percentage of customers who cancel each month',
    category: 'customer'
  },
  {
    id: 'gross-margin',
    name: 'Gross Margin',
    currentValue: 78.5,
    yearlyGoal: 80.0,
    format: 'percentage',
    description: 'Revenue minus cost of goods sold as percentage',
    category: 'profit'
  },
  {
    id: 'conversion-rate',
    name: 'Lead Conversion Rate',
    currentValue: 12.8,
    yearlyGoal: 15.0,
    format: 'percentage',
    description: 'Percentage of leads that become paying customers',
    category: 'operational'
  },
  {
    id: 'active-users',
    name: 'Monthly Active Users',
    currentValue: 15600,
    yearlyGoal: 20000,
    format: 'number',
    description: 'Number of users active in the past 30 days',
    category: 'operational'
  },
  {
    id: 'revenue-per-user',
    name: 'Average Revenue Per User',
    currentValue: 18.25,
    yearlyGoal: 22.00,
    format: 'currency',
    description: 'Average monthly revenue generated per active user',
    category: 'revenue'
  },
  {
    id: 'net-promoter-score',
    name: 'Net Promoter Score',
    currentValue: 67,
    yearlyGoal: 75,
    format: 'number',
    description: 'Customer satisfaction and loyalty metric',
    category: 'operational'
  }
];

// Generate realistic time series data based on business patterns
export function generateMockTimeSeriesData(
  metric: MockMetricData, 
  timePeriod: 'weekly' | 'monthly' | 'quarterly' | 'ytd'
): MockTimeSeriesData[] {
  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);
  
  // Performance patterns that create realistic business scenarios
  const getPerformancePattern = (metricId: string): number[] => {
    const patterns = {
      'annual-revenue': [0.65, 0.72, 0.78, 0.85, 0.92, 0.98, 1.05, 1.12, 1.08, 1.15, 1.22, 1.30],
      'annual-profit': [0.55, 0.62, 0.68, 0.75, 0.82, 0.88, 0.95, 1.02, 0.98, 1.05, 1.12, 1.20],
      'monthly-recurring-revenue': [0.70, 0.76, 0.82, 0.88, 0.94, 1.00, 1.06, 1.12, 1.08, 1.14, 1.20, 1.26],
      'customer-acquisition-cost': [1.25, 1.18, 1.12, 1.08, 1.05, 1.02, 0.98, 0.95, 0.92, 0.88, 0.85, 0.82],
      'customer-lifetime-value': [0.75, 0.80, 0.85, 0.88, 0.92, 0.95, 0.98, 1.02, 1.05, 1.08, 1.12, 1.15],
      'churn-rate': [1.35, 1.28, 1.22, 1.18, 1.12, 1.08, 1.05, 1.02, 0.98, 0.95, 0.92, 0.88],
      'gross-margin': [0.92, 0.94, 0.95, 0.96, 0.97, 0.98, 0.99, 1.00, 1.01, 1.02, 1.03, 1.04],
      'conversion-rate': [0.80, 0.84, 0.88, 0.91, 0.94, 0.97, 1.00, 1.03, 1.06, 1.09, 1.12, 1.15],
      'active-users': [0.70, 0.75, 0.80, 0.85, 0.88, 0.92, 0.96, 1.00, 1.04, 1.08, 1.12, 1.16],
      'revenue-per-user': [0.75, 0.78, 0.82, 0.86, 0.89, 0.93, 0.97, 1.01, 1.05, 1.09, 1.13, 1.17],
      'net-promoter-score': [0.85, 0.87, 0.89, 0.91, 0.93, 0.95, 0.97, 0.99, 1.01, 1.03, 1.05, 1.07]
    };
    return patterns[metricId] || [0.8, 0.85, 0.9, 0.92, 0.95, 0.98, 1.0, 1.02, 1.05, 1.08, 1.1, 1.12];
  };

  const pattern = getPerformancePattern(metric.id);

  switch (timePeriod) {
    case 'weekly':
      return generateWeeklyData(metric, pattern);
    case 'monthly':
      return generateMonthlyData(metric, pattern);
    case 'quarterly':
      return generateQuarterlyData(metric, pattern);
    case 'ytd':
    default:
      return generateYTDData(metric, pattern);
  }
}

function generateWeeklyData(metric: MockMetricData, pattern: number[]): MockTimeSeriesData[] {
  const today = new Date();
  const currentWeek = getWeekNumber(today);
  const weeks = [];
  
  for (let week = 1; week <= Math.min(currentWeek + 4, 52); week++) {
    const weekStart = getDateFromWeek(week, today.getFullYear());
    const weekGoal = metric.yearlyGoal / 52;
    const performanceMultiplier = pattern[(week - 1) % 12] || 1.0;
    
    weeks.push({
      period: `W${week}`,
      goal: Math.round(weekGoal * week),
      actual: week <= currentWeek ? Math.round(weekGoal * week * performanceMultiplier) : 0
    });
  }
  
  return weeks;
}

function generateMonthlyData(metric: MockMetricData, pattern: number[]): MockTimeSeriesData[] {
  const today = new Date();
  const currentMonth = today.getMonth();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const data = [];
  
  for (let month = 0; month <= Math.min(currentMonth + 2, 11); month++) {
    const monthlyGoal = metric.yearlyGoal / 12;
    const performanceMultiplier = pattern[month] || 1.0;
    
    data.push({
      period: months[month],
      goal: Math.round(monthlyGoal * (month + 1)),
      actual: month <= currentMonth ? Math.round(monthlyGoal * (month + 1) * performanceMultiplier) : 0
    });
  }
  
  return data;
}

function generateQuarterlyData(metric: MockMetricData, pattern: number[]): MockTimeSeriesData[] {
  const today = new Date();
  const currentQuarter = Math.floor(today.getMonth() / 3);
  const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
  const data = [];
  
  for (let quarter = 0; quarter <= Math.min(currentQuarter + 1, 3); quarter++) {
    const quarterlyGoal = metric.yearlyGoal / 4;
    const performanceMultiplier = pattern[quarter * 3] || 1.0;
    
    data.push({
      period: quarters[quarter],
      goal: Math.round(quarterlyGoal * (quarter + 1)),
      actual: quarter <= currentQuarter ? Math.round(quarterlyGoal * (quarter + 1) * performanceMultiplier) : 0
    });
  }
  
  return data;
}

function generateYTDData(metric: MockMetricData, pattern: number[]): MockTimeSeriesData[] {
  const today = new Date();
  const currentMonth = today.getMonth();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const data = [];
  
  for (let month = 0; month <= 11; month++) {
    const monthlyGoal = metric.yearlyGoal / 12;
    const cumulativeGoal = monthlyGoal * (month + 1);
    const performanceMultiplier = pattern[month] || 1.0;
    
    data.push({
      period: months[month],
      goal: Math.round(cumulativeGoal),
      actual: month <= currentMonth ? Math.round(cumulativeGoal * performanceMultiplier) : 0
    });
  }
  
  return data;
}

// Utility functions
function getWeekNumber(date: Date): number {
  const firstDay = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDay.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDay.getDay() + 1) / 7);
}

function getDateFromWeek(week: number, year: number): Date {
  const firstDay = new Date(year, 0, 1);
  const daysToAdd = (week - 1) * 7 - firstDay.getDay();
  return new Date(year, 0, 1 + daysToAdd);
}

// Export service functions
export const mockDataService = {
  getNorthStarMetrics: () => mockNorthStarMetrics,
  getKPIMetrics: () => mockKPIMetrics,
  getTimeSeriesData: generateMockTimeSeriesData,
  
  // Get current YTD progress for a metric
  getYTDProgress: (metric: MockMetricData) => {
    const ytdData = generateMockTimeSeriesData(metric, 'ytd');
    const latestPoint = ytdData.filter(point => point.actual > 0).pop();
    
    if (!latestPoint) return { current: 0, goal: 0, progress: 0 };
    
    return {
      current: latestPoint.actual,
      goal: latestPoint.goal,
      progress: Math.round((latestPoint.actual / latestPoint.goal) * 100)
    };
  },
  
  // Format values based on metric type
  formatValue: (value: number, format: string): string => {
    if (format === 'currency') {
      if (value >= 1000000) {
        return `$${(value / 1000000).toFixed(1)}M`;
      } else if (value >= 1000) {
        return `$${(value / 1000).toFixed(0)}K`;
      } else {
        return `$${value.toLocaleString()}`;
      }
    } else if (format === 'percentage') {
      return `${value.toFixed(1)}%`;
    } else {
      return value.toLocaleString();
    }
  }
};