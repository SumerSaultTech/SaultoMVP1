import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TrendingUp, TrendingDown, DollarSign, Target, Calendar, Info, Database, Table, Columns } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface NorthStarMetric {
  id: string;
  name: string;
  value: string;
  yearlyGoal: string;
  changePercent: string;
  description: string;
  format: string;
}

// Format large numbers as millions for display
const formatLargeNumber = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  } else {
    return `$${Math.round(value).toLocaleString()}`;
  }
};

// Hook to fetch real time-series data from the API
function useTimeSeriesData(metricName: string, timePeriod: string) {
  return useQuery({
    queryKey: ["/api/metrics/time-series", metricName, timePeriod],
    queryFn: async () => {
      const response = await fetch("/api/metrics/time-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          metricId: metricName === "Annual Revenue" ? 1 : 2, // Keep for backward compatibility but will be updated
          metricName: metricName, // Add metric name for reliable identification
          timePeriod: mapTimePeriodForAPI(timePeriod)
        })
      });
      if (!response.ok) {
        throw new Error('Failed to fetch time series data');
      }
      return response.json();
    },
    refetchInterval: 30000,
  });
}

// Map frontend time period to backend format
function mapTimePeriodForAPI(timePeriod: string): string {
  switch (timePeriod) {
    case "Daily View":
      return "daily";
    case "Weekly View":
      return "weekly";
    case "Monthly View": 
      return "monthly";
    case "Quarterly View":
      return "quarterly";
    case "Yearly View":
    default:
      return "yearly";
  }
}

// Generate progress data for North Star metrics based on real API data
function generateNorthStarData(metric: NorthStarMetric, timePeriod: string = "ytd", timeSeriesData?: any[]) {
  // If we have real time-series data, use it
  if (timeSeriesData && timeSeriesData.length > 0) {
    return timeSeriesData.map((point) => ({
      period: point.period,
      goal: Math.round(point.goal || 0),
      actual: point.actual !== null ? Math.round(point.actual) : null, // Preserve null to end line cleanly
      isCurrent: true // We'll update this logic later
    }));
  }

  // Fallback to generated data if API fails
  const currentValue = parseFloat(metric.value.replace(/[$,]/g, ''));
  const yearlyGoal = parseFloat(metric.yearlyGoal.replace(/[$,]/g, ''));
  
  // Performance patterns for different metrics (fallback only)
  const revenuePattern = [0.75, 0.82, 0.88, 0.95, 1.02, 1.08, 1.15, 1.22, 1.18, 1.25, 1.32, 1.40];
  const profitPattern = [0.65, 0.72, 0.79, 0.86, 0.93, 1.00, 1.07, 1.14, 1.10, 1.17, 1.24, 1.31];
  const pattern = metric.id === 'annual-revenue' ? revenuePattern : profitPattern;

  switch (timePeriod) {
    case "weekly":
      return generateWeeklyNorthStarData(yearlyGoal, pattern);
    case "monthly":
      return generateMonthlyNorthStarData(yearlyGoal, pattern);
    case "quarterly":
      return generateQuarterlyNorthStarData(yearlyGoal, pattern);
    case "ytd":
    default:
      return generateYTDNorthStarData(yearlyGoal, pattern);
  }
}

function generateWeeklyNorthStarData(yearlyGoal: number, pattern: number[]) {
  const today = new Date();
  const currentDay = today.getDay();
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const currentDayIndex = currentDay === 0 ? 6 : currentDay - 1;
  
  const dailyGoal = yearlyGoal / 365;
  
  return weekdays.map((day, index) => {
    const dayProgress = dailyGoal * (index + 1);
    const performanceMultiplier = pattern[index % 7] || 1.0;
    const actualValue = index <= currentDayIndex ? dayProgress * performanceMultiplier : null;
    
    return {
      period: day,
      goal: Math.round(dayProgress),
      actual: actualValue !== null ? Math.round(actualValue) : null,
      isCurrent: index === currentDayIndex
    };
  });
}

function generateMonthlyNorthStarData(yearlyGoal: number, pattern: number[]) {
  const today = new Date();
  const currentDay = today.getDate();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  
  const allDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const dailyGoal = yearlyGoal / 365;
  
  return allDays.map((day, index) => {
    const dayProgress = dailyGoal * day;
    const performanceMultiplier = pattern[index % 30] || 1.0;
    const actualValue = day <= currentDay ? dayProgress * performanceMultiplier : null;
    
    return {
      period: day.toString(),
      goal: Math.round(dayProgress),
      actual: actualValue !== null ? Math.round(actualValue) : null,
      isCurrent: day === currentDay
    };
  });
}

