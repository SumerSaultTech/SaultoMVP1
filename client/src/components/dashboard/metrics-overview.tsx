import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Target, 
  ArrowUpIcon, 
  ArrowDownIcon,
  RefreshCw,
  BarChart3,
  PieChart,
  Activity
} from "lucide-react";
// Charts removed temporarily due to compatibility issues
import type { KpiMetric } from "@/../../shared/schema";

interface MetricsOverviewProps {
  onRefresh: () => void;
}

// Default comprehensive business metrics
const defaultMetrics: Partial<KpiMetric>[] = [
  {
    id: 1,
    name: "Annual Recurring Revenue",
    value: "$2,400,000",
    yearlyGoal: "$3,000,000",
    goalProgress: "80",
    changePercent: "+12.5%",
    category: "revenue",
    priority: 1,
    format: "currency",
    isIncreasing: true,
    description: "Total ARR from subscription revenue"
  },
  {
    id: 2,
    name: "Monthly Recurring Revenue",
    value: "$200,000",
    yearlyGoal: "$250,000",
    goalProgress: "80",
    changePercent: "+8.2%",
    category: "revenue",
    priority: 2,
    format: "currency",
    isIncreasing: true,
    description: "Monthly subscription revenue"
  },
  {
    id: 3,
    name: "Customer Acquisition Cost",
    value: "$1,250",
    yearlyGoal: "$1,000",
    goalProgress: "75",
    changePercent: "-5.1%",
    category: "efficiency",
    priority: 3,
    format: "currency",
    isIncreasing: false,
    description: "Cost to acquire new customers"
  },
  {
    id: 4,
    name: "Customer Lifetime Value",
    value: "$18,750",
    yearlyGoal: "$22,000",
    goalProgress: "85",
    changePercent: "+6.3%",
    category: "revenue",
    priority: 4,
    format: "currency",
    isIncreasing: true,
    description: "Average customer lifetime value"
  },
  {
    id: 5,
    name: "Monthly Churn Rate",
    value: "3.2%",
    yearlyGoal: "2.5%",
    goalProgress: "72",
    changePercent: "-0.3%",
    category: "retention",
    priority: 5,
    format: "percentage",
    isIncreasing: false,
    description: "Percentage of customers lost per month"
  },
  {
    id: 6,
    name: "Net Revenue Retention",
    value: "115%",
    yearlyGoal: "120%",
    goalProgress: "96",
    changePercent: "+2.1%",
    category: "retention",
    priority: 6,
    format: "percentage",
    isIncreasing: true,
    description: "Revenue expansion from existing customers"
  },
  {
    id: 7,
    name: "Gross Margin",
    value: "78%",
    yearlyGoal: "80%",
    goalProgress: "97",
    changePercent: "+1.5%",
    category: "efficiency",
    priority: 7,
    format: "percentage",
    isIncreasing: true,
    description: "Revenue minus cost of goods sold"
  },
  {
    id: 8,
    name: "Monthly Active Users",
    value: "8,450",
    yearlyGoal: "10,000",
    goalProgress: "85",
    changePercent: "+15.2%",
    category: "growth",
    priority: 8,
    format: "number",
    isIncreasing: true,
    description: "Active users in the last 30 days"
  },
  {
    id: 9,
    name: "Lead Conversion Rate",
    value: "12.5%",
    yearlyGoal: "15%",
    goalProgress: "83",
    changePercent: "+2.8%",
    category: "growth",
    priority: 9,
    format: "percentage",
    isIncreasing: true,
    description: "Percentage of leads that convert to customers"
  },
  {
    id: 10,
    name: "Average Deal Size",
    value: "$4,200",
    yearlyGoal: "$5,000",
    goalProgress: "84",
    changePercent: "+7.1%",
    category: "revenue",
    priority: 10,
    format: "currency",
    isIncreasing: true,
    description: "Average value of closed deals"
  },
  {
    id: 11,
    name: "Sales Cycle Length",
    value: "45 days",
    yearlyGoal: "35 days",
    goalProgress: "78",
    changePercent: "-3.2%",
    category: "efficiency",
    priority: 11,
    format: "number",
    isIncreasing: false,
    description: "Average time from lead to close"
  },
  {
    id: 12,
    name: "Product Adoption Rate",
    value: "68%",
    yearlyGoal: "75%",
    goalProgress: "91",
    changePercent: "+4.6%",
    category: "growth",
    priority: 12,
    format: "percentage",
    isIncreasing: true,
    description: "Percentage of users actively using key features"
  }
];

// Simple trend indicator without charts for now
const getTrendDirection = (changePercent: string | undefined) => {
  if (!changePercent) return 'neutral';
  return changePercent.startsWith('+') ? 'up' : 'down';
};

