interface MetricDisplayConfig {
  id: string;
  name: string;
  category: string;
  format: string;
  goal: number;
  currentValue: number;
  description: string;
  dataSource: string;
  isNorthStar?: boolean;
}

export class MetricsDisplayService {
  
  getMetricConfigurations(): MetricDisplayConfig[] {
    return [
      // Financial Metrics
      {
        id: 'annual-revenue',
        name: 'Annual Revenue',
        category: 'Financial',
        format: 'currency',
        goal: 2500000,
        currentValue: 0,
        description: 'Total revenue for current year from QuickBooks',
        dataSource: 'CORE_QUICKBOOKS_REVENUE',
        isNorthStar: true
      },
      {
        id: 'monthly-revenue',
        name: 'Monthly Revenue',
        category: 'Financial',
        format: 'currency',
        goal: 208333,
        currentValue: 0,
        description: 'Revenue for current month',
        dataSource: 'CORE_QUICKBOOKS_REVENUE'
      },
      {
        id: 'annual-profit',
        name: 'Annual Profit',
        category: 'Financial',
        format: 'currency',
        goal: 500000,
        currentValue: 0,
        description: 'Net profit (revenue minus expenses)',
        dataSource: 'CORE_QUICKBOOKS_REVENUE + CORE_QUICKBOOKS_EXPENSES',
        isNorthStar: true
      },
      {
        id: 'gross-margin',
        name: 'Gross Margin',
        category: 'Financial',
        format: 'percentage',
        goal: 75,
        currentValue: 0,
        description: 'Profit margin percentage',
        dataSource: 'CORE_QUICKBOOKS_REVENUE + CORE_QUICKBOOKS_EXPENSES'
      },
      
      // Sales Metrics
      {
        id: 'total-deals',
        name: 'Total Deals',
        category: 'Sales',
        format: 'number',
        goal: 500,
        currentValue: 0,
        description: 'All deals created this year',
        dataSource: 'CORE_HUBSPOT_DEALS'
      },
      {
        id: 'closed-deals',
        name: 'Closed Deals',
        category: 'Sales',
        format: 'number',
        goal: 150,
        currentValue: 0,
        description: 'Successfully closed deals',
        dataSource: 'CORE_HUBSPOT_DEALS',
        isNorthStar: true
      },
      {
        id: 'conversion-rate',
        name: 'Deal Conversion Rate',
        category: 'Sales',
        format: 'percentage',
        goal: 30,
        currentValue: 0,
        description: 'Percentage of deals that close successfully',
        dataSource: 'CORE_HUBSPOT_DEALS'
      },
      {
        id: 'average-deal-size',
        name: 'Average Deal Size',
        category: 'Sales',
        format: 'currency',
        goal: 15000,
        currentValue: 0,
        description: 'Average value of closed deals',
        dataSource: 'CORE_HUBSPOT_DEALS'
      },
      
      // Activity Metrics
      {
        id: 'total-calls',
        name: 'Total Calls',
        category: 'Activity',
        format: 'number',
        goal: 2000,
        currentValue: 0,
        description: 'All calls made this year',
        dataSource: 'CORE_HUBSPOT_CALLS'
      },
      {
        id: 'qualified-calls',
        name: 'Qualified Calls',
        category: 'Activity',
        format: 'number',
        goal: 600,
        currentValue: 0,
        description: 'Calls that resulted in qualified leads',
        dataSource: 'CORE_HUBSPOT_CALLS'
      },
      
      // Expense Metrics
      {
        id: 'marketing-spend',
        name: 'Marketing Spend',
        category: 'Marketing',
        format: 'currency',
        goal: 100000,
        currentValue: 0,
        description: 'Total marketing expenses this year',
        dataSource: 'CORE_QUICKBOOKS_EXPENSES'
      },
      {
        id: 'annual-expenses',
        name: 'Total Expenses',
        category: 'Financial',
        format: 'currency',
        goal: 2000000,
        currentValue: 0,
        description: 'All business expenses this year',
        dataSource: 'CORE_QUICKBOOKS_EXPENSES'
      }
    ];
  }

  getNorthStarMetrics(): MetricDisplayConfig[] {
    return this.getMetricConfigurations().filter(metric => metric.isNorthStar);
  }

  getMetricsByCategory(category: string): MetricDisplayConfig[] {
    return this.getMetricConfigurations().filter(metric => metric.category === category);
  }

  formatValue(value: number, format: string): string {
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(value);
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
        return new Intl.NumberFormat('en-US').format(value);
      default:
        return value.toString();
    }
  }

  calculateProgress(current: number, goal: number): number {
    if (goal === 0) return 0;
    return Math.min(100, (current / goal) * 100);
  }

  getProgressColor(progress: number): string {
    if (progress >= 90) return 'green';
    if (progress >= 70) return 'yellow';
    if (progress >= 50) return 'orange';
    return 'red';
  }
}

export const metricsDisplayService = new MetricsDisplayService();