import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Calendar } from "lucide-react";
import MetricProgressChart from "./metric-progress-chart";
import NorthStarMetrics from "./north-star-metrics";
import type { KpiMetric } from "@/../../shared/schema";

interface MetricsOverviewProps {
  onRefresh: () => void;
}

// Default metrics for initial display
const defaultMetrics = [
  {
    id: 1,
    name: "Annual Recurring Revenue",
    value: "$3,200,000",
    yearlyGoal: "$3,000,000",
    goalProgress: "107",
    changePercent: "+15%",
    category: "revenue",
    format: "currency",
    priority: 1,
    isIncreasing: true,
    description: "Total yearly recurring revenue from subscriptions"
  },
  {
    id: 2,
    name: "Monthly Recurring Revenue",
    value: "$180,000",
    yearlyGoal: "$200,000",
    goalProgress: "90",
    changePercent: "+8%",
    category: "revenue",
    format: "currency",
    priority: 2,
    isIncreasing: true,
    description: "Monthly recurring revenue from subscriptions"
  },
  {
    id: 3,
    name: "Customer Acquisition Cost",
    value: "$180",
    yearlyGoal: "$120",
    goalProgress: "67",
    changePercent: "-3%",
    category: "efficiency",
    format: "currency",
    priority: 3,
    isIncreasing: false,
    description: "Average cost to acquire a new customer"
  },
  {
    id: 4,
    name: "Customer Lifetime Value",
    value: "$2,400",
    yearlyGoal: "$3,200",
    goalProgress: "75",
    changePercent: "+12%",
    category: "revenue",
    format: "currency",
    priority: 4,
    isIncreasing: true,
    description: "Average revenue per customer over their lifetime"
  },
  {
    id: 5,
    name: "Monthly Churn Rate",
    value: "3.2%",
    yearlyGoal: "1.5%",
    goalProgress: "47",
    changePercent: "+0.8%",
    category: "retention",
    format: "percentage",
    priority: 5,
    isIncreasing: false,
    description: "Percentage of customers who cancel each month"
  },
  {
    id: 6,
    name: "Net Revenue Retention",
    value: "132%",
    yearlyGoal: "125%",
    goalProgress: "106",
    changePercent: "+7%",
    category: "retention",
    format: "percentage",
    priority: 6,
    isIncreasing: true,
    description: "Revenue growth from existing customers"
  },
  {
    id: 7,
    name: "Daily Active Users",
    value: "38,400",
    yearlyGoal: "60,000",
    goalProgress: "64",
    changePercent: "+12%",
    category: "growth",
    format: "number",
    priority: 7,
    isIncreasing: true,
    description: "Number of users active in the last 24 hours"
  },
  {
    id: 8,
    name: "Lead Conversion Rate",
    value: "17.8%",
    yearlyGoal: "15%",
    goalProgress: "119",
    changePercent: "+4.2%",
    category: "growth",
    format: "percentage",
    priority: 8,
    isIncreasing: true,
    description: "Percentage of leads that convert to customers"
  },
  {
    id: 9,
    name: "Average Deal Size",
    value: "$6,200",
    yearlyGoal: "$10,000",
    goalProgress: "62",
    changePercent: "-8%",
    category: "revenue",
    format: "currency",
    priority: 9,
    isIncreasing: false,
    description: "Average value of closed deals"
  },
  {
    id: 10,
    name: "Sales Cycle Length",
    value: "28 days",
    yearlyGoal: "35 days",
    goalProgress: "125",
    changePercent: "-12 days",
    category: "efficiency",
    format: "number",
    priority: 10,
    isIncreasing: true,
    description: "Average time from lead to closed deal"
  },
  {
    id: 11,
    name: "Customer Satisfaction Score",
    value: "4.1/5",
    yearlyGoal: "4.5/5",
    goalProgress: "91",
    changePercent: "-0.1",
    category: "retention",
    format: "number",
    priority: 11,
    isIncreasing: false,
    description: "Average customer satisfaction rating"
  },
  {
    id: 12,
    name: "Product Adoption Rate",
    value: "52%",
    yearlyGoal: "75%",
    goalProgress: "69",
    changePercent: "+2%",
    category: "growth",
    format: "percentage",
    priority: 12,
    isIncreasing: true,
    description: "Percentage of users actively using key features"
  }
];