function MetricCard({ metric }: { metric: Partial<KpiMetric> }) {
  const goalProgress = parseFloat(metric.goalProgress || "0");
  const changePercent = metric.changePercent || "";
  const isPositiveChange = changePercent.startsWith('+');
  const isGoodDirection = metric.isIncreasing ? isPositiveChange : !isPositiveChange;
  
  const getIcon = (category: string) => {
    switch (category) {
      case 'revenue': return DollarSign;
      case 'growth': return TrendingUp;
      case 'retention': return Users;
      case 'efficiency': return Target;
      default: return BarChart3;
    }
  };

  const Icon = getIcon(metric.category || 'revenue');

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon className="h-5 w-5 text-blue-600" />
            <Badge variant="outline" className="text-xs">
              {metric.category}
            </Badge>
          </div>
          <div className="flex items-center space-x-1">
            {isGoodDirection ? (
              <ArrowUpIcon className="h-4 w-4 text-green-500" />
            ) : (
              <ArrowDownIcon className="h-4 w-4 text-red-500" />
            )}
            <span className={`text-sm font-medium ${isGoodDirection ? 'text-green-600' : 'text-red-600'}`}>
              {metric.changePercent}
            </span>
          </div>
        </div>
        <CardTitle className="text-sm font-medium text-gray-700 line-clamp-2">
          {metric.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          {/* Current Value */}
          <div>
            <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
            <div className="text-xs text-gray-500">{metric.description}</div>
          </div>

          {/* Goal Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Goal Progress</span>
              <span className="font-medium">{goalProgress}%</span>
            </div>
            <Progress value={goalProgress} className="h-2" />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Current: {metric.value}</span>
              <span>Goal: {metric.yearlyGoal}</span>
            </div>
          </div>

          {/* Change Indicator */}
          {changePercent && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">vs last quarter</span>
              <span className={`text-sm px-2 py-1 rounded-full font-medium ${
                isGoodDirection 
                  ? "bg-green-100 text-green-800" 
                  : "bg-red-100 text-red-800"
              }`}>
                {changePercent}
              </span>
            </div>
          )}

          {/* Trend Indicator */}
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>Trend</span>
            <div className="flex items-center space-x-1">
              <div className={`w-2 h-2 rounded-full ${
                getTrendDirection(changePercent) === 'up' ? 'bg-green-500' :
                getTrendDirection(changePercent) === 'down' ? 'bg-red-500' : 'bg-gray-400'
              }`} />
              <span className="capitalize">{getTrendDirection(changePercent)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MetricsOverview({ onRefresh }: MetricsOverviewProps) {
  const { data: kpiMetrics, isLoading } = useQuery({
    queryKey: ["/api/kpi-metrics"],
  });

  const metrics = (kpiMetrics && Array.isArray(kpiMetrics) && kpiMetrics.length > 0) ? kpiMetrics : defaultMetrics;

  // Group metrics by category
  const metricsByCategory = Array.isArray(metrics) ? metrics.reduce((acc: any, metric: any) => {
    const category = metric.category || 'other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(metric);
    return acc;
  }, {}) : {};

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
          <CardTitle className="text-xl font-semibold">Business Metrics Dashboard</CardTitle>
          <Button variant="ghost" size="sm" disabled>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-gray-50 rounded-lg p-6 border h-64">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <div className="h-4 bg-gray-200 rounded w-1/3" />
                      <div className="h-4 bg-gray-200 rounded w-1/4" />
                    </div>
                    <div className="h-6 bg-gray-200 rounded w-3/4" />
                    <div className="h-8 bg-gray-200 rounded w-1/2" />
                    <div className="h-2 bg-gray-200 rounded w-full" />
                    <div className="h-16 bg-gray-200 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-6">
          <div>
            <CardTitle className="text-xl font-semibold">Business Metrics Dashboard</CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Track progress against yearly goals across all key metrics
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onRefresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
      </Card>

      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="all">All Metrics</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="growth">Growth</TabsTrigger>
          <TabsTrigger value="retention">Retention</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {metrics
              .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0))
              .map((metric: any) => (
                <MetricCard key={metric.id || metric.name} metric={metric} />
              ))}
          </div>
        </TabsContent>

        {Object.entries(metricsByCategory).map(([category, categoryMetrics]: [string, any]) => (
          <TabsContent key={category} value={category} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {(categoryMetrics as any[])
                .sort((a: any, b: any) => (a.priority || 0) - (b.priority || 0))
                .map((metric: any) => (
                  <MetricCard key={metric.id || metric.name} metric={metric} />
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}