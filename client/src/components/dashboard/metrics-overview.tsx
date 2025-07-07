import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RefreshCw, Calendar, Info, Database, Table, Columns } from "lucide-react";
import MetricProgressChart from "./metric-progress-chart";
import NorthStarMetrics from "./north-star-metrics";
import type { KpiMetric } from "@/../../shared/schema";

interface MetricsOverviewProps {
  onRefresh: () => void;
}


export default function MetricsOverview({ onRefresh }: MetricsOverviewProps) {
  const [timePeriod, setTimePeriod] = useState("yearly");
  
  // Fetch optimized dashboard data (same as North Star component)
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["/api/dashboard/metrics", timePeriod],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/metrics?companyId=1&timePeriod=${timePeriod}`);
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard metrics');
      }
      return response.json();
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 30000, // Cache for 30 seconds
  });
  
  // Client-side goal calculation based on time period (same as North Star)
  const calculateGoalForPeriod = (yearlyGoal: number, period: string, monthlyGoals?: any, quarterlyGoals?: any) => {
    switch (period) {
      case 'daily':
        return yearlyGoal / 365;
      case 'weekly':
        return yearlyGoal / 52;
      case 'monthly':
        if (monthlyGoals) {
          const currentMonth = new Date().toLocaleString('default', { month: 'long' });
          return monthlyGoals[currentMonth] || (yearlyGoal / 12);
        }
        return yearlyGoal / 12;
      case 'quarterly':
        if (quarterlyGoals) {
          const currentQuarter = Math.floor(new Date().getMonth() / 3) + 1;
          return quarterlyGoals[`Q${currentQuarter}`] || (yearlyGoal / 4);
        }
        return yearlyGoal / 4;
      case 'yearly':
      default:
        return yearlyGoal;
    }
  };

  // Format values for display
  const formatMetricValue = (value: number, format: string): string => {
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
  };

  // Get Business metrics from API response (exclude North Star metrics)
  const metrics = (() => {
    if (!dashboardData?.businessMetrics || !Array.isArray(dashboardData.businessMetrics)) {
      return []; // No fallback data - show nothing
    }

    return dashboardData.businessMetrics.map((metric: any) => {
      const currentGoal = calculateGoalForPeriod(
        metric.yearlyGoal, 
        timePeriod, 
        metric.monthlyGoals, 
        metric.quarterlyGoals
      );

      const currentProgress = currentGoal > 0 
        ? Math.round((metric.currentValue / currentGoal) * 100) 
        : 0;

      return {
        id: metric.id,
        name: metric.name,
        description: metric.description,
        value: formatMetricValue(metric.currentValue, metric.format),
        yearlyGoal: formatMetricValue(currentGoal, metric.format),
        goalProgress: currentProgress.toString(),
        changePercent: metric.changePercent || "+0%",
        category: metric.category || "revenue",
        format: metric.format || "currency",
        priority: metric.priority || 1,
        isIncreasing: metric.isIncreasing !== false
      };
    });
  })();

  // Data source mapping for real Snowflake metrics
  const getDataSourceInfo = (metricName: string) => {
    const sources = {
      'revenue': {
        source: 'QuickBooks',
        warehouse: 'Snowflake',
        database: 'MIAS_DATA_DB',
        schema: 'CORE',
        table: 'CORE_QUICKBOOKS_REVENUE',
        column: 'INVOICE_AMOUNT',
        description: 'Revenue data from QuickBooks invoices stored in Snowflake data warehouse'
      },
      'profit': {
        source: 'QuickBooks (Calculated)',
        warehouse: 'Snowflake',
        database: 'MIAS_DATA_DB',
        schema: 'CORE',
        table: 'CORE_QUICKBOOKS_REVENUE - CORE_QUICKBOOKS_EXPENSES',
        column: 'INVOICE_AMOUNT - AMOUNT',
        description: 'Calculated as Revenue minus Expenses from QuickBooks financial data'
      },
      'arr': {
        source: 'HubSpot',
        warehouse: 'Snowflake',
        database: 'MIAS_DATA_DB',
        schema: 'CORE',
        table: 'CORE_HUBSPOT_DEALS',
        column: 'AMOUNT * 12',
        description: 'Annual Recurring Revenue from closed HubSpot deals stored in Snowflake'
      },
      'mrr': {
        source: 'HubSpot',
        warehouse: 'Snowflake',
        database: 'MIAS_DATA_DB',
        schema: 'CORE',
        table: 'CORE_HUBSPOT_DEALS',
        column: 'AMOUNT',
        description: 'Monthly Recurring Revenue from closed HubSpot deals stored in Snowflake'
      },
      'expenses': {
        source: 'QuickBooks',
        warehouse: 'Snowflake',
        database: 'MIAS_DATA_DB',
        schema: 'CORE',
        table: 'CORE_QUICKBOOKS_EXPENSES',
        column: 'AMOUNT',
        description: 'Business expenses from QuickBooks stored in Snowflake data warehouse'
      }
    };

    // Check if this is a real Snowflake metric or a configured KPI metric
    if (dashboardData?.businessMetrics) {
      const metricKey = metricName.toLowerCase().includes('revenue') ? 'revenue' :
                       metricName.toLowerCase().includes('profit') ? 'profit' :
                       metricName.toLowerCase().includes('arr') ? 'arr' :
                       metricName.toLowerCase().includes('mrr') ? 'mrr' :
                       metricName.toLowerCase().includes('expense') ? 'expenses' : null;
      
      if (metricKey && sources[metricKey]) {
        return sources[metricKey];
      }
    }

    // Fallback for configured metrics
    return {
      source: 'Manual Configuration',
      warehouse: 'Application Database',
      database: 'Custom Configuration',
      schema: 'User Defined',
      table: 'KPI Metrics Table',
      column: 'Configured Value',
      description: 'This is a manually configured business metric'
    };
  };

  // Time period options
  const timePeriodOptions = [
    { value: "daily", label: "Daily" },
    { value: "weekly", label: "Weekly" },
    { value: "monthly", label: "Monthly" }, 
    { value: "quarterly", label: "Quarterly" },
    { value: "yearly", label: "Yearly" }
  ];

  // Helper function to get time period label
  const getTimePeriodLabel = () => {
    const option = timePeriodOptions.find(opt => opt.value === timePeriod);
    return option?.label || "Yearly";
  };

  const getTimePeriodLabelShort = (period: string) => {
    switch (period) {
      case "daily": return "daily";
      case "weekly": return "weekly";
      case "monthly": return "monthly";
      case "quarterly": return "quarterly";
      case "yearly": return "annual";
      default: return "annual";
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
      <NorthStarMetrics dashboardData={dashboardData} timePeriod={timePeriod} setTimePeriod={setTimePeriod} />

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
                {/* Goal progress indicator */}
                <div className={`absolute top-0 left-0 w-full h-1 ${
                  parseInt(metric.goalProgress) >= 100 ? 'bg-green-500' : 
                  parseInt(metric.goalProgress) >= 90 ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                          {metric.name}
                        </CardTitle>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700">
                              <Info className="h-3 w-3 text-gray-500" />
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
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {metric.description}
                      </p>
                    </div>
                    <div className={`ml-2 flex items-center text-xs font-medium px-2 py-1 rounded-full ${
                      parseInt(metric.goalProgress) >= 100 ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 
                      parseInt(metric.goalProgress) >= 90 ? 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30' :
                      'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                    }`}>
                      {metric.goalProgress}% to goal
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
                      vs. {metric.yearlyGoal} {getTimePeriodLabelShort(timePeriod)} goal
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
                  {/* Goal progress indicator */}
                  <div className={`absolute top-0 left-0 w-full h-1 ${
                    parseInt(metric.goalProgress) >= 100 ? 'bg-green-500' : 
                    parseInt(metric.goalProgress) >= 90 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                            {metric.name}
                          </CardTitle>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 hover:bg-gray-100 dark:hover:bg-gray-700">
                                <Info className="h-3 w-3 text-gray-500" />
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
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                          {metric.description}
                        </p>
                      </div>
                      <div className={`ml-2 flex items-center text-xs font-medium px-2 py-1 rounded-full ${
                        parseInt(metric.goalProgress) >= 100 ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 
                        parseInt(metric.goalProgress) >= 90 ? 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30' :
                        'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                      }`}>
                        {metric.goalProgress}% to goal
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
                        vs. {metric.yearlyGoal} {getTimePeriodLabelShort(timePeriod)} goal
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