export default function MetricsOverview({ onRefresh }: MetricsOverviewProps) {
  const [timePeriod, setTimePeriod] = useState("ytd");
  
  const { data: kpiMetrics, isLoading } = useQuery({
    queryKey: ["/api/kpi-metrics"],
  });

  const metrics = (kpiMetrics && Array.isArray(kpiMetrics) && kpiMetrics.length > 0) ? kpiMetrics : defaultMetrics;

  // Time period options
  const timePeriodOptions = [
    { value: "weekly", label: "Weekly View" },
    { value: "monthly", label: "Monthly View" }, 
    { value: "quarterly", label: "Quarterly View" },
    { value: "ytd", label: "Year to Date" }
  ];

  // Helper function to get time period label
  const getTimePeriodLabel = () => {
    const option = timePeriodOptions.find(opt => opt.value === timePeriod);
    return option?.label || "Year to Date";
  };

  // Helper functions for adaptive goals
  const getAdaptiveGoal = (yearlyGoal: string, timePeriod: string) => {
    const yearlyValue = parseFloat(yearlyGoal.replace(/[$,]/g, ''));
    
    switch (timePeriod) {
      case "weekly":
        return formatGoalValue(yearlyValue / 52);
      case "monthly":
        return formatGoalValue(yearlyValue / 12);
      case "quarterly":
        return formatGoalValue(yearlyValue / 4);
      case "ytd":
      default:
        return formatGoalValue(yearlyValue);
    }
  };

  const formatGoalValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    } else {
      return `$${Math.round(value).toLocaleString()}`;
    }
  };

  const getTimePeriodLabelShort = (period: string) => {
    switch (period) {
      case "weekly": return "weekly";
      case "monthly": return "monthly";
      case "quarterly": return "quarterly";
      case "ytd": return "annual";
      default: return "annual";
    }
  };

  const getAdaptiveProgress = (currentValue: string, yearlyGoal: string, timePeriod: string, metricId: number) => {
    const current = getAdaptiveActual(currentValue, timePeriod, metricId);
    const yearly = parseFloat(yearlyGoal.replace(/[$,]/g, ''));
    
    let periodGoal: number;
    switch (timePeriod) {
      case "weekly":
        periodGoal = yearly / 52;
        break;
      case "monthly":
        periodGoal = yearly / 12;
        break;
      case "quarterly":
        periodGoal = yearly / 4;
        break;
      case "ytd":
      default:
        periodGoal = yearly;
        break;
    }
    
    return periodGoal > 0 ? Math.round((current / periodGoal) * 100) : 0;
  };

  const getAdaptiveActual = (yearlyValue: string, timePeriod: string, metricId: number) => {
    const yearly = parseFloat(yearlyValue.replace(/[$,]/g, ''));
    
    // Create realistic business scenarios where short-term performance differs from yearly
    const performanceMultipliers: Record<string, Record<number, number>> = {
      weekly: {
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
      monthly: {
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
      quarterly: {
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
      case "weekly":
        return (yearly / 52) * multiplier;
      case "monthly":
        return (yearly / 12) * multiplier;
      case "quarterly":
        return (yearly / 4) * multiplier;
      case "ytd":
      default:
        return yearly; // Full yearly value (no multiplier for YTD)
    }
  };

  const formatActualValue = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    } else if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`;
    } else {
      return `$${Math.round(value).toLocaleString()}`;
    }
  };

  // Dynamic gradient backgrounds based on performance
  const getMetricGradient = (progress: number) => {
    if (progress >= 100) {
      return "bg-gradient-to-br from-green-50 via-emerald-50 to-green-100 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-green-800/30";
    } else if (progress >= 90) {
      return "bg-gradient-to-br from-blue-50 via-cyan-50 to-blue-100 dark:from-blue-900/20 dark:via-cyan-900/20 dark:to-blue-800/30";
    } else if (progress >= 75) {
      return "bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-100 dark:from-yellow-900/20 dark:via-amber-900/20 dark:to-yellow-800/30";
    } else if (progress >= 50) {
      return "bg-gradient-to-br from-orange-50 via-orange-50 to-orange-100 dark:from-orange-900/20 dark:via-orange-900/20 dark:to-orange-800/30";
    } else {
      return "bg-gradient-to-br from-red-50 via-rose-50 to-red-100 dark:from-red-900/20 dark:via-rose-900/20 dark:to-red-800/30";
    }
  };

  // Dynamic border colors based on performance
  const getMetricBorder = (progress: number) => {
    if (progress >= 100) {
      return "border-green-200 dark:border-green-700";
    } else if (progress >= 90) {
      return "border-blue-200 dark:border-blue-700";
    } else if (progress >= 75) {
      return "border-yellow-200 dark:border-yellow-700";
    } else if (progress >= 50) {
      return "border-orange-200 dark:border-orange-700";
    } else {
      return "border-red-200 dark:border-red-700";
    }
  };

  // Group metrics by category
  const metricsByCategory = metrics.reduce((acc: any, metric: any) => {
    const category = metric.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(metric);
    return acc;
  }, {});

  // Calculate overall performance
  const overallProgress = metrics.length > 0 ? 
    Math.round(metrics.reduce((sum: number, metric: any) => 
      sum + parseFloat(metric.goalProgress || "0"), 0) / metrics.length) : 0;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Business Metrics</h2>
          <Button variant="outline" size="sm" disabled>
            <RefreshCw className="h-4 w-4 mr-2" />
            Loading...
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="h-64 animate-pulse">
              <CardContent className="p-6">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-2 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* North Star Metrics */}
      <NorthStarMetrics />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Business Metrics</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Overall performance: {overallProgress}% of goals achieved
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-600" />
            <Select value={timePeriod} onValueChange={setTimePeriod}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {timePeriodOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={onRefresh} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tabs for different categories */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Metrics</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="growth">Growth</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {metrics.map((metric: any) => {
              const progress = getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id);
              return (
              <Card key={metric.id} className={`relative overflow-hidden border-2 hover:shadow-lg transition-all duration-300 ${getMetricGradient(progress)} ${getMetricBorder(progress)}`}>
                {/* Goal progress indicator */}
                <div className={`absolute top-0 left-0 w-full h-1 ${
                  getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id) >= 100 ? 'bg-green-500' : 
                  getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id) >= 90 ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                        {metric.name}
                      </CardTitle>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {metric.description}
                      </p>
                    </div>
                    <div className={`ml-2 flex items-center text-xs font-medium px-2 py-1 rounded-full ${
                      getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id) >= 100 ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 
                      getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id) >= 90 ? 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30' :
                      'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                    }`}>
                      {getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id) >= 100 ? '↗' : getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id) >= 90 ? '→' : '↘'} {getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id)}% to goal
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  {/* Current Value */}
                  <div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {formatActualValue(getAdaptiveActual(metric.value, timePeriod, metric.id))}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      vs. {getAdaptiveGoal(metric.yearlyGoal, timePeriod)} {getTimePeriodLabelShort(timePeriod)} goal
                    </div>
                  </div>
                  


                  {/* Chart */}
                  <div className="h-32 -mx-2">
                    <MetricProgressChart metric={metric} timePeriod={timePeriod} />
                  </div>
                </CardContent>
              </Card>
            )})}
          </div>
        </TabsContent>

        {Object.entries(metricsByCategory).map(([category, categoryMetrics]: [string, any]) => (
          <TabsContent key={category} value={category} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(categoryMetrics as any[]).map((metric: any) => (
                <Card key={metric.id} className="relative overflow-hidden border hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-800">
                  {/* Goal progress indicator */}
                  <div className={`absolute top-0 left-0 w-full h-1 ${
                    getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id) >= 100 ? 'bg-green-500' : 
                    getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id) >= 90 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                          {metric.name}
                        </CardTitle>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {metric.description}
                        </p>
                      </div>
                      <div className={`ml-2 flex items-center text-xs font-medium px-2 py-1 rounded-full ${
                        getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id) >= 100 ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 
                        getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id) >= 90 ? 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30' :
                        'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                      }`}>
                        {getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id) >= 100 ? '↗' : getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id) >= 90 ? '→' : '↘'} {getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id)}% to goal
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    {/* Current Value */}
                    <div>
                      <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {formatActualValue(getAdaptiveActual(metric.value, timePeriod, metric.id))}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        vs. {getAdaptiveGoal(metric.yearlyGoal, timePeriod)} {getTimePeriodLabelShort(timePeriod)} goal
                      </div>
                    </div>
                    


                    {/* Chart */}
                    <div className="h-32 -mx-2">
                      <MetricProgressChart metric={metric} timePeriod={timePeriod} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}