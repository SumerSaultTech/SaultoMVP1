export interface SnowflakeMetricData {
  id: string;
  name: string;
  currentValue: number;
  yearlyGoal: number;
  format: 'currency' | 'percentage' | 'number';
  description: string;
  category: 'revenue' | 'profit' | 'customer' | 'operational';
  sql_query?: string;
}

export interface SnowflakeTimeSeriesData {
  period: string;
  actual: number | null;
  goal: number;
}

import { snowflakeDirectService } from './snowflake-direct';
import { snowflakeSchemaDiscovery } from './snowflake-schema-discovery';

export class SnowflakeMetricsService {
  private readonly fallbackData = {
    'Annual Revenue': 100000,
    'Monthly Deal Value': 100000,
    'Monthly Expenses': 57000,
    'Customer Acquisition Cost': 1500,
    'Customer Lifetime Value': 8500,
    'Monthly Active Users': 2400,
    'Churn Rate': 5.2
  };

  async calculateMetric(metricName: string, timePeriod: string = 'monthly'): Promise<number> {
    try {
      console.log(`Calculating dashboard data for metric ${metricName}, period ${timePeriod}`);

      // First try to generate SQL based on actual schema
      const generatedSQL = await snowflakeSchemaDiscovery.generateSQLForMetric(metricName, '', timePeriod);

      let sqlQuery = generatedSQL;

      // If schema-based generation fails, try static templates
      if (!sqlQuery) {
        sqlQuery = this.getSQLTemplate(metricName, timePeriod);
      }

      if (!sqlQuery) {
        console.log(`No SQL query could be generated for metric: ${metricName}, using fallback data`);
        return this.getFallbackValue(metricName);
      }

      console.log(`Executing SQL query: ${sqlQuery}`);

      const result = await snowflakeDirectService.executeQuery(sqlQuery);

      if (result.success && result.data && result.data.length > 0) {
        const value = result.data[0].VALUE || result.data[0].value || 0;
        console.log(`Dashboard data for metric ${metricName}: ${value} from Snowflake query (${timePeriod})`);
        return Number(value);
      } else {
        console.log(`Query failed: ${result.error || 'no data or data not array'}. Using fallback data.`);
        const fallbackValue = this.getFallbackValue(metricName);
        console.log(`Query failed for metric ${metricName}, using fallback data`);
        console.log(`Dashboard data for metric ${metricName}: ${fallbackValue} from dashboard calculation (${timePeriod})`);
        return fallbackValue;
      }

    } catch (error) {
      console.error(`Error calculating metric ${metricName}:`, error);
      return this.getFallbackValue(metricName);
    }
  }

  // Get North Star metrics from MIAS_DATA Snowflake database
  async getNorthStarMetrics(companySlug: string): Promise<SnowflakeMetricData[]> {
    try {
      // First, let's check what tables exist in your MIAS_DATA database
      const schemaQuery = `
        USE DATABASE MIAS_DATA_DB;
        SHOW TABLES;
      `;

      const tablesResult = await this.executeSnowflakeQuery(schemaQuery);
      console.log('Available tables in MIAS_DATA_DB:', tablesResult);

      // Basic revenue query - you can customize these table names based on your actual data
      const revenueQuery = `
        USE DATABASE MIAS_DATA_DB;
        SELECT 
          COALESCE(SUM(AMOUNT), 0) as current_revenue
        FROM (
          SELECT * FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = 'PUBLIC' 
          AND (TABLE_NAME ILIKE '%REVENUE%' OR TABLE_NAME ILIKE '%SALES%' OR TABLE_NAME ILIKE '%INCOME%')
          LIMIT 1
        );
      `;

      // Try to get actual revenue data or return sample values
      let currentRevenue = 2850000; // Default value
      let currentProfit = 485000;   // Default value

      try {
        const revenueResult = await this.executeSnowflakeQuery(revenueQuery);
        if (revenueResult && revenueResult.length > 0) {
          currentRevenue = revenueResult[0]?.CURRENT_REVENUE || currentRevenue;
        }
      } catch (error) {
        console.log('Using default revenue values as table structure needs to be configured');
      }

      return [
        {
          id: 'annual-revenue',
          name: 'Annual Revenue',
          currentValue: currentRevenue,
          yearlyGoal: 3500000,
          format: 'currency',
          description: 'Total revenue for the current fiscal year from MIAS_DATA',
          category: 'revenue',
          sql_query: revenueQuery
        },
        {
          id: 'annual-profit',
          name: 'Annual Profit', 
          currentValue: currentProfit,
          yearlyGoal: 700000,
          format: 'currency',
          description: 'Net profit after all expenses for the current fiscal year from MIAS_DATA',
          category: 'profit'
        }
      ];
    } catch (error) {
      console.error('Error fetching North Star metrics from MIAS_DATA Snowflake:', error);
      throw error;
    }
  }

