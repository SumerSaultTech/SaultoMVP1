import { storage } from "../storage";
import { snowflakePythonService } from "./snowflake-python";

interface SnowflakeQueryResult {
  success: boolean;
  data?: any[];
  error?: string;
}

interface MetricCalculationResult {
  metricId: number;
  value: string;
  calculatedAt: Date;
  period: string;
  success: boolean;
  error?: string;
}

// SQL query templates for MIAS_DATA_DB structure
const SQL_TEMPLATES = {
  // Revenue metrics from CORE_QUICKBOOKS_REVENUE
  'annual-revenue': `
    SELECT SUM(AMOUNT) as value 
    FROM MIAS_DATA_DB.PUBLIC.CORE_QUICKBOOKS_REVENUE 
    WHERE YEAR(TRANSACTION_DATE) = YEAR(CURRENT_DATE())
  `,
  
  'monthly-revenue': `
    SELECT SUM(AMOUNT) as value 
    FROM MIAS_DATA_DB.PUBLIC.CORE_QUICKBOOKS_REVENUE 
    WHERE YEAR(TRANSACTION_DATE) = YEAR(CURRENT_DATE()) 
    AND MONTH(TRANSACTION_DATE) = MONTH(CURRENT_DATE())
  `,
  
  'quarterly-revenue': `
    SELECT SUM(AMOUNT) as value 
    FROM MIAS_DATA_DB.PUBLIC.CORE_QUICKBOOKS_REVENUE 
    WHERE YEAR(TRANSACTION_DATE) = YEAR(CURRENT_DATE()) 
    AND QUARTER(TRANSACTION_DATE) = QUARTER(CURRENT_DATE())
  `,

  // Expense and profit metrics
  'annual-expenses': `
    SELECT SUM(AMOUNT) as value 
    FROM MIAS_DATA_DB.PUBLIC.CORE_QUICKBOOKS_EXPENSES 
    WHERE YEAR(TRANSACTION_DATE) = YEAR(CURRENT_DATE())
  `,
  
  'annual-profit': `
    SELECT 
      COALESCE(revenue.total, 0) - COALESCE(expenses.total, 0) as value
    FROM 
      (SELECT SUM(AMOUNT) as total FROM MIAS_DATA_DB.PUBLIC.CORE_QUICKBOOKS_REVENUE WHERE YEAR(TRANSACTION_DATE) = YEAR(CURRENT_DATE())) revenue
    CROSS JOIN
      (SELECT SUM(AMOUNT) as total FROM MIAS_DATA_DB.PUBLIC.CORE_QUICKBOOKS_EXPENSES WHERE YEAR(TRANSACTION_DATE) = YEAR(CURRENT_DATE())) expenses
  `,

  // HubSpot deal metrics from CORE_HUBSPOT_DEALS
  'conversion-rate': `
    SELECT 
      CASE WHEN COUNT(*) > 0 
      THEN (COUNT(CASE WHEN DEAL_STAGE = 'closedwon' THEN 1 END) * 100.0 / COUNT(*))
      ELSE 0 END as value
    FROM MIAS_DATA_DB.PUBLIC.CORE_HUBSPOT_DEALS 
    WHERE YEAR(DEAL_CREATE_DATE) = YEAR(CURRENT_DATE())
  `,
  
  'deals-closed': `
    SELECT COUNT(*) as value 
    FROM MIAS_DATA_DB.PUBLIC.CORE_HUBSPOT_DEALS 
    WHERE DEAL_STAGE = 'closedwon' 
    AND YEAR(DEAL_CLOSE_DATE) = YEAR(CURRENT_DATE())
  `,
  
  'average-deal-size': `
    SELECT AVG(DEAL_AMOUNT) as value 
    FROM MIAS_DATA_DB.PUBLIC.CORE_HUBSPOT_DEALS 
    WHERE DEAL_STAGE = 'closedwon' 
    AND YEAR(DEAL_CLOSE_DATE) = YEAR(CURRENT_DATE())
    AND DEAL_AMOUNT IS NOT NULL
  `,

  // Call and activity metrics
  'total-calls': `
    SELECT COUNT(*) as value 
    FROM HUBSPOT_CALLS 
    WHERE YEAR(TIMESTAMP) = YEAR(CURRENT_DATE())
  `,
  
  'calls-per-deal': `
    SELECT 
      (SELECT COUNT(*) FROM HUBSPOT_CALLS WHERE YEAR(TIMESTAMP) = YEAR(CURRENT_DATE())) /
      NULLIF((SELECT COUNT(*) FROM HUBSPOT_DEALS WHERE YEAR(CREATEDATE) = YEAR(CURRENT_DATE())), 0) as value
  `
};

export class SnowflakeCalculatorService {
  private lastCalculated: Map<number, Date> = new Map();
  private readonly CACHE_DURATION_HOURS = 1;

  // Execute SQL query against Snowflake using Python service
  private async executeQuery(sql: string): Promise<SnowflakeQueryResult> {
    try {
      console.log("Executing Snowflake query via Python:", sql);
      return await snowflakePythonService.executeQuery(sql);
    } catch (error) {
      console.error("Snowflake query error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  // Get SQL template for a metric based on its name or category
  private getSQLTemplate(metricName: string, category: string): string | null {
    const normalizedName = metricName.toLowerCase().replace(/\s+/g, '-');
    
    // Try exact match first
    if (SQL_TEMPLATES[normalizedName as keyof typeof SQL_TEMPLATES]) {
      return SQL_TEMPLATES[normalizedName as keyof typeof SQL_TEMPLATES];
    }

    // Try category-based matching
    const categoryTemplates: Record<string, string> = {
      'revenue': SQL_TEMPLATES['annual-revenue'],
      'profit': SQL_TEMPLATES['annual-profit'],
      'customer': SQL_TEMPLATES['conversion-rate'],
      'efficiency': SQL_TEMPLATES['conversion-rate']
    };

    return categoryTemplates[category] || null;
  }

  // Check if metric needs recalculation (cache expired)
  private needsRecalculation(metricId: number): boolean {
    const lastCalc = this.lastCalculated.get(metricId);
    if (!lastCalc) return true;

    const hoursSinceCalc = (Date.now() - lastCalc.getTime()) / (1000 * 60 * 60);
    return hoursSinceCalc >= this.CACHE_DURATION_HOURS;
  }

  // Calculate actual value for a single metric
  async calculateMetric(metricId: number): Promise<MetricCalculationResult> {
    try {
      // Get metric details
      const metric = await storage.getKpiMetric(metricId);
      if (!metric) {
        return {
          metricId,
          value: "0",
          calculatedAt: new Date(),
          period: "current",
          success: false,
          error: "Metric not found"
        };
      }

      // Check if recalculation is needed
      if (!this.needsRecalculation(metricId)) {
        return {
          metricId,
          value: metric.value || "0",
          calculatedAt: new Date(),
          period: "current",
          success: true,
          error: "Using cached value"
        };
      }

      // Get SQL template
      let sql = metric.sqlQuery;
      if (!sql) {
        sql = this.getSQLTemplate(metric.name, metric.category);
      }

      if (!sql) {
        return {
          metricId,
          value: "0",
          calculatedAt: new Date(),
          period: "current",
          success: false,
          error: "No SQL query defined for this metric"
        };
      }

      // Execute query
      const result = await this.executeQuery(sql);
      
      if (!result.success) {
        return {
          metricId,
          value: "0",
          calculatedAt: new Date(),
          period: "current",
          success: false,
          error: result.error
        };
      }

      // Extract value from result
      const calculatedValue = result.data?.[0]?.value || 0;
      const formattedValue = this.formatValue(calculatedValue, metric.format || 'number');

      // Update metric with calculated value
      await storage.updateKpiMetric(metricId, {
        value: formattedValue
      });

      // Update cache timestamp
      this.lastCalculated.set(metricId, new Date());

      return {
        metricId,
        value: formattedValue,
        calculatedAt: new Date(),
        period: "current",
        success: true
      };

    } catch (error) {
      console.error("Error calculating metric:", error);
      return {
        metricId,
        value: "0",
        calculatedAt: new Date(),
        period: "current",
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      };
    }
  }

  // Format value based on metric format
  private formatValue(value: number, format: string): string {
    switch (format) {
      case 'currency':
        return value.toLocaleString('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        });
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'number':
        return value.toLocaleString();
      default:
        return value.toString();
    }
  }

  // Test connection method for debugging
  async testConnection(testQuery: string = "SELECT 1 as test_value"): Promise<SnowflakeQueryResult> {
    return this.executeQuery(testQuery);
  }

  // Calculate all metrics for a company
  async calculateAllMetrics(companyId: number): Promise<MetricCalculationResult[]> {
    const metrics = await storage.getKpiMetrics(companyId);
    const results: MetricCalculationResult[] = [];

    for (const metric of metrics) {
      const result = await this.calculateMetric(metric.id);
      results.push(result);
    }

    return results;
  }

  // Get metrics that need recalculation
  async getStaleMetrics(companyId: number): Promise<number[]> {
    const metrics = await storage.getKpiMetrics(companyId);
    return metrics
      .filter(metric => this.needsRecalculation(metric.id))
      .map(metric => metric.id);
  }
}

export const snowflakeCalculatorService = new SnowflakeCalculatorService();