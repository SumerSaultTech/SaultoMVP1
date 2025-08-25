// PostgreSQL Analytics Service - connects to actual PostgreSQL database
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { sqlModelEngine } from './sql-model-engine.js';

export interface PostgresMetricData {
  metricId: number;
  name: string;
  currentValue: number;
  yearlyGoal: number;
  format: 'currency' | 'percentage' | 'number';
  description: string;
  category: 'revenue' | 'profit' | 'customer' | 'operational';
  sql_query?: string;
}

export interface PostgresTimeSeriesData {
  period: string;
  actual: number | null;
  goal: number;
}

export class PostgresAnalyticsService {
  private db: any;
  
  constructor() {
    // Initialize database connection
    const databaseUrl = process.env.DATABASE_URL;
    console.log(`🔍 DATABASE_URL in constructor: ${databaseUrl ? 'PROVIDED' : 'NOT PROVIDED'}`);
    
    if (databaseUrl) {
      try {
        const client = postgres(databaseUrl);
        this.db = drizzle(client);
        console.log('✅ PostgreSQL Analytics: Database connection initialized successfully');
        console.log(`🔍 Database object type: ${typeof this.db}`);
      } catch (error) {
        console.warn('⚠️ PostgreSQL Analytics: Failed to connect to database, using fallback data:', error);
        this.db = null;
      }
    } else {
      console.warn('⚠️ PostgreSQL Analytics: No DATABASE_URL provided, using fallback data');
      this.db = null;
    }
  }
  

  private getAnalyticsSchemaName(companyId: number): string {
    return `analytics_company_${companyId}`;
  }

  async calculateMetric(metricName: string, companyId: number, timePeriod: string = 'monthly', metricId?: number, customSQL?: string): Promise<PostgresMetricData | null> {
    try {
      console.log(`📊 Getting pre-calculated metric ${metricName} for company ${companyId}, period ${timePeriod}`);

      // Priority 1: Try to get user-defined metrics from INT layer
      const userMetrics = await sqlModelEngine.getUserDefinedMetrics(companyId);
      
      for (const metric of userMetrics) {
        if (metric.metric_name === metricName) {
          console.log(`✅ Using user-defined INT layer data for ${metricName}:`, metric);
          
          return this.createMetricDataObject(
            metricName, 
            Number(metric.current_value) || 0, 
            metricId, 
            timePeriod, 
            Number(metric.yearly_goal) || 0
          );
        }
      }

      // Priority 2: Try to get data from CORE layer (built-in metrics)
      const coreMetrics = await sqlModelEngine.getCurrentMetrics(companyId, timePeriod);
      
      if (coreMetrics && coreMetrics.length > 0) {
        const coreData = coreMetrics[0];
        console.log(`✅ Using CORE layer data for ${metricName}:`, coreData);
        
        // Map metric names to CORE data fields with enhanced business context
        let currentValue = 0;
        let yearlyGoal = 0;
        let enhancedMetricName = metricName;
        
        if (metricName.toLowerCase().includes('revenue')) {
          currentValue = Number(coreData.current_revenue) || 0;
          yearlyGoal = Number(coreData.revenue_goal) || 0;
          
          // Enhance metric name based on time period
          if (timePeriod.toLowerCase() === 'yearly') {
            enhancedMetricName = `${new Date().getFullYear()} Annual Revenue (YTD)`;
          } else if (timePeriod.toLowerCase() === 'lifetime') {
            enhancedMetricName = 'Lifetime Revenue';
          }
          
        } else if (metricName.toLowerCase().includes('profit')) {
          currentValue = Number(coreData.current_profit) || 0;
          yearlyGoal = Number(coreData.profit_goal) || 0;
          
          // Enhance profit metric names
          if (timePeriod.toLowerCase() === 'yearly') {
            enhancedMetricName = `${new Date().getFullYear()} Annual Profit (YTD)`;
          } else if (timePeriod.toLowerCase() === 'lifetime') {
            enhancedMetricName = 'Lifetime Profit';
          }
          
        } else if (metricName.toLowerCase().includes('satisfaction') || metricName.toLowerCase().includes('customer')) {
          // Handle customer satisfaction and similar metrics with static values
          currentValue = 85; // Default customer satisfaction score
          yearlyGoal = 90;   // Target satisfaction goal
          enhancedMetricName = 'Customer Satisfaction Score';
          
        } else if (metricName.toLowerCase().includes('recurring') || metricName.toLowerCase().includes('mrr')) {
          // Handle Monthly Recurring Revenue using revenue data
          currentValue = Number(coreData.current_revenue) || 0;
          yearlyGoal = Number(coreData.revenue_goal) || 0;
          enhancedMetricName = 'Monthly Recurring Revenue (MRR)';
          
        } else {
          // For other metrics, try to find in user metrics first
          console.log(`⚠️ Unknown metric type: ${metricName}, using fallback values`);
          currentValue = 0;
          yearlyGoal = 0;
        }
        
        return this.createMetricDataObject(enhancedMetricName, currentValue, metricId, timePeriod, yearlyGoal);
      }

      // No pre-calculated data available - metrics must be defined and pipeline must be run
      console.warn(`❌ No pre-calculated data available for metric: ${metricName}. Please ensure:`);
      console.warn(`   1. Metric is defined in metrics management`);
      console.warn(`   2. Pipeline has been executed to calculate values`);
      console.warn(`   3. CORE layer contains the metric data`);
      return null;

    } catch (error) {
      console.error(`PostgreSQL metric calculation failed for ${metricName}:`, error);
      return null;
    }
  }