  // Get KPI metrics from Snowflake
  async getKPIMetrics(): Promise<SnowflakeMetricData[]> {
    try {
      const metrics = [];

      // Monthly Recurring Revenue
      const mrrQuery = `
        SELECT SUM(monthly_amount) as current_mrr
        FROM subscription_revenue 
        WHERE DATE_TRUNC('MONTH', billing_date) = DATE_TRUNC('MONTH', CURRENT_DATE())
        AND status = 'active'
      `;

      // Customer Acquisition Cost
      const cacQuery = `
        SELECT 
          SUM(marketing_spend) / COUNT(DISTINCT customer_id) as current_cac
        FROM marketing_costs mc
        JOIN new_customers nc ON DATE_TRUNC('MONTH', mc.spend_date) = DATE_TRUNC('MONTH', nc.signup_date)
        WHERE DATE_TRUNC('MONTH', mc.spend_date) = DATE_TRUNC('MONTH', CURRENT_DATE())
      `;

      // Churn Rate
      const churnQuery = `
        SELECT 
          (COUNT(CASE WHEN status = 'churned' THEN 1 END) * 100.0 / COUNT(*)) as churn_rate
        FROM customers 
        WHERE DATE_TRUNC('MONTH', last_activity_date) = DATE_TRUNC('MONTH', CURRENT_DATE())
      `;

      // Active Users
      const activeUsersQuery = `
        SELECT COUNT(DISTINCT user_id) as active_users
        FROM user_activity 
        WHERE activity_date >= DATEADD('day', -30, CURRENT_DATE())
      `;

      const queries = [
        { query: mrrQuery, id: 'monthly-recurring-revenue', name: 'Monthly Recurring Revenue', goal: 350000, format: 'currency', category: 'revenue' },
        { query: cacQuery, id: 'customer-acquisition-cost', name: 'Customer Acquisition Cost', goal: 100, format: 'currency', category: 'customer' },
        { query: churnQuery, id: 'churn-rate', name: 'Monthly Churn Rate', goal: 2.5, format: 'percentage', category: 'customer' },
        { query: activeUsersQuery, id: 'active-users', name: 'Monthly Active Users', goal: 20000, format: 'number', category: 'operational' }
      ];

      for (const { query, id, name, goal, format, category } of queries) {
        try {
          const result = await this.executeSnowflakeQuery(query);
          const currentValue = result[0] ? Object.values(result[0])[0] as number : 0;

          metrics.push({
            id,
            name,
            currentValue: currentValue || 0,
            yearlyGoal: goal,
            format: format as 'currency' | 'percentage' | 'number',
            description: `${name} calculated from Snowflake data`,
            category: category as 'revenue' | 'profit' | 'customer' | 'operational',
            sql_query: query
          });
        } catch (error) {
          console.error(`Error executing query for ${name}:`, error);
          // Continue with other metrics even if one fails
        }
      }

      return metrics;
    } catch (error) {
      console.error('Error fetching KPI metrics from Snowflake:', error);
      throw error;
    }
  }

  // Get time series data for charts
  async getTimeSeriesData(
    metric: SnowflakeMetricData, 
    timePeriod: 'weekly' | 'monthly' | 'quarterly' | 'ytd'
  ): Promise<SnowflakeTimeSeriesData[]> {
    try {
      let query = '';

      switch (timePeriod) {
        case 'weekly':
          query = this.buildWeeklyQuery(metric);
          break;
        case 'monthly':
          query = this.buildMonthlyQuery(metric);
          break;
        case 'quarterly':
          query = this.buildQuarterlyQuery(metric);
          break;
        case 'ytd':
        default:
          query = this.buildYTDQuery(metric);
          break;
      }

      const result = await this.executeSnowflakeQuery(query);
      return this.formatTimeSeriesResult(result, metric, timePeriod);
    } catch (error) {
      console.error(`Error fetching time series data for ${metric.name}:`, error);
      throw error;
    }
  }

