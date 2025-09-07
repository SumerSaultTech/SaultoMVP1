import { PostgresAnalyticsService } from './postgres-analytics.js';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays, format } from 'date-fns';

export interface ETLJobConfig {
  companyId: number;
  periodType: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  forceRefresh?: boolean;
}

export class MetricsTimeSeriesETL {
  constructor(private postgres: PostgresAnalyticsService) {}

  async runETLJob(config: ETLJobConfig): Promise<{ success: boolean; message: string }> {
    const { companyId, periodType, forceRefresh = false } = config;
    
    try {
      // Calculate date ranges for the period type
      const dateRanges = this.calculateDateRanges(periodType);
      
      for (const range of dateRanges) {
        const result = await this.populatePeriod(companyId, periodType, range.start, range.end);
        if (!result.success) {
          console.error(`ETL failed for company ${companyId} period ${periodType}:`, result.message);
          return result;
        }
      }
      
      return {
        success: true,
        message: `ETL completed for company ${companyId} period ${periodType}`
      };
    } catch (error) {
      console.error('ETL job failed:', error);
      return {
        success: false,
        message: `ETL job failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  async runETLForAllCompanies(): Promise<{ success: boolean; results: any[] }> {
    try {
      // Get all active companies
      const companiesResult = await this.postgres.executeQuery(`
        SELECT id FROM companies WHERE is_active = TRUE ORDER BY id
      `);
      
      if (!companiesResult.success) {
        throw new Error('Failed to fetch companies');
      }

      const companies = companiesResult.data || [];
      const results = [];
      
      // Run ETL for each company and each period type
      const periodTypes: Array<'weekly' | 'monthly' | 'quarterly' | 'yearly'> = ['weekly', 'monthly', 'quarterly', 'yearly'];
      
      for (const company of companies) {
        for (const periodType of periodTypes) {
          const result = await this.runETLJob({
            companyId: company.id,
            periodType,
            forceRefresh: true
          });
          
          results.push({
            companyId: company.id,
            periodType,
            ...result
          });
        }
      }
      
      const failedJobs = results.filter(r => !r.success);
      
      return {
        success: failedJobs.length === 0,
        results
      };
    } catch (error) {
      console.error('ETL for all companies failed:', error);
      return {
        success: false,
        results: [{
          error: error instanceof Error ? error.message : 'Unknown error'
        }]
      };
    }
  }

  private async populatePeriod(companyId: number, periodType: string, startDate: Date, endDate: Date) {
    try {
      const sql = `
        SELECT populate_company_metrics_time_series(
          ${companyId}::bigint,
          '${periodType}'::text,
          '${format(startDate, 'yyyy-MM-dd')}'::date,
          '${format(endDate, 'yyyy-MM-dd')}'::date
        ) as result
      `;
      
      const result = await this.postgres.executeQuery(sql);
      
      if (!result.success) {
        return {
          success: false,
          message: `Failed to populate period: ${result.error}`
        };
      }
      
      return {
        success: true,
        message: result.data?.[0]?.result || 'Period populated successfully'
      };
    } catch (error) {
      return {
        success: false,
        message: `Error populating period: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private calculateDateRanges(periodType: 'weekly' | 'monthly' | 'quarterly' | 'yearly') {
    const now = new Date();
    const ranges = [];

    switch (periodType) {
      case 'weekly':
        // Last 7 days (historical only)
        ranges.push({
          start: subDays(now, 6), // 7 days ago to today (inclusive)
          end: now
        });
        break;

      case 'monthly':
        // Current month (from start of month to end of month)
        ranges.push({
          start: startOfMonth(now),
          end: endOfMonth(now)
        });
        break;

      case 'quarterly':
        // Current quarter (from start of quarter to end of quarter)
        ranges.push({
          start: startOfQuarter(now),
          end: endOfQuarter(now)
        });
        break;

      case 'yearly':
        // Current year (from start of year to end of year)
        ranges.push({
          start: startOfYear(now),
          end: endOfYear(now)
        });
        break;

      default:
        throw new Error(`Invalid period type: ${periodType}`);
    }

    return ranges;
  }

  // Utility method to check if ETL data exists and is recent
  async checkETLStatus(companyId: number, periodType: string): Promise<{
    hasData: boolean;
    lastUpdated?: Date;
    recordCount: number;
  }> {
    try {
      const sql = `
        SELECT 
          COUNT(*) as record_count,
          MAX(updated_at) as last_updated
        FROM analytics_company_${companyId}.metrics_time_series
        WHERE period_type = '${periodType}'
      `;
      
      const result = await this.postgres.executeQuery(sql);
      
      if (!result.success || !result.data || result.data.length === 0) {
        return { hasData: false, recordCount: 0 };
      }
      
      const data = result.data[0];
      
      return {
        hasData: parseInt(data.record_count) > 0,
        lastUpdated: data.last_updated ? new Date(data.last_updated) : undefined,
        recordCount: parseInt(data.record_count) || 0
      };
    } catch (error) {
      console.error('Error checking ETL status:', error);
      return { hasData: false, recordCount: 0 };
    }
  }

  // Method to get available metrics for a company (for debugging)
  async getAvailableMetrics(companyId: number): Promise<any[]> {
    try {
      const sql = `
        SELECT 
          metric_key,
          label,
          source_table,
          expr_sql,
          is_active,
          created_at
        FROM analytics_company_${companyId}.metric_registry
        WHERE is_active = TRUE
        ORDER BY label
      `;
      
      const result = await this.postgres.executeQuery(sql);
      return result.success ? result.data || [] : [];
    } catch (error) {
      console.error('Error getting available metrics:', error);
      return [];
    }
  }

  // Method to validate metrics time series data (for debugging)
  async validateTimeSeriesData(companyId: number, periodType: string, limit = 10): Promise<any[]> {
    try {
      const sql = `
        SELECT 
          ts,
          metric_key,
          series_label,
          value,
          running_sum,
          is_goal,
          period_type,
          created_at
        FROM analytics_company_${companyId}.metrics_time_series
        WHERE period_type = '${periodType}'
        ORDER BY ts DESC, metric_key, is_goal
        LIMIT ${limit}
      `;
      
      const result = await this.postgres.executeQuery(sql);
      return result.success ? result.data || [] : [];
    } catch (error) {
      console.error('Error validating time series data:', error);
      return [];
    }
  }
}