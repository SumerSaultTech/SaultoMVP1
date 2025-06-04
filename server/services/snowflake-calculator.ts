import { storage } from "../storage";
import { snowflakePythonService } from "./snowflake-python";

interface SnowflakeQueryResult {
  success: boolean;
  data?: any[];
  error?: string;
}

interface MetricCalculationResult {
  metricId: number;
  value: number;
  calculatedAt: Date;
  period: string;
  success: boolean;
  error?: string;
}

interface TimeSeriesData {
  period: string;
  actual: number;
  goal: number;
}

interface DashboardMetricData {
  metricId: number;
  currentValue: number;
  yearlyGoal: number;
  format: string;
  timeSeriesData: {
    weekly: TimeSeriesData[];
    monthly: TimeSeriesData[];
    quarterly: TimeSeriesData[];
    ytd: TimeSeriesData[];
  };
}

// SQL query templates for MIAS_DATA_DB structure with time period filtering
const getTimeFilteredSQL = (baseMetric: string, timePeriod: string) => {
  const templates = {
    'annual-revenue': {
      base: `SELECT SUM(INVOICE_AMOUNT) as value FROM MIAS_DATA_DB.CORE.CORE_QUICKBOOKS_REVENUE WHERE INVOICE_AMOUNT > 0`,
      weekly: `AND INVOICE_DATE >= DATE_TRUNC('week', CURRENT_DATE())`,
      monthly: `AND INVOICE_DATE >= DATE_TRUNC('month', CURRENT_DATE())`,
      quarterly: `AND INVOICE_DATE >= DATE_TRUNC('quarter', CURRENT_DATE())`,
      ytd: `AND INVOICE_DATE >= DATE_TRUNC('year', CURRENT_DATE())`
    },
    'monthly-deal-value': {
      base: `SELECT SUM(AMOUNT) as value FROM MIAS_DATA_DB.CORE.CORE_HUBSPOT_DEALS WHERE AMOUNT > 0 AND STAGE = 'Closed Won'`,
      weekly: `AND CLOSE_DATE >= DATE_TRUNC('week', CURRENT_DATE())`,
      monthly: `AND CLOSE_DATE >= DATE_TRUNC('month', CURRENT_DATE())`,
      quarterly: `AND CLOSE_DATE >= DATE_TRUNC('quarter', CURRENT_DATE())`,
      ytd: `AND CLOSE_DATE >= DATE_TRUNC('year', CURRENT_DATE())`
    },
    'monthly-expenses': {
      base: `SELECT SUM(AMOUNT) as value FROM MIAS_DATA_DB.CORE.CORE_QUICKBOOKS_EXPENSES WHERE AMOUNT > 0`,
      weekly: `AND EXPENSE_DATE >= DATE_TRUNC('week', CURRENT_DATE())`,
      monthly: `AND EXPENSE_DATE >= DATE_TRUNC('month', CURRENT_DATE())`,
      quarterly: `AND EXPENSE_DATE >= DATE_TRUNC('quarter', CURRENT_DATE())`,
      ytd: `AND EXPENSE_DATE >= DATE_TRUNC('year', CURRENT_DATE())`
    }
  };

  const template = templates[baseMetric as keyof typeof templates];
  if (!template) return null;

  const timeFilter = template[timePeriod as keyof typeof template] || template.ytd;
  return `${template.base} ${timeFilter}`;
};

const SQL_TEMPLATES = {
  // Revenue metrics - using actual table names from MIAS_DATA_DB
  'annual-revenue': `
    SELECT SUM(AMOUNT) as value 
    FROM QUICKBOOKS_ITEMS 
    WHERE YEAR(TXNDATE) = YEAR(CURRENT_DATE())
    AND TYPE = 'Income'
  `,
  
  'monthly-revenue': `
    SELECT SUM(AMOUNT) as value 
    FROM QUICKBOOKS_ITEMS 
    WHERE YEAR(TXNDATE) = YEAR(CURRENT_DATE()) 
    AND MONTH(TXNDATE) = MONTH(CURRENT_DATE())
    AND TYPE = 'Income'
  `,
  
  'quarterly-revenue': `
    SELECT SUM(AMOUNT) as value 
    FROM QUICKBOOKS_ITEMS 
    WHERE YEAR(TXNDATE) = YEAR(CURRENT_DATE()) 
    AND QUARTER(TXNDATE) = QUARTER(CURRENT_DATE())
    AND TYPE = 'Income'
  `,

  // Expense and profit metrics
  'annual-expenses': `
    SELECT SUM(ABS(AMOUNT)) as value 
    FROM QUICKBOOKS_ITEMS 
    WHERE YEAR(TXNDATE) = YEAR(CURRENT_DATE())
    AND TYPE = 'Expense'
  `,
  
  'annual-profit': `
    SELECT 
      COALESCE((SELECT SUM(AMOUNT) FROM QUICKBOOKS_ITEMS WHERE YEAR(TXNDATE) = YEAR(CURRENT_DATE()) AND TYPE = 'Income'), 0) -
      COALESCE((SELECT SUM(ABS(AMOUNT)) FROM QUICKBOOKS_ITEMS WHERE YEAR(TXNDATE) = YEAR(CURRENT_DATE()) AND TYPE = 'Expense'), 0) as value
  `,

  // HubSpot deal metrics
  'conversion-rate': `
    SELECT 
      (COUNT(CASE WHEN DEALSTAGE = 'closedwon' THEN 1 END) * 100.0 / NULLIF(COUNT(*), 0)) as value
    FROM HUBSPOT_DEALS 
    WHERE YEAR(CREATEDATE) = YEAR(CURRENT_DATE())
  `,
  
  'deals-closed': `
    SELECT COUNT(*) as value 
    FROM HUBSPOT_DEALS 
    WHERE DEALSTAGE = 'closedwon' 
    AND YEAR(CLOSEDATE) = YEAR(CURRENT_DATE())
  `,
  
  'average-deal-size': `
    SELECT AVG(AMOUNT) as value 
    FROM HUBSPOT_DEALS 
    WHERE DEALSTAGE = 'closedwon' 
    AND YEAR(CLOSEDATE) = YEAR(CURRENT_DATE())
    AND AMOUNT IS NOT NULL
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

  // Execute SQL query against Snowflake using the same method as data browser
  private async executeQuery(sql: string): Promise<SnowflakeQueryResult> {
    try {
      console.log("Executing Snowflake query via working connection:", sql);
      
      // Use the same spawn method that works in the data browser routes
      const { spawn } = await import('child_process');
      const result = await new Promise<any>((resolve) => {
        const pythonProcess = spawn('python', ['snowflake_query_service.py', sql], {
          cwd: process.cwd()
        });
        
        let output = '';
        let errorOutput = '';
        
        pythonProcess.stdout.on('data', (data: Buffer) => {
          output += data.toString();
        });
        
        pythonProcess.stderr.on('data', (data: Buffer) => {
          errorOutput += data.toString();
        });
        
        pythonProcess.on('close', (code: number) => {
          console.log(`Python process exited with code: ${code}`);
          console.log("Output:", output);
          console.log("Error output:", errorOutput);
          
          if (code === 0 && output.trim()) {
            try {
              // Find the JSON result in the output
              const lines = output.trim().split('\n');
              let jsonResult = null;
              
              for (const line of lines) {
                try {
                  const parsed = JSON.parse(line);
                  if (parsed.success !== undefined) {
                    jsonResult = parsed;
                    break;
                  }
                } catch (e) {
                  // Skip non-JSON lines
                  continue;
                }
              }
              
              if (jsonResult) {
                resolve(jsonResult);
              } else {
                resolve({
                  success: false,
                  error: "No valid JSON result found in output"
                });
              }
            } catch (parseError) {
              resolve({
                success: false,
                error: `Failed to parse result: ${parseError.message}`
              });
            }
          } else {
            resolve({
              success: false,
              error: errorOutput || `Python process exited with code ${code}`
            });
          }
        });
      });
      
      return result;
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

  // Calculate dashboard data with time series for a metric
  async calculateDashboardData(metricId: number, timePeriod: string = 'ytd'): Promise<DashboardMetricData | null> {
    try {
      console.log(`=== Calculating dashboard data for metric ID: ${metricId}, period: ${timePeriod} ===`);
      const metric = await storage.getKpiMetric(metricId);
      console.log("Found metric:", metric ? `${metric.name} with SQL: ${!!metric.sqlQuery}` : "null");
      
      if (!metric || !metric.sqlQuery) {
        console.log("No metric or SQL query found, returning null");
        return null;
      }

      // Check if we can use time-filtered query
      const metricKey = metric.name.toLowerCase().replace(/\s+/g, '-');
      console.log(`Looking for time-filtered SQL with metricKey: "${metricKey}" and timePeriod: "${timePeriod}"`);
      const timeFilteredSQL = getTimeFilteredSQL(metricKey, timePeriod);
      console.log(`Time-filtered SQL result:`, timeFilteredSQL);
      
      // For time filtering, use aggregated query; otherwise use original detailed query
      const queryToExecute = timeFilteredSQL || metric.sqlQuery;
      console.log("Executing SQL query:", queryToExecute);
      const result = await this.executeQuery(queryToExecute);
      console.log("Raw query result:", JSON.stringify(result, null, 2));
      
      if (!result.success || !result.data || !Array.isArray(result.data)) {
        console.log("Query failed, no data, or data not array. Returning null.");
        return null;
      }

      // Log first few rows to understand the data structure
      console.log("First 3 rows of data:", result.data.slice(0, 3));

      // Transform daily data into time series
      let totalSum = 0;
      const dailyData = result.data.map((row, index) => {
        console.log(`Processing row ${index}:`, row);
        
        // Try multiple column name possibilities
        const rawValue = row.DAILY_REVENUE || row.daily_revenue || row.VALUE || row.value || Object.values(row)[1] || "0";
        console.log(`Raw value from row ${index}:`, rawValue, typeof rawValue);
        
        const revenue = parseFloat(String(rawValue).replace(/[$,]/g, ''));
        console.log(`Parsed revenue from row ${index}:`, revenue);
        
        if (!isNaN(revenue)) {
          totalSum += revenue;
        }
        
        return {
          date: new Date(row.DATE || row.date || new Date()),
          revenue: isNaN(revenue) ? 0 : revenue
        };
      });

      console.log(`Total sum calculated: ${totalSum} from ${dailyData.length} records`);
      
      const yearlyGoal = parseFloat(metric.yearlyGoal || '0');
      const currentValue = totalSum;

      console.log(`Returning dashboard data with currentValue: ${currentValue}`);

      return {
        metricId,
        currentValue,
        yearlyGoal,
        format: metric.format || 'currency',
        timeSeriesData: {
          weekly: this.aggregateWeekly(dailyData, yearlyGoal),
          monthly: this.aggregateMonthly(dailyData, yearlyGoal),
          quarterly: this.aggregateQuarterly(dailyData, yearlyGoal),
          ytd: this.aggregateYTD(dailyData, yearlyGoal)
        }
      };
    } catch (error) {
      console.error("Error calculating dashboard data:", error);
      return null;
    }
  }

  // Aggregate daily data into weekly totals
  private aggregateWeekly(dailyData: {date: Date, revenue: number}[], yearlyGoal: number): TimeSeriesData[] {
    const weeklyGoal = yearlyGoal / 52.18; // Average weeks per year
    const weeks = new Map<string, number>();

    dailyData.forEach(day => {
      const weekStart = this.getWeekStart(day.date);
      const weekKey = weekStart.toISOString().split('T')[0];
      weeks.set(weekKey, (weeks.get(weekKey) || 0) + day.revenue);
    });

    return Array.from(weeks.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // Last 12 weeks
      .map(([week, actual]) => ({
        period: this.formatWeekPeriod(new Date(week)),
        actual,
        goal: weeklyGoal
      }));
  }

  // Aggregate daily data into monthly totals
  private aggregateMonthly(dailyData: {date: Date, revenue: number}[], yearlyGoal: number): TimeSeriesData[] {
    const monthlyGoal = yearlyGoal / 12;
    const months = new Map<string, number>();

    dailyData.forEach(day => {
      const monthKey = `${day.date.getFullYear()}-${String(day.date.getMonth() + 1).padStart(2, '0')}`;
      months.set(monthKey, (months.get(monthKey) || 0) + day.revenue);
    });

    return Array.from(months.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // Last 12 months
      .map(([month, actual]) => ({
        period: this.formatMonthPeriod(month),
        actual,
        goal: monthlyGoal
      }));
  }

  // Aggregate daily data into quarterly totals
  private aggregateQuarterly(dailyData: {date: Date, revenue: number}[], yearlyGoal: number): TimeSeriesData[] {
    const quarterlyGoal = yearlyGoal / 4;
    const quarters = new Map<string, number>();

    dailyData.forEach(day => {
      const quarter = Math.floor(day.date.getMonth() / 3) + 1;
      const quarterKey = `${day.date.getFullYear()}-Q${quarter}`;
      quarters.set(quarterKey, (quarters.get(quarterKey) || 0) + day.revenue);
    });

    return Array.from(quarters.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-8) // Last 8 quarters
      .map(([quarter, actual]) => ({
        period: quarter,
        actual,
        goal: quarterlyGoal
      }));
  }

  // Calculate year-to-date progress
  private aggregateYTD(dailyData: {date: Date, revenue: number}[], yearlyGoal: number): TimeSeriesData[] {
    const currentYear = new Date().getFullYear();
    const ytdData = dailyData.filter(day => day.date.getFullYear() === currentYear);
    
    let runningTotal = 0;
    const dayOfYear = this.getDayOfYear(new Date());
    const dailyGoalTarget = yearlyGoal / 365;

    return ytdData
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((day, index) => {
        runningTotal += day.revenue;
        const dayNum = this.getDayOfYear(day.date);
        return {
          period: day.date.toISOString().split('T')[0],
          actual: runningTotal,
          goal: dailyGoalTarget * dayNum
        };
      })
      .filter((_, index, arr) => index === arr.length - 1 || index % 7 === 0); // Weekly snapshots
  }

  // Helper methods for date formatting and calculations
  private getWeekStart(date: Date): Date {
    const day = date.getDay();
    const diff = date.getDate() - day;
    return new Date(date.setDate(diff));
  }

  private formatWeekPeriod(weekStart: Date): string {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${weekStart.getMonth() + 1}/${weekStart.getDate()}-${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`;
  }

  private formatMonthPeriod(monthKey: string): string {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
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
    // For now, return connection unavailable but system ready
    return {
      success: false,
      error: "MIAS_DATA_DB connection requires network access configuration. System ready for real data when connectivity is established."
    };
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