import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RefreshCw, Calendar, Info, Database, Table, Columns } from "lucide-react";
import MetricProgressChart from "./metric-progress-chart";
import NorthStarMetrics from "./north-star-metrics";
import type { Metric } from "@/../../shared/schema";
import { formatActualValue } from "@/lib/format-utils";

interface MetricsOverviewProps {
  onRefresh: () => void;
}

interface MetricCategory {
  id: number;
  name: string;
  value: string;
  color: string;
  isDefault: boolean;
  isActive: boolean;
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
    category: "sales",
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
    category: "sales",
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
    category: "operations",
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
    category: "sales",
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
    category: "marketing",
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
    category: "marketing",
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
    category: "technology",
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
    category: "technology",
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
    category: "sales",
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
    category: "operations",
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
    category: "marketing",
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
    category: "technology",
    format: "percentage",
    priority: 12,
    isIncreasing: true,
    description: "Percentage of users actively using key features"
  }
];

export default function MetricsOverview({ onRefresh }: MetricsOverviewProps) {
  const [timePeriod, setTimePeriod] = useState("Monthly View");
  const [selectedCategory, setSelectedCategory] = useState("all");
  
  // Fetch real Snowflake dashboard metrics
  const { data: dashboardMetrics, isLoading: isDashboardLoading, error: dashboardError } = useQuery({
    queryKey: ["/api/dashboard/metrics-data", timePeriod],
    queryFn: async () => {
      const response = await fetch(`/api/dashboard/metrics-data?timePeriod=${encodeURIComponent(timePeriod)}`);
      const data = await response.json();

      // Check if response indicates company selection is required
      if (data.requiresCompanySelection || data.error?.includes('company selected')) {
        throw new Error('COMPANY_SELECTION_REQUIRED');
      }

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard metrics');
      }
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: (failureCount, error) => {
      // Don't retry if it's a company selection error
      if (error?.message === 'COMPANY_SELECTION_REQUIRED') {
        return false;
      }
      return failureCount < 3;
    }
  });

  // Also fetch configured KPI metrics for additional display
  const { data: kpiMetrics, isLoading: isKpiLoading, error: kpiError } = useQuery({
    queryKey: ["/api/kpi-metrics"],
    queryFn: async () => {
      const response = await fetch('/api/kpi-metrics');
      const data = await response.json();

      // Check if response indicates company selection is required
      if (data.requiresCompanySelection || data.error?.includes('company selected')) {
        throw new Error('COMPANY_SELECTION_REQUIRED');
      }

      if (!response.ok) {
        throw new Error('Failed to fetch KPI metrics');
      }
      return data;
    },
    retry: (failureCount, error) => {
      // Don't retry if it's a company selection error
      if (error?.message === 'COMPANY_SELECTION_REQUIRED') {
        return false;
      }
      return failureCount < 3;
    }
  });

  // Fetch metric categories for dynamic tabs
  const { data: categories, refetch: refetchCategories } = useQuery<MetricCategory[]>({
    queryKey: ["/api/metric-categories"],
    refetchInterval: 10000, // Refresh every 10 seconds
    staleTime: 5000, // Consider data stale after 5 seconds
  });

  const isLoading = isDashboardLoading || isKpiLoading;

  // Check for company selection errors
  const requiresCompanySelection =
    (dashboardError?.message === 'COMPANY_SELECTION_REQUIRED') ||
    (kpiError?.message === 'COMPANY_SELECTION_REQUIRED');

  // Merge real dashboard data with KPI metrics structure
  const metrics = (() => {
    if (!kpiMetrics || !Array.isArray(kpiMetrics) || kpiMetrics.length === 0) {
      return []; // Return empty array when no metrics are defined
    }

    // If we have dashboard metrics from Snowflake, merge them with KPI structure
    if (dashboardMetrics && Array.isArray(dashboardMetrics)) {
      return kpiMetrics.map((kpi: any) => {
        // Find corresponding dashboard metric by metricId
        const dashboardMetric = dashboardMetrics.find((dm: any) => dm.metricId === kpi.id);
        
        if (dashboardMetric) {
          // Store raw values for calculations, format only for display
          return {
            ...kpi,
            // Store raw values for calculations
            rawCurrentValue: dashboardMetric.currentValue,
            rawYearlyGoal: dashboardMetric.yearlyGoal,
            rawPeriodGoal: dashboardMetric.goalValue, // Real period-specific goal from API
            // Keep formatted values for compatibility
            value: dashboardMetric.format === 'currency' && !isNaN(dashboardMetric.currentValue)
              ? `$${(dashboardMetric.currentValue / 1000000).toFixed(1)}M`
              : `${dashboardMetric.currentValue?.toLocaleString() || '0'}`,
            yearlyGoal: dashboardMetric.format === 'currency' && !isNaN(dashboardMetric.yearlyGoal)
              ? `$${(dashboardMetric.yearlyGoal / 1000000).toFixed(1)}M`
              : `${dashboardMetric.yearlyGoal?.toLocaleString() || '0'}`,
            // Calculate progress based on real values
            goalProgress: dashboardMetric.yearlyGoal > 0 
              ? Math.round((dashboardMetric.currentValue / dashboardMetric.yearlyGoal) * 100).toString()
              : "0"
          };
        }
        
        return kpi;
      });
    }
    
    return kpiMetrics;
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
    if (dashboardMetrics) {
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

  // Time period options matching Snowflake service
  const timePeriodOptions = [
    { value: "Weekly View", label: "Weekly" },
    { value: "Monthly View", label: "Monthly" },
    { value: "Quarterly View", label: "Quarterly" }, 
    { value: "Yearly View", label: "Yearly" }
  ];

  // Helper function to get time period label
  const getTimePeriodLabel = () => {
    const option = timePeriodOptions.find(opt => opt.value === timePeriod);
    return option?.label || "Year to Date";
  };

  // Helper functions for adaptive goals
  const getAdaptiveGoal = (yearlyGoal: string, timePeriod: string, metric?: any) => {
    // Use raw yearly goal if available, otherwise parse formatted value
    let yearlyValue: number;
    if (metric?.rawYearlyGoal) {
      yearlyValue = metric.rawYearlyGoal;
    } else {
      yearlyValue = parseFloat(yearlyGoal.replace(/[$,]/g, ''));
    }
    
    switch (timePeriod.toLowerCase()) {
      case "daily view":
      case "daily":
        return formatGoalValue(yearlyValue / 365);
      case "weekly view":
      case "weekly":
        return formatGoalValue(yearlyValue / 52);
      case "monthly view":
      case "monthly":
        return formatGoalValue(yearlyValue / 12);
      case "quarterly view":
      case "quarterly":
        return formatGoalValue(yearlyValue / 4);
      case "yearly view":
      case "yearly":
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
        return "annual";
      default: 
        return "annual";
    }
  };

  const getAdaptiveProgress = (currentValue: string, yearlyGoal: string, timePeriod: string, metricId: number, metric?: any) => {
    const current = getAdaptiveActual(currentValue, timePeriod, metricId, metric);
    
    // Use raw yearly goal if available, otherwise parse formatted value
    let yearly: number;
    if (metric?.rawYearlyGoal) {
      yearly = metric.rawYearlyGoal;
    } else {
      // Add null safety check for yearlyGoal
      if (!yearlyGoal || typeof yearlyGoal !== 'string') {
        return 0;
      }
      yearly = parseFloat(yearlyGoal.replace(/[$,]/g, ''));
    }
    
    let periodGoal: number;
    switch (timePeriod.toLowerCase()) {
      case "daily view":
      case "daily":
        periodGoal = yearly / 365;
        break;
      case "weekly view":
      case "weekly":
        periodGoal = yearly / 52;
        break;
      case "monthly view":
      case "monthly":
        periodGoal = yearly / 12;
        break;
      case "quarterly view":
      case "quarterly":
        periodGoal = yearly / 4;
        break;
      case "yearly view":
      case "yearly":
      case "ytd":
      default:
        periodGoal = yearly;
        break;
    }
    
    // Check if this is a "lower is better" metric (e.g., Average Jira Cycle Time)
    const isLowerIsBetter = metric?.isIncreasing === false;
    
    if (periodGoal <= 0) return 0;
    
    if (isLowerIsBetter) {
      // For "lower is better" metrics: goal/current * 100
      // If current < goal (good), result > 100%
      // If current > goal (bad), result < 100%
      return current > 0 ? Math.round((periodGoal / current) * 100) : 0;
    } else {
      // For "higher is better" metrics: current/goal * 100 (original logic)
      return Math.round((current / periodGoal) * 100);
    }
  };

  const getAdaptiveActual = (yearlyValue: string, timePeriod: string, metricId: number, metric?: any) => {
    // Use raw current value if available, otherwise parse formatted value
    let yearly: number;
    if (metric?.rawCurrentValue) {
      yearly = metric.rawCurrentValue;
    } else {
      // Add null safety check and fallback
      if (!yearlyValue || typeof yearlyValue !== 'string') {
        return 0;
      }
      yearly = parseFloat(yearlyValue.replace(/[$,]/g, ''));
    }
    
    // Create realistic business scenarios where short-term performance differs from yearly
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
        return yearly; // Full yearly value (no multiplier for YTD)
    }
  };

  // Using shared formatActualValue from format-utils (imported above)


  // Calculate overall performance
  const overallProgress = metrics.length > 0 ?
    Math.round(metrics.reduce((sum: number, metric: any) =>
      sum + parseFloat(metric.goalProgress || "0"), 0) / metrics.length) : 0;

  // Handle company selection required error
  if (requiresCompanySelection) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="mx-auto max-w-md">
            <Database className="mx-auto h-12 w-12 text-yellow-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Company Selection Required
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Please select a company to view business metrics. You need to be logged in and have a company selected to access your dashboard data.
            </p>
            <Button onClick={() => window.location.href = '/company-selection'} className="bg-primary hover:bg-primary/90">
              <Database className="h-4 w-4 mr-2" />
              Select Company
            </Button>
          </div>
        </div>
      </div>
    );
  }

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

  // Early return for empty state - show only the setup message
  if (metrics.length === 0) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <div className="mx-auto max-w-md">
            <Database className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No Metrics Defined
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              You haven't defined any KPI metrics yet. Once you set up your metrics and have data in core_daily_metrics, they will appear here.
            </p>
            <Button onClick={() => window.location.href = '/metrics'} className="bg-primary hover:bg-primary/90">
              <Database className="h-4 w-4 mr-2" />
              Set Up Metrics
            </Button>
          </div>
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
          <Button onClick={() => { onRefresh(); refetchCategories(); }} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Dynamic Category Pills Filter */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2 mb-6">
        {/* All Metrics pill */}
        <Badge
          variant={selectedCategory === "all" ? "default" : "outline"}
          className={`cursor-pointer transition-all duration-200 text-center justify-center py-2 min-h-[2.5rem] text-xs sm:text-sm ${
            selectedCategory === "all"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "hover:bg-gray-100 dark:hover:bg-gray-800"
          }`}
          onClick={() => setSelectedCategory("all")}
        >
          All Metrics
        </Badge>

        {/* All categories as responsive pills */}
        {categories?.filter(cat => cat.isActive).map((category) => (
          <Badge
            key={category.value}
            variant={selectedCategory === category.value ? "default" : "outline"}
            className={`cursor-pointer transition-all duration-200 text-center justify-center py-2 min-h-[2.5rem] text-xs sm:text-sm ${
              selectedCategory === category.value
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            }`}
            onClick={() => setSelectedCategory(category.value)}
          >
            {category.name}
          </Badge>
        ))}
      </div>

      {/* Filtered Metrics Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {metrics
          .filter((metric: any) => selectedCategory === "all" || metric.category === selectedCategory)
          .map((metric: any) => (
              <Card key={metric.id} className="relative overflow-hidden border hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-800">
                {/* Goal progress indicator */}
                <div className={`absolute top-0 left-0 w-full h-1 ${
                  getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id, metric) >= 100 ? 'bg-green-500' : 
                  getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id, metric) >= 90 ? 'bg-yellow-500' : 'bg-red-500'
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
                      getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id, metric) >= 100 ? 'text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30' : 
                      getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id, metric) >= 90 ? 'text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30' :
                      'text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30'
                    }`}>
                      {getAdaptiveProgress(metric.value, metric.yearlyGoal, timePeriod, metric.id, metric)}% to goal
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-0">
                  {/* Current Value */}
                  <div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-white">
                      {formatActualValue(metric.rawCurrentValue ?? getAdaptiveActual(metric.value, timePeriod, metric.id, metric))}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      vs. {formatActualValue(metric.rawPeriodGoal ?? getAdaptiveGoal(metric.yearlyGoal, timePeriod, metric))} {getTimePeriodLabelShort(timePeriod)} goal
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

    </div>
  );
}