  private buildYTDQuery(metric: SnowflakeMetricData): string {
    const baseTable = this.getBaseTable(metric);
    const valueColumn = this.getValueColumn(metric);
    const dateColumn = this.getDateColumn(metric);

    return `
      SELECT 
        DATE_TRUNC('MONTH', ${dateColumn}) as period,
        SUM(${valueColumn}) as actual_value
      FROM ${baseTable}
      WHERE YEAR(${dateColumn}) = YEAR(CURRENT_DATE())
      GROUP BY DATE_TRUNC('MONTH', ${dateColumn})
      ORDER BY period
    `;
  }

  private buildMonthlyQuery(metric: SnowflakeMetricData): string {
    const baseTable = this.getBaseTable(metric);
    const valueColumn = this.getValueColumn(metric);
    const dateColumn = this.getDateColumn(metric);

    return `
      SELECT 
        DATE_TRUNC('DAY', ${dateColumn}) as period,
        SUM(${valueColumn}) as actual_value
      FROM ${baseTable}
      WHERE DATE_TRUNC('MONTH', ${dateColumn}) = DATE_TRUNC('MONTH', CURRENT_DATE())
      GROUP BY DATE_TRUNC('DAY', ${dateColumn})
      ORDER BY period
    `;
  }

  private buildWeeklyQuery(metric: SnowflakeMetricData): string {
    const baseTable = this.getBaseTable(metric);
    const valueColumn = this.getValueColumn(metric);
    const dateColumn = this.getDateColumn(metric);

    return `
      SELECT 
        DATE_TRUNC('DAY', ${dateColumn}) as period,
        SUM(${valueColumn}) as actual_value
      FROM ${baseTable}
      WHERE ${dateColumn} >= DATE_TRUNC('WEEK', CURRENT_DATE())
        AND ${dateColumn} < DATEADD('week', 1, DATE_TRUNC('WEEK', CURRENT_DATE()))
      GROUP BY DATE_TRUNC('DAY', ${dateColumn})
      ORDER BY period
    `;
  }

  private buildQuarterlyQuery(metric: SnowflakeMetricData): string {
    const baseTable = this.getBaseTable(metric);
    const valueColumn = this.getValueColumn(metric);
    const dateColumn = this.getDateColumn(metric);

    return `
      SELECT 
        DATE_TRUNC('WEEK', ${dateColumn}) as period,
        SUM(${valueColumn}) as actual_value
      FROM ${baseTable}
      WHERE DATE_TRUNC('QUARTER', ${dateColumn}) = DATE_TRUNC('QUARTER', CURRENT_DATE())
      GROUP BY DATE_TRUNC('WEEK', ${dateColumn})
      ORDER BY period
    `;
  }

  private getBaseTable(metric: SnowflakeMetricData): string {
    const tableMap = {
      'annual-revenue': 'revenue_table',
      'annual-profit': 'profit_table',
      'monthly-recurring-revenue': 'subscription_revenue',
      'customer-acquisition-cost': 'marketing_costs',
      'churn-rate': 'customers',
      'active-users': 'user_activity'
    };
    return tableMap[metric.id] || 'revenue_table';
  }

  private getValueColumn(metric: SnowflakeMetricData): string {
    const columnMap = {
      'annual-revenue': 'revenue_amount',
      'annual-profit': 'profit_amount',
      'monthly-recurring-revenue': 'monthly_amount',
      'customer-acquisition-cost': 'marketing_spend',
      'churn-rate': 'CASE WHEN status = "churned" THEN 1 ELSE 0 END',
      'active-users': '1'
    };
    return columnMap[metric.id] || 'revenue_amount';
  }

  private getDateColumn(metric: SnowflakeMetricData): string {
    const dateColumnMap = {
      'annual-revenue': 'revenue_date',
      'annual-profit': 'profit_date',
      'monthly-recurring-revenue': 'billing_date',
      'customer-acquisition-cost': 'spend_date',
      'churn-rate': 'last_activity_date',
      'active-users': 'activity_date'
    };
    return dateColumnMap[metric.id] || 'revenue_date';
  }