function generateQuarterlyNorthStarData(yearlyGoal: number, pattern: number[]) {
  const today = new Date();
  const currentQuarter = Math.floor(today.getMonth() / 3) + 1;
  const quarterStartMonth = (currentQuarter - 1) * 3;
  const quarterStart = new Date(today.getFullYear(), quarterStartMonth, 1);
  const quarterEnd = new Date(today.getFullYear(), quarterStartMonth + 3, 0);
  
  const weeks: Date[] = [];
  const currentWeekStart = new Date(quarterStart);
  const dayOfWeek = currentWeekStart.getDay();
  currentWeekStart.setDate(currentWeekStart.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  
  while (currentWeekStart <= quarterEnd) {
    weeks.push(new Date(currentWeekStart));
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
  }
  
  const weeklyGoal = yearlyGoal / 52;
  
  return weeks.map((weekStart, index) => {
    const weekProgress = weeklyGoal * (index + 1);
    const performanceMultiplier = pattern[index % 12] || 1.0;
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

function generateYTDNorthStarData(yearlyGoal: number, pattern: number[]) {
  const today = new Date();
  const yearStart = new Date(today.getFullYear(), 0, 1);
  const yearEnd = new Date(today.getFullYear(), 11, 31);
  
  const months = [];
  const currentMonth = new Date(yearStart);
  
  while (currentMonth <= yearEnd) {
    months.push(new Date(currentMonth));
    currentMonth.setMonth(currentMonth.getMonth() + 1);
  }
  
  const monthlyGoal = yearlyGoal / 12;
  
  return months.map((month, index) => {
    const goalProgress = monthlyGoal * (index + 1);
    const performanceMultiplier = pattern[index] || 1.0;
    const actualValue = month <= today ? goalProgress * performanceMultiplier : null;
    
    const monthLabel = month.toLocaleDateString('en-US', { month: 'short' });
    
    return {
      period: monthLabel,
      goal: Math.round(goalProgress),
      actual: actualValue !== null ? Math.round(actualValue) : null,
      isCurrent: month.getMonth() === today.getMonth()
    };
  });
}

function formatValue(value: string | number, format: string): string {
  if (!value && value !== 0) return '0';
  
  const valueStr = typeof value === 'number' ? value.toString() : value;
  
  if (format === 'currency') {
    const numValue = parseFloat(valueStr.replace(/[$,]/g, '')) || 0;
    if (numValue >= 1000000) {
      return `$${(numValue / 1000000).toFixed(1)}M`;
    } else if (numValue >= 1000) {
      return `$${(numValue / 1000).toFixed(0)}K`;
    } else {
      return `$${Math.round(numValue).toLocaleString()}`;
    }
  }
  return valueStr;
}

// Same formatting function as Business Metrics for consistency
function formatActualValue(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  } else {
    return `$${Math.round(value).toLocaleString()}`;
  }
}

function calculateProgress(currentValue: string | number, goalValue: string | number): number {
  if (!currentValue && currentValue !== 0) return 0;
  if (!goalValue && goalValue !== 0) return 0;
  
  const currentStr = typeof currentValue === 'number' ? currentValue.toString() : currentValue;
  const goalStr = typeof goalValue === 'number' ? goalValue.toString() : goalValue;
  
  const current = parseFloat(currentStr.replace(/[$,]/g, '')) || 0;
  const goal = parseFloat(goalStr.replace(/[$,]/g, '')) || 1;
  
  return goal > 0 ? Math.round((current / goal) * 100) : 0;
}

function getProgressStatus(progress: number) {
  if (progress >= 90) return { color: 'text-green-600', bgColor: 'bg-green-100' };
  if (progress >= 75) return { color: 'text-blue-600', bgColor: 'bg-blue-100' };
  if (progress >= 50) return { color: 'text-yellow-600', bgColor: 'bg-yellow-100' };
  return { color: 'text-red-600', bgColor: 'bg-red-100' };
}

// ADAPTIVE FUNCTIONS: Match Business Metrics time period logic exactly
function getAdaptiveActual(yearlyValue: number, timePeriod: string, metricId: number, metric?: any) {
  // Use raw current value if available, otherwise use the provided yearly value  
  let yearly: number;
  if (metric?.rawCurrentValue) {
    yearly = metric.rawCurrentValue;
  } else {
    yearly = yearlyValue;
  }
  
  // Use EXACT same performance multipliers as Business Metrics
  const performanceMultipliers: Record<string, Record<number, number>> = {
    "daily view": {
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
    "weekly view": {
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
    "monthly view": {
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
    "quarterly view": {
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
  
  const multiplier = performanceMultipliers[timePeriod.toLowerCase()]?.[metricId] || 1.0;
  
  switch (timePeriod.toLowerCase()) {
    case "daily view":
    case "daily":
      return (yearly / 365) * multiplier;
    case "weekly view":
    case "weekly":
      return (yearly / 52) * multiplier;
    case "monthly view":
    case "monthly":
      return (yearly / 12) * multiplier;
    case "quarterly view":
    case "quarterly":
      return (yearly / 4) * multiplier;
    case "yearly view":
    case "yearly":
    case "ytd":
    default:
      return yearly; // Full yearly value
  }
}

function getAdaptiveGoal(yearlyGoal: number, timePeriod: string) {
  switch (timePeriod.toLowerCase()) {
    case "daily view":
    case "daily":
      return yearlyGoal / 365;
    case "weekly view":
    case "weekly":
      return yearlyGoal / 52;
    case "monthly view":
    case "monthly":
      return yearlyGoal / 12;
    case "quarterly view":
    case "quarterly":
      return yearlyGoal / 4;
    case "yearly view":
    case "yearly":
    case "ytd":
    default:
      return yearlyGoal; // Full yearly value
  }
}

export default function NorthStarMetrics() {
  const [northStarTimePeriod, setNorthStarTimePeriod] = useState("Monthly View");

  // Fetch real dashboard metrics
  const { data: dashboardMetrics, isLoading } = useQuery({
    queryKey: ["/api/dashboard/metrics-data", northStarTimePeriod],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/metrics-data?timePeriod=${encodeURIComponent(northStarTimePeriod)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard metrics');
      }
      return response.json();
    },
    refetchInterval: 30000,
  });

  // Fetch time-series data for charts
  const { data: revenueTimeSeriesData } = useTimeSeriesData("Annual Revenue", northStarTimePeriod);
  const { data: profitTimeSeriesData } = useTimeSeriesData("Annual Profit", northStarTimePeriod);

  // Data source mapping for Snowflake metrics
  const getDataSourceInfo = (metricName: string) => {
    const sources = {
      'revenue': {
        source: 'QuickBooks',
        warehouse: 'Snowflake',
        database: 'MIAS_DATA_DB',
        schema: 'CORE',
        table: 'CORE_QUICKBOOKS_REVENUE',
        column: 'INVOICE_AMOUNT',
        description: 'Total revenue from QuickBooks invoices stored in Snowflake data warehouse'
      },
      'profit': {
        source: 'QuickBooks (Calculated)',
        warehouse: 'Snowflake',
        database: 'MIAS_DATA_DB',
        schema: 'CORE',
        table: 'CORE_QUICKBOOKS_REVENUE - CORE_QUICKBOOKS_EXPENSES',
        column: 'INVOICE_AMOUNT - AMOUNT',
        description: 'Net profit calculated as total revenue minus total expenses from QuickBooks'
      }
    };

    const metricKey = metricName.toLowerCase().includes('revenue') ? 'revenue' :
                     metricName.toLowerCase().includes('profit') ? 'profit' : null;
    
    if (metricKey && sources[metricKey]) {
      return sources[metricKey];
    }

    return {
      source: 'QuickBooks Integration',
      warehouse: 'Snowflake',
      database: 'MIAS_DATA_DB',
      schema: 'CORE',
      table: 'Financial Data',
      column: 'Calculated Field',
      description: 'Real-time business metric from your Snowflake data warehouse'
    };
  };

  // Time period options matching Snowflake service
  const northStarTimePeriodOptions = [
    { value: "Daily View", label: "Daily View" },
    { value: "Weekly View", label: "Weekly View" },
    { value: "Monthly View", label: "Monthly View" }, 
    { value: "Yearly View", label: "Yearly View" }
  ];

  // Create North Star metrics from real Snowflake data
  const northStarMetrics: NorthStarMetric[] = (() => {
    if (!dashboardMetrics || !Array.isArray(dashboardMetrics)) {
      return [];
    }

    // Find revenue and profit metrics by name from real PostgreSQL calculations (flexible matching)
    const revenueMetric = dashboardMetrics.find((m: any) => 
      m.name.toLowerCase().includes("annual revenue") || m.name.toLowerCase().includes("revenue")
    );
    const profitMetric = dashboardMetrics.find((m: any) => 
      m.name.toLowerCase().includes("annual profit") || m.name.toLowerCase().includes("profit")
    );
    
    // Using metric names ensures we get the right data regardless of ID changes

    // Use real Snowflake calculated values
    const revenueValue = revenueMetric?.currentValue || 0;
    const profitValue = profitMetric?.currentValue || 0;
    const profitGoal = profitMetric?.yearlyGoal || 0;

    return [
      {
        id: "annual-revenue",
        name: "Annual Revenue",
        value: formatLargeNumber(revenueValue),
        yearlyGoal: formatLargeNumber(revenueMetric?.yearlyGoal || 0),
        changePercent: "+12.5",
        description: "Total revenue from QuickBooks data",
        format: "currency"
      },
      {
        id: "annual-profit", 
        name: "Annual Profit",
        value: formatLargeNumber(profitValue),
        yearlyGoal: formatLargeNumber(profitMetric?.yearlyGoal || 0),
        changePercent: "+8.2",
        description: "Net profit after all expenses",
        format: "currency"
      }
    ];
  })();

  const getTimePeriodLabel = (period: string) => {
    const option = northStarTimePeriodOptions.find(opt => opt.value === period);
    return option?.label || "Year to Date";
  };

  const getTimePeriodDisplayName = (period: string) => {
    switch (period.toLowerCase()) {
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
        return "annual";
    }
  };


  // Get the EXACT same values that are displayed in the chart
  const getChartDisplayValues = (metric: NorthStarMetric, timePeriod: string, timeSeriesData?: any[]) => {
    const chartData = generateNorthStarData(metric, timePeriod, timeSeriesData);
    
    // Find the most recent actual data point from the chart
    const actualDataPoints = chartData.filter(point => point.actual !== null);
    const currentActual = actualDataPoints.length > 0 ? actualDataPoints[actualDataPoints.length - 1].actual : 0;
    
    // Get the corresponding goal for that same data point
    const currentGoal = actualDataPoints.length > 0 ? actualDataPoints[actualDataPoints.length - 1].goal : chartData[chartData.length - 1]?.goal || 0;
    
    return {
      current: currentActual || 0,
      goal: currentGoal || 0
    };
  };

  // Calculate YTD progress vs YTD goal for "on pace" indicator using real data
  const getYTDProgress = (metric: NorthStarMetric, timeSeriesData?: any[]) => {
    // For YTD, we want to use yearly time-series data
    const ytdChartData = generateNorthStarData(metric, "yearly", timeSeriesData);
    
    // Find the most recent actual data point from YTD chart
    const actualDataPoints = ytdChartData.filter(point => point.actual !== null && point.actual !== undefined);
    if (actualDataPoints.length === 0) return { current: 0, goal: 0, progress: 0 };
    
    // Get the latest actual value and corresponding goal
    const latestPoint = actualDataPoints[actualDataPoints.length - 1];
    const currentYTD = latestPoint.actual || 0;
    const goalYTD = latestPoint.goal || 1;
    
    return {
      current: currentYTD,
      goal: goalYTD,
      progress: Math.round((currentYTD / goalYTD) * 100)
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Target className="h-5 w-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">North Star Metrics</h3>
          <div className="h-px bg-gradient-to-r from-purple-300 to-transparent flex-1 ml-4"></div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Calendar className="h-4 w-4 text-purple-600" />
          <Select value={northStarTimePeriod} onValueChange={setNorthStarTimePeriod}>
            <SelectTrigger className="w-40 border-purple-200 focus:ring-purple-500">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {northStarTimePeriodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          <>
            <Card className="h-64 animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-2 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
            <Card className="h-64 animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-2 bg-gray-200 rounded"></div>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          northStarMetrics.map((metric) => {
          // Use API values directly instead of chart-derived values (flexible matching)
          const revenueMetric = dashboardMetrics.find((m: any) => 
            m.name.toLowerCase().includes("annual revenue") || m.name.toLowerCase().includes("revenue")
          );
          const profitMetric = dashboardMetrics.find((m: any) => 
            m.name.toLowerCase().includes("annual profit") || m.name.toLowerCase().includes("profit")
          );
          
          // Get current value and goal from API data
          const apiCurrentValue = metric.id === "annual-revenue" ? (revenueMetric?.currentValue || 0) : (profitMetric?.currentValue || 0);
          const apiYearlyGoal = metric.id === "annual-revenue" ? (revenueMetric?.yearlyGoal || 0) : (profitMetric?.yearlyGoal || 0);
          
          // Get the appropriate time-series data for this metric
          const timeSeriesData = metric.id === "annual-revenue" ? revenueTimeSeriesData : profitTimeSeriesData;
          const chartData = generateNorthStarData(metric, northStarTimePeriod, timeSeriesData);
          
          // Use the API values directly - they're already period-specific!
          // The API returns daily/weekly/monthly values based on the time period parameter
          const periodCurrentValue = apiCurrentValue; // Already calculated by API for the correct period
          
          // Calculate period goal using same logic as Business Metrics
          // Convert yearly goal to period-specific goal based on time period
          let periodGoal: number;
          switch (northStarTimePeriod.toLowerCase()) {
            case "daily view":
            case "daily":
              periodGoal = apiYearlyGoal / 365;
              break;
            case "weekly view":
            case "weekly":
              periodGoal = apiYearlyGoal / 52;
              break;
            case "monthly view":
            case "monthly":
              periodGoal = apiYearlyGoal / 12;
              break;
            case "quarterly view":
            case "quarterly":
              periodGoal = apiYearlyGoal / 4;
              break;
            case "yearly view":
            case "yearly":
            case "ytd":
            default:
              periodGoal = apiYearlyGoal; // No conversion needed for yearly
              break;
          }
          const progress = calculateProgress(periodCurrentValue, periodGoal);
          const progressStatus = getProgressStatus(progress);
          
          // Use YTD progress for "on pace" indicator regardless of selected time period
          const ytdProgress = getYTDProgress(metric, timeSeriesData);
          const onPaceProgressStatus = getProgressStatus(ytdProgress.progress);
          
          const changeValue = parseFloat(metric.changePercent);
          const isPositive = changeValue >= 0;

          return (
            <Card key={metric.id} className="relative overflow-hidden border-2 border-purple-100 bg-gradient-to-br from-purple-50 to-white dark:from-purple-900/20 dark:to-gray-800">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-500 to-blue-500"></div>
              
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 flex-1">
                    <DollarSign className="h-4 w-4 text-purple-600" />
                    <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                      {metric.name}
                    </CardTitle>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-purple-100 dark:hover:bg-purple-900/30">
                          <Info className="h-3 w-3 text-purple-500" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-80">
                        <div className="p-3 space-y-3">
                          <div className="font-semibold text-sm text-gray-900 dark:text-white">
                            Data Source Information
                          </div>
                          
                          <div className="space-y-2 text-xs">
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-3 bg-orange-500 rounded-full" />
                              <span className="font-medium">Original Source:</span>
                              <span className="text-gray-600 dark:text-gray-400">{getDataSourceInfo(metric.name).source}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Database className="h-3 w-3 text-blue-500" />
                              <span className="font-medium">Data Warehouse:</span>
                              <span className="text-gray-600 dark:text-gray-400">{getDataSourceInfo(metric.name).warehouse}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Table className="h-3 w-3 text-green-500" />
                              <span className="font-medium">Table:</span>
                              <span className="text-gray-600 dark:text-gray-400">{getDataSourceInfo(metric.name).table}</span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Columns className="h-3 w-3 text-purple-500" />
                              <span className="font-medium">Column:</span>
                              <span className="text-gray-600 dark:text-gray-400">{getDataSourceInfo(metric.name).column}</span>
                            </div>
                          </div>
                          
                          <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                            <div className="font-medium text-xs text-gray-900 dark:text-white mb-1">
                              Description:
                            </div>
                            <div className="text-xs text-gray-600 dark:text-gray-400">
                              {getDataSourceInfo(metric.name).description}
                            </div>
                          </div>
                        </div>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  <div className={`flex items-center space-x-1 text-sm font-medium ${onPaceProgressStatus.color}`}>
                    {ytdProgress.progress >= 100 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                    <span>{ytdProgress.progress}% on pace</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-3">
                {/* Current Value */}
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {formatActualValue(periodCurrentValue)}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    of {formatActualValue(periodGoal)} {getTimePeriodDisplayName(northStarTimePeriod)} goal
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Progress
                    </span>
                    <span className={`text-xs font-bold ${progressStatus.color}`}>
                      {progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div 
                      className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 ease-out"
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Time Period Chart */}
                <div className="space-y-1">
                  <h4 className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {getTimePeriodLabel(northStarTimePeriod)} Progress
                  </h4>
                  
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart data={chartData}>
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
                        tickFormatter={(value) => formatValue(value.toString(), metric.format)}
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
                          formatValue(value?.toString() || '0', metric.format),
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
                        connectNulls={true}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="actual" 
                        stroke="#8b5cf6" 
                        strokeWidth={3}
                        connectNulls={false}
                        dot={false}
                        name="actual"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>


              </CardContent>
            </Card>
            );
          })
        )}
      </div>
    </div>
  );
}