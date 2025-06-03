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
    value: "$2,400,000",
    yearlyGoal: "$3,000,000",
    goalProgress: "80",
    changePercent: "+12%",
    category: "revenue",
    format: "currency",
    priority: 1,
    isIncreasing: true,
    description: "Total yearly recurring revenue from subscriptions"
  },
  {
    id: 2,
    name: "Monthly Recurring Revenue",
    value: "$200,000",
    yearlyGoal: "$250,000",
    goalProgress: "80",
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
    value: "$150",
    yearlyGoal: "$120",
    goalProgress: "75",
    changePercent: "-5%",
    category: "efficiency",
    format: "currency",
    priority: 3,
    isIncreasing: false,
    description: "Average cost to acquire a new customer"
  },
  {
    id: 4,
    name: "Customer Lifetime Value",
    value: "$2,800",
    yearlyGoal: "$3,200",
    goalProgress: "88",
    changePercent: "+15%",
    category: "revenue",
    format: "currency",
    priority: 4,
    isIncreasing: true,
    description: "Average revenue per customer over their lifetime"
  },
  {
    id: 5,
    name: "Monthly Churn Rate",
    value: "2.1%",
    yearlyGoal: "1.5%",
    goalProgress: "70",
    changePercent: "-0.3%",
    category: "retention",
    format: "percentage",
    priority: 5,
    isIncreasing: false,
    description: "Percentage of customers who cancel each month"
  },
  {
    id: 6,
    name: "Net Revenue Retention",
    value: "118%",
    yearlyGoal: "125%",
    goalProgress: "94",
    changePercent: "+3%",
    category: "retention",
    format: "percentage",
    priority: 6,
    isIncreasing: true,
    description: "Revenue growth from existing customers"
  },
  {
    id: 7,
    name: "Daily Active Users",
    value: "45,200",
    yearlyGoal: "60,000",
    goalProgress: "75",
    changePercent: "+18%",
    category: "growth",
    format: "number",
    priority: 7,
    isIncreasing: true,
    description: "Number of users active in the last 24 hours"
  },
  {
    id: 8,
    name: "Lead Conversion Rate",
    value: "12.5%",
    yearlyGoal: "15%",
    goalProgress: "83",
    changePercent: "+2%",
    category: "growth",
    format: "percentage",
    priority: 8,
    isIncreasing: true,
    description: "Percentage of leads that convert to customers"
  },
  {
    id: 9,
    name: "Average Deal Size",
    value: "$8,500",
    yearlyGoal: "$10,000",
    goalProgress: "85",
    changePercent: "+10%",
    category: "revenue",
    format: "currency",
    priority: 9,
    isIncreasing: true,
    description: "Average value of closed deals"
  },
  {
    id: 10,
    name: "Sales Cycle Length",
    value: "45 days",
    yearlyGoal: "35 days",
    goalProgress: "78",
    changePercent: "-3 days",
    category: "efficiency",
    format: "number",
    priority: 10,
    isIncreasing: false,
    description: "Average time from lead to closed deal"
  },
  {
    id: 11,
    name: "Customer Satisfaction Score",
    value: "4.3/5",
    yearlyGoal: "4.5/5",
    goalProgress: "96",
    changePercent: "+0.2",
    category: "retention",
    format: "number",
    priority: 11,
    isIncreasing: true,
    description: "Average customer satisfaction rating"
  },
  {
    id: 12,
    name: "Product Adoption Rate",
    value: "68%",
    yearlyGoal: "75%",
    goalProgress: "91",
    changePercent: "+5%",
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

  const getAdaptiveProgress = (currentValue: string, yearlyGoal: string, timePeriod: string) => {
    const current = parseFloat(currentValue.replace(/[$,]/g, ''));
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
            {metrics.map((metric: any) => (
              <Card key={metric.id} className="relative overflow-hidden border hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-800">
                {/* Priority indicator */}
                <div className={`absolute top-0 left-0 w-full h-1 ${
                  metric.priority === 1 ? 'bg-red-500' : 
                  metric.priority === 2 ? 'bg-orange-500' : 
                  metric.priority === 3 ? 'bg-yellow-500' : 'bg-green-500'
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
                      getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod) >= 100 ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 
                      getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod) >= 90 ? 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30' :
                      'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                    }`}>
                      {getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod) >= 100 ? '↗' : getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod) >= 90 ? '→' : '↘'} {getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod)}% to goal
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  {/* Current Value */}
                  <div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {metric.value}
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

        {Object.entries(metricsByCategory).map(([category, categoryMetrics]: [string, any]) => (
          <TabsContent key={category} value={category} className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(categoryMetrics as any[]).map((metric: any) => (
                <Card key={metric.id} className="relative overflow-hidden border hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-800">
                  {/* Priority indicator */}
                  <div className={`absolute top-0 left-0 w-full h-1 ${
                    metric.priority === 1 ? 'bg-red-500' : 
                    metric.priority === 2 ? 'bg-orange-500' : 
                    metric.priority === 3 ? 'bg-yellow-500' : 'bg-green-500'
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
                        getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod) >= 100 ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 
                        getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod) >= 90 ? 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30' :
                        'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                      }`}>
                        {getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod) >= 100 ? '↗' : getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod) >= 90 ? '→' : '↘'} {getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod)}% to goal
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-0">
                    {/* Current Value */}
                    <div>
                      <div className="text-3xl font-bold text-gray-900 dark:text-white">
                        {metric.value}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        vs. {metric.yearlyGoal} goal
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