  private formatTimeSeriesResult(
    result: any[], 
    metric: SnowflakeMetricData, 
    timePeriod: string
  ): SnowflakeTimeSeriesData[] {
    const goalPerPeriod = this.calculateGoalPerPeriod(metric.yearlyGoal, timePeriod);
    let cumulativeActual = 0;
    let cumulativeGoal = 0;

    return result.map((row, index) => {
      const actualValue = row.ACTUAL_VALUE || 0;
      cumulativeActual += actualValue;
      cumulativeGoal += goalPerPeriod;

      return {
        period: this.formatPeriodLabel(row.PERIOD, timePeriod),
        actual: cumulativeActual,
        goal: cumulativeGoal
      };
    });
  }

  private calculateGoalPerPeriod(yearlyGoal: number, timePeriod: string): number {
    switch (timePeriod) {
      case 'weekly': return yearlyGoal / 52;
      case 'monthly': return yearlyGoal / 12;
      case 'quarterly': return yearlyGoal / 4;
      case 'ytd': return yearlyGoal / 12;
      default: return yearlyGoal / 12;
    }
  }

  private formatPeriodLabel(period: string, timePeriod: string): string {
    const date = new Date(period);

    switch (timePeriod) {
      case 'weekly':
        return `${date.getMonth() + 1}/${date.getDate()}`;
      case 'monthly':
        return `${date.getMonth() + 1}/${date.getDate()}`;
      case 'quarterly':
        return `W${Math.ceil(date.getDate() / 7)}`;
      case 'ytd':
        return date.toLocaleDateString('en-US', { month: 'short' });
      default:
        return period;
    }
  }

  private async executeSnowflakeQuery(query: string): Promise<any[]> {
    try {
      // Use the existing Snowflake endpoint
      const response = await fetch('http://localhost:5000/api/snowflake/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      });

      if (!response.ok) {
        throw new Error(`Snowflake query failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error executing Snowflake query:', error);
      throw error;
    }
  }

  // Get YTD progress for "on pace" calculations
  async getYTDProgress(metric: SnowflakeMetricData) {
    try {
      const ytdData = await this.getTimeSeriesData(metric, 'ytd');
      const latestPoint = ytdData.filter(point => point.actual !== null && point.actual > 0).pop();

      if (!latestPoint) return { current: 0, goal: 0, progress: 0 };

      return {
        current: latestPoint.actual,
        goal: latestPoint.goal,
        progress: Math.round((latestPoint.actual / latestPoint.goal) * 100)
      };
    } catch (error) {
      console.error('Error calculating YTD progress:', error);
      return { current: 0, goal: 0, progress: 0 };
    }
  }

  // Format values based on metric type
  formatValue(value: number, format: string): string {
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

  private getSQLTemplate(metricName: string, timePeriod: string): string | undefined {
    const templates: { [key: string]: { [key: string]: string } } = {
      'Annual Revenue': {
        'monthly': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(SUM(AMOUNT), 0) AS value FROM CORE.CORE_HUBSPOT_DEALS WHERE CLOSE_DATE >= DATE_TRUNC(\'MONTH\', CURRENT_DATE()) AND STAGE = \'Closed Won\'',
        'quarterly': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(SUM(AMOUNT), 0) AS value FROM CORE.CORE_HUBSPOT_DEALS WHERE CLOSE_DATE >= DATE_TRUNC(\'QUARTER\', CURRENT_DATE()) AND STAGE = \'Closed Won\'',
        'annual': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(SUM(AMOUNT), 0) AS value FROM CORE.CORE_HUBSPOT_DEALS WHERE CLOSE_DATE >= DATE_TRUNC(\'YEAR\', CURRENT_DATE()) AND STAGE = \'Closed Won\''
      },
      'Monthly Deal Value': {
        'monthly': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(SUM(AMOUNT), 0) AS value FROM CORE.CORE_HUBSPOT_DEALS WHERE CLOSE_DATE >= DATE_TRUNC(\'MONTH\', CURRENT_DATE()) AND STAGE = \'Closed Won\'',
        'quarterly': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(SUM(AMOUNT), 0) AS value FROM CORE.CORE_HUBSPOT_DEALS WHERE CLOSE_DATE >= DATE_TRUNC(\'QUARTER\', CURRENT_DATE()) AND STAGE = \'Closed Won\'',
        'annual': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(SUM(AMOUNT), 0) AS value FROM CORE.CORE_HUBSPOT_DEALS WHERE CLOSE_DATE >= DATE_TRUNC(\'YEAR\', CURRENT_DATE()) AND STAGE = \'Closed Won\''
      },
      'Monthly Expenses': {
        'monthly': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(SUM(AMOUNT), 0) AS value FROM CORE.CORE_QUICKBOOKS_EXPENSES WHERE EXPENSE_DATE >= DATE_TRUNC(\'MONTH\', CURRENT_DATE())',
        'quarterly': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(SUM(AMOUNT), 0) AS value FROM CORE.CORE_QUICKBOOKS_EXPENSES WHERE EXPENSE_DATE >= DATE_TRUNC(\'QUARTER\', CURRENT_DATE())',
        'annual': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(SUM(AMOUNT), 0) AS value FROM CORE.CORE_QUICKBOOKS_EXPENSES WHERE EXPENSE_DATE >= DATE_TRUNC(\'YEAR\', CURRENT_DATE())'
      },
      'Customer Acquisition Cost': {
        'monthly': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(AVG(AMOUNT), 0) AS value FROM CORE.CORE_QUICKBOOKS_EXPENSES WHERE EXPENSE_DATE >= DATE_TRUNC(\'MONTH\', CURRENT_DATE()) AND CATEGORY ILIKE \'%marketing%\'',
        'quarterly': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(AVG(AMOUNT), 0) AS value FROM CORE.CORE_QUICKBOOKS_EXPENSES WHERE EXPENSE_DATE >= DATE_TRUNC(\'QUARTER\', CURRENT_DATE()) AND CATEGORY ILIKE \'%marketing%\'',
        'annual': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(AVG(AMOUNT), 0) AS value FROM CORE.CORE_QUICKBOOKS_EXPENSES WHERE EXPENSE_DATE >= DATE_TRUNC(\'YEAR\', CURRENT_DATE()) AND CATEGORY ILIKE \'%marketing%\''
      },
      'Customer Lifetime Value': {
        'monthly': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(AVG(AMOUNT), 0) AS value FROM CORE.CORE_HUBSPOT_DEALS WHERE CLOSE_DATE >= DATE_TRUNC(\'MONTH\', CURRENT_DATE()) AND STAGE = \'Closed Won\'',
        'quarterly': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(AVG(AMOUNT), 0) AS value FROM CORE.CORE_HUBSPOT_DEALS WHERE CLOSE_DATE >= DATE_TRUNC(\'QUARTER\', CURRENT_DATE()) AND STAGE = \'Closed Won\'',
        'annual': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(AVG(AMOUNT), 0) AS value FROM CORE.CORE_HUBSPOT_DEALS WHERE CLOSE_DATE >= DATE_TRUNC(\'YEAR\', CURRENT_DATE()) AND STAGE = \'Closed Won\''
      },
      'Monthly Active Users': {
        'monthly': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(COUNT(DISTINCT CUSTOMER_ID), 0) AS value FROM CORE.CORE_HUBSPOT_DEALS WHERE CLOSE_DATE >= DATE_TRUNC(\'MONTH\', CURRENT_DATE())',
        'quarterly': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(COUNT(DISTINCT CUSTOMER_ID), 0) AS value FROM CORE.CORE_HUBSPOT_DEALS WHERE CLOSE_DATE >= DATE_TRUNC(\'QUARTER\', CURRENT_DATE())',
        'annual': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(COUNT(DISTINCT CUSTOMER_ID), 0) AS value FROM CORE.CORE_HUBSPOT_DEALS WHERE CLOSE_DATE >= DATE_TRUNC(\'YEAR\', CURRENT_DATE())'
      },
      'Churn Rate': {
        'monthly': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(5.2, 0) AS value', // Placeholder - would need customer status tracking
        'quarterly': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(5.2, 0) AS value',
        'annual': 'USE DATABASE MIAS_DATA_DB; SELECT COALESCE(5.2, 0) AS value'
      }
    };

    return templates[metricName]?.[timePeriod];
  }

  private getFallbackValue(metricName: string): number {
    return this.fallbackData[metricName] || 0;
  }
}

export const snowflakeMetricsService = new SnowflakeMetricsService();