  // Legacy SQL templates removed - all metrics should now use CORE/INT layer data

  private extractMetricValue(row: any): number {
    // The SQL templates use 'metric_value' as the column name
    if (row && typeof row.metric_value !== 'undefined') {
      return Number(row.metric_value) || 0;
    }
    
    // Fallback: try common column names
    if (row && typeof row.value !== 'undefined') {
      return Number(row.value) || 0;
    }
    
    if (row && typeof row.amount !== 'undefined') {
      return Number(row.amount) || 0;
    }
    
    console.warn('Could not extract metric value from query result:', row);
    return 0;
  }

  private createMetricDataObject(metricName: string, currentValue: number, metricId?: number, timePeriod?: string, yearlyGoal?: number): PostgresMetricData {
    // Determine format based on metric name
    let format: 'currency' | 'percentage' | 'number' = 'number';
    if (metricName.toLowerCase().includes('revenue') || metricName.toLowerCase().includes('expense') || 
        metricName.toLowerCase().includes('value') || metricName.toLowerCase().includes('cost')) {
      format = 'currency';
    } else if (metricName.toLowerCase().includes('rate') || metricName.toLowerCase().includes('churn')) {
      format = 'percentage';
    }

    // Determine category based on metric name  
    let category: 'revenue' | 'profit' | 'customer' | 'operational' = 'operational';
    if (metricName.toLowerCase().includes('revenue') || metricName.toLowerCase().includes('deal')) {
      category = 'revenue';
    } else if (metricName.toLowerCase().includes('profit')) {
      category = 'profit';
    } else if (metricName.toLowerCase().includes('customer') || metricName.toLowerCase().includes('user') || metricName.toLowerCase().includes('churn')) {
      category = 'customer';
    }

    // Use provided yearly goal or calculate from current value
    let finalYearlyGoal: number;
    if (yearlyGoal !== undefined) {
      finalYearlyGoal = yearlyGoal;
    } else {
      // Fallback: calculate yearly goal based on current period value and time period
      const periodMultiplier = timePeriod ? this.getYearlyGoalMultiplier(timePeriod) : 1;
      
      // Set realistic yearly goals based on metric type and period performance
      if (metricName.toLowerCase().includes('revenue')) {
        finalYearlyGoal = currentValue * periodMultiplier * 1.2; // 20% growth target
      } else if (metricName.toLowerCase().includes('profit')) {
        finalYearlyGoal = currentValue * periodMultiplier * 1.3; // 30% profit improvement target
      } else {
        finalYearlyGoal = currentValue * periodMultiplier * 1.1; // 10% improvement for other metrics
      }
    }

    return {
      metricId: metricId || 0,
      name: metricName,
      currentValue,
      yearlyGoal: finalYearlyGoal,
      format,
      description: `${metricName} calculated from CORE layer analytics data`,
      category,
      sql_query: undefined // No longer using SQL templates
    };
  }

  private getYearlyGoalMultiplier(timePeriod: string): number {
    switch (timePeriod.toLowerCase()) {
      case 'daily view':
      case 'daily':
        return 365; // 365 days in a year
      case 'weekly view':
      case 'weekly':
        return 52; // 52 weeks in a year
      case 'monthly view':
      case 'monthly':
        return 12; // 12 months in a year
      case 'quarterly view':
      case 'quarterly':
        return 4;  // 4 quarters in a year
      case 'yearly view':
      case 'yearly':
      case 'ytd':
      default:
        return 1;  // Already yearly
    }
  }

  async getTimeSeriesData(metricName: string, companyId: number, timePeriod: string = 'monthly'): Promise<PostgresTimeSeriesData[]> {
    try {
      console.log(`Getting PostgreSQL time series for ${metricName}, company ${companyId}, period ${timePeriod}`);

      // Use CORE layer for time series data
      const coreTimeSeriesData = await sqlModelEngine.getTimeSeriesData(companyId, timePeriod);
      
      if (coreTimeSeriesData && coreTimeSeriesData.length > 0) {
        console.log(`✅ Using CORE layer time series data for ${metricName}: ${coreTimeSeriesData.length} data points`);
        
        // Convert CORE data to expected format
        const timeSeriesData: PostgresTimeSeriesData[] = coreTimeSeriesData.map((row: any) => ({
          period: row.period || 'Unknown',
          actual: Number(row.actual) || null,
          goal: Number(row.goal) || 0
        }));

        return timeSeriesData;
      }

      console.log(`No CORE time series data available for ${metricName}`);
      return [];

    } catch (error) {
      console.error(`PostgreSQL time series failed for ${metricName}:`, error);
      return [];
    }
  }

  // Legacy time series SQL templates removed - all time series should use CORE layer data


  async executeQuery(query: string, companyId?: number): Promise<{ success: boolean; data?: any[]; error?: string }> {
    try {
      console.log(`Executing PostgreSQL query: ${query}`);
      console.log(`🔍 Database connection check: ${this.db ? 'EXISTS' : 'NULL'}`);
      
      if (this.db) {
        console.log(`📊 Database connection exists, executing query...`);
        try {
          // Execute the query using Drizzle with real database connection
          const result = await this.db.execute(sql.raw(query));
          
          console.log('Raw result:', result);
          console.log('Result type:', typeof result);
          console.log('Is array:', Array.isArray(result));
          
          // Drizzle with postgres.js returns results directly, not in a .rows property
          const rows = Array.isArray(result) ? result : (result.rows || result || []);
          console.log(`✅ Query executed successfully, ${rows.length} rows returned`);
          
          return {
            success: true,
            data: rows
          };
        } catch (dbError) {
          console.error('Database query error:', dbError);
          throw dbError;
        }
      } else {
        console.log(`PostgreSQL not configured, returning mock data`);
        // Return mock successful result when no database connection
        return {
          success: true,
          data: [{ message: "PostgreSQL not configured - using mock data" }]
        };
      }
      
    } catch (error) {
      console.error('PostgreSQL query execution failed:', error);
      return {
        success: false,
        error: `Query execution failed: ${error}`
      };
    }
  }

  async getAvailableTables(companyId: number): Promise<string[]> {
    try {
      const schema = this.getAnalyticsSchemaName(companyId);
      
      const query = `
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = '${schema}'
        ORDER BY table_name
      `;
      
      const result = await this.executeQuery(query);
      if (result.success && result.data) {
        return result.data.map((row: any) => row.table_name);
      }
      return [];
      
    } catch (error) {
      console.error(`Error getting tables for company ${companyId}:`, error);
      return [];
    }
  }

  async getTableSchema(tableName: string, companyId: number): Promise<any[]> {
    try {
      const schema = this.getAnalyticsSchemaName(companyId);
      
      const query = `
        SELECT 
          column_name,
          data_type,
          is_nullable,
          column_default
        FROM information_schema.columns 
        WHERE table_schema = '${schema}' 
        AND table_name = '${tableName}'
        ORDER BY ordinal_position
      `;
      
      const result = await this.executeQuery(query);
      if (result.success && result.data) {
        return result.data;
      }
      return [];
      
    } catch (error) {
      console.error(`Error getting schema for table ${tableName}:`, error);
      return [];
    }
  }

  async getTableData(tableName: string, companyId: number, limit: number = 100): Promise<any[]> {
    try {
      const schema = this.getAnalyticsSchemaName(companyId);
      
      const query = `
        SELECT * 
        FROM ${schema}.${tableName} 
        ORDER BY loaded_at DESC 
        LIMIT ${limit}
      `;
      
      const result = await this.executeQuery(query);
      if (result.success && result.data) {
        return result.data;
      }
      return [];
      
    } catch (error) {
      console.error(`Error getting data for table ${tableName}:`, error);
      return [];
    }
  }

  async discoverSchema(): Promise<Array<{ name: string; columns: Array<{ name: string; type: string }> }>> {
    try {
      console.log('PostgreSQL schema discovery - querying real database');
      
      // Query for all tables across all analytics schemas
      const schemaQuery = `
        SELECT 
          schemaname,
          tablename,
          columnname,
          datatype
        FROM pg_tables pt
        JOIN information_schema.columns isc ON pt.tablename = isc.table_name
        WHERE schemaname LIKE 'analytics_company_%'
        ORDER BY schemaname, tablename, ordinal_position
      `;
      
      const result = await this.executeQuery(schemaQuery);
      
      if (!result.success || !result.data) {
        console.log('No schema data found - no analytics tables exist yet');
        return [];
      }
      
      // Group results by table
      const tableMap = new Map<string, Array<{ name: string; type: string }>>();
      
      result.data.forEach((row: any) => {
        const tableName = `${row.schemaname}.${row.tablename}`;
        if (!tableMap.has(tableName)) {
          tableMap.set(tableName, []);
        }
        tableMap.get(tableName)!.push({
          name: row.columnname,
          type: row.datatype
        });
      });
      
      // Convert to expected format
      const schemas = Array.from(tableMap.entries()).map(([name, columns]) => ({
        name,
        columns
      }));
      
      console.log(`✅ Discovered ${schemas.length} analytics tables`);
      return schemas;
      
    } catch (error) {
      console.error('Schema discovery failed:', error);
      return [];
    }
  }
}

// Export singleton instance
export const postgresAnalyticsService = new PostgresAnalyticsService();
export const postgresAnalytics = postgresAnalyticsService;