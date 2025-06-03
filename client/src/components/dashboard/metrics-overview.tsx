import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Calendar } from "lucide-react";
import MetricProgressChart from "./metric-progress-chart";
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
    value: "$2,400",
    yearlyGoal: "$3,000",
    goalProgress: "80",
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
    value: "3.2%",
    yearlyGoal: "2.5%",
    goalProgress: "78",
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
    value: "115%",
    yearlyGoal: "120%",
    goalProgress: "96",
    changePercent: "+3%",
    category: "growth",
    format: "percentage",
    priority: 6,
    isIncreasing: true,
    description: "Revenue growth from existing customers"
  },
  {
    id: 7,
    name: "Monthly Active Users",
    value: "12,500",
    yearlyGoal: "15,000",
    goalProgress: "83",
    changePercent: "+7%",
    category: "growth",
    format: "number",
    priority: 7,
    isIncreasing: true,
    description: "Users who actively used the product this month"
  },
  {
    id: 8,
    name: "Lead Conversion Rate",
    value: "4.2%",
    yearlyGoal: "5.0%",
    goalProgress: "84",
    changePercent: "+0.5%",
    category: "efficiency",
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

  // Adjust metrics based on time period
  const adjustMetricsForTimePeriod = (originalMetrics: any[]) => {
    return originalMetrics.map(metric => {
      let adjustedMetric = { ...metric };
      
      switch (timePeriod) {
        case "weekly":
          // For weekly view, show weekly targets and values
          adjustedMetric.value = getWeeklyValue(metric.value);
          adjustedMetric.yearlyGoal = getWeeklyGoal(metric.yearlyGoal);
          adjustedMetric.goalProgress = calculateWeeklyProgress(metric.value, metric.yearlyGoal);
          break;
        case "monthly":
          // For monthly view, show monthly targets and values
          adjustedMetric.value = getMonthlyValue(metric.value);
          adjustedMetric.yearlyGoal = getMonthlyGoal(metric.yearlyGoal);
          adjustedMetric.goalProgress = calculateMonthlyProgress(metric.value, metric.yearlyGoal);
          break;
        case "quarterly":
          // For quarterly view, show quarterly targets and values
          adjustedMetric.value = getQuarterlyValue(metric.value);
          adjustedMetric.yearlyGoal = getQuarterlyGoal(metric.yearlyGoal);
          adjustedMetric.goalProgress = calculateQuarterlyProgress(metric.value, metric.yearlyGoal);
          break;
        case "ytd":
        default:
          // YTD is the default, no adjustment needed
          break;
      }
      
      return adjustedMetric;
    });
  };

  // Helper functions for time period calculations
  const getWeeklyValue = (yearlyValue: string) => {
    const numValue = parseFloat(yearlyValue.replace(/[$,%]/g, ''));
    const weeklyValue = numValue / 52;
    if (yearlyValue.includes('$')) return `$${weeklyValue.toLocaleString()}`;
    if (yearlyValue.includes('%')) return `${weeklyValue.toFixed(1)}%`;
    return weeklyValue.toLocaleString();
  };

  const getMonthlyValue = (yearlyValue: string) => {
    const numValue = parseFloat(yearlyValue.replace(/[$,%]/g, ''));
    const monthlyValue = numValue / 12;
    if (yearlyValue.includes('$')) return `$${monthlyValue.toLocaleString()}`;
    if (yearlyValue.includes('%')) return `${monthlyValue.toFixed(1)}%`;
    return monthlyValue.toLocaleString();
  };

  const getQuarterlyValue = (yearlyValue: string) => {
    const numValue = parseFloat(yearlyValue.replace(/[$,%]/g, ''));
    const quarterlyValue = numValue / 4;
    if (yearlyValue.includes('$')) return `$${quarterlyValue.toLocaleString()}`;
    if (yearlyValue.includes('%')) return `${quarterlyValue.toFixed(1)}%`;
    return quarterlyValue.toLocaleString();
  };

  const getWeeklyGoal = (yearlyGoal: string) => {
    const numGoal = parseFloat(yearlyGoal.replace(/[$,%]/g, ''));
    const weeklyGoal = numGoal / 52;
    if (yearlyGoal.includes('$')) return `$${weeklyGoal.toLocaleString()}`;
    if (yearlyGoal.includes('%')) return `${weeklyGoal.toFixed(1)}%`;
    return weeklyGoal.toLocaleString();
  };

  const getMonthlyGoal = (yearlyGoal: string) => {
    const numGoal = parseFloat(yearlyGoal.replace(/[$,%]/g, ''));
    const monthlyGoal = numGoal / 12;
    if (yearlyGoal.includes('$')) return `$${monthlyGoal.toLocaleString()}`;
    if (yearlyGoal.includes('%')) return `${monthlyGoal.toFixed(1)}%`;
    return monthlyGoal.toLocaleString();
  };

  const getQuarterlyGoal = (yearlyGoal: string) => {
    const numGoal = parseFloat(yearlyGoal.replace(/[$,%]/g, ''));
    const quarterlyGoal = numGoal / 4;
    if (yearlyGoal.includes('$')) return `$${quarterlyGoal.toLocaleString()}`;
    if (yearlyGoal.includes('%')) return `${quarterlyGoal.toFixed(1)}%`;
    return quarterlyGoal.toLocaleString();
  };

  const calculateWeeklyProgress = (currentValue: string, yearlyGoal: string) => {
    const current = parseFloat(currentValue.replace(/[$,%]/g, ''));
    const goal = parseFloat(yearlyGoal.replace(/[$,%]/g, ''));
    // For weekly view, scale down both current and goal
    const weeklyActual = current / 52;
    const weeklyGoal = goal / 52;
    return Math.round((weeklyActual / weeklyGoal) * 100).toString();
  };

  const calculateMonthlyProgress = (currentValue: string, yearlyGoal: string) => {
    const current = parseFloat(currentValue.replace(/[$,%]/g, ''));
    const goal = parseFloat(yearlyGoal.replace(/[$,%]/g, ''));
    // For monthly view, scale down both current and goal
    const monthlyActual = current / 12;
    const monthlyGoal = goal / 12;
    return Math.round((monthlyActual / monthlyGoal) * 100).toString();
  };

  const calculateQuarterlyProgress = (currentValue: string, yearlyGoal: string) => {
    const current = parseFloat(currentValue.replace(/[$,%]/g, ''));
    const goal = parseFloat(yearlyGoal.replace(/[$,%]/g, ''));
    // For quarterly view, scale down both current and goal
    const quarterlyActual = current / 4;
    const quarterlyGoal = goal / 4;
    return Math.round((quarterlyActual / quarterlyGoal) * 100).toString();
  };

  const adjustedMetrics = adjustMetricsForTimePeriod(metrics);

  // Group adjusted metrics by category
  const metricsByCategory = adjustedMetrics.reduce((acc: any, metric: any) => {
    const category = metric.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(metric);
    return acc;
  }, {});

  // Calculate overall performance using adjusted metrics
  const overallProgress = adjustedMetrics.length > 0 ? 
    Math.round(adjustedMetrics.reduce((sum: number, metric: any) => 
      sum + parseFloat(metric.goalProgress || "0"), 0) / adjustedMetrics.length) : 0;

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Business Metrics Dashboard</h2>
          <p className="text-gray-600 mt-1">
            Track your key performance indicators and goal progress
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-sm text-gray-600">Overall Goal Progress</div>
            <div className="text-2xl font-bold text-green-600">{overallProgress}%</div>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {metrics.length === 0 ? (
        <Card className="p-12 text-center">
          <CardHeader>
            <CardTitle className="text-gray-500">No Metrics Configured</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-400 mb-4">
              Set up your business metrics to start tracking performance against goals.
            </p>
            <Button onClick={() => window.location.href = '/metrics-management'}>
              Configure Metrics
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="all" className="space-y-6">
          <div className="flex items-center justify-between">
            <TabsList>
              <TabsTrigger value="all">All Metrics ({adjustedMetrics.length})</TabsTrigger>
              <TabsTrigger value="revenue">Revenue ({metricsByCategory.revenue?.length || 0})</TabsTrigger>
              <TabsTrigger value="growth">Growth ({metricsByCategory.growth?.length || 0})</TabsTrigger>
              <TabsTrigger value="retention">Retention ({metricsByCategory.retention?.length || 0})</TabsTrigger>
              <TabsTrigger value="efficiency">Efficiency ({metricsByCategory.efficiency?.length || 0})</TabsTrigger>
            </TabsList>
            
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
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
          </div>

          <TabsContent value="all" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.isArray(adjustedMetrics) ? adjustedMetrics
                .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0))
                .map((metric: any) => (
                  <MetricProgressChart key={metric.id || metric.name} metric={metric} />
                )) : null}
            </div>
          </TabsContent>

          {Object.entries(metricsByCategory).map(([category, categoryMetrics]: [string, any]) => (
            <TabsContent key={category} value={category} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {(categoryMetrics as any[])
                  .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0))
                  .map((metric: any) => (
                    <MetricProgressChart key={metric.id || metric.name} metric={metric} />
                  ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}