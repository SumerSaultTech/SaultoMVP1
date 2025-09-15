import { postgresAnalyticsService } from './postgres-analytics';
import { storage } from '../storage';

export interface MetricDisplayData {
  id: number;
  name: string;
  currentValue: number;
  goalValue: number;
  percentage: number;
  trend: TrendData[];
  format: 'currency' | 'percentage' | 'number';
  category: string;
  period: string;
  isIncreasing: boolean;
}

export interface TrendData {
  period: string;
  value: number;
  goal: number;
}

export interface MetricSummary {
  runningSum: number;
  goalValue: number;
  percentage: number;
  changeFromPrevious: number;
  trendDirection: 'up' | 'down' | 'stable';
}

export class EnhancedMetricsService {
  /**
   * Get comprehensive metric data for dashboard display
   * Includes running sum, goal comparison, percentage, and trend data
   */
  async getMetricForDisplay(
    metricId: number,
    companyId: number,
    timePeriod: string = 'monthly'
  ): Promise<MetricDisplayData | null> {
    try {
      // Get metric definition from company-specific metrics table
      const metric = await storage.getKpiMetric(metricId, companyId);
      if (!metric) {
        console.log(`Metric ${metricId} not found for company ${companyId}`);
        return null;
      }

      // Calculate current running sum using real-time query
      const currentValue = await this.calculateRunningSum(metric, companyId, timePeriod);

      // Get or calculate goal value for this period
      const goalValue = await this.getGoalForPeriod(metric, timePeriod);

      // Calculate percentage difference
      const percentage = goalValue > 0 ? (currentValue / goalValue) * 100 : 0;

      // Get trend data for chart display
      const trend = await this.getTrendData(metric, companyId, timePeriod);

      return {
        id: metric.id,
        name: metric.name,
        currentValue,
        goalValue,
        percentage,
        trend,
        format: metric.format as 'currency' | 'percentage' | 'number',
        category: metric.category,
        period: timePeriod,
        isIncreasing: metric.isIncreasing ?? true
      };

    } catch (error) {
      console.error(`Error getting metric display data for metric ${metricId}:`, error);
      return null;
    }
  }

  /**
   * Calculate running sum for current time period using real-time SQL
   */
  private async calculateRunningSum(
    metric: any,
    companyId: number,
    timePeriod: string
  ): Promise<number> {
    try {
      const schema = `analytics_company_${companyId}`;

      // Build time filter based on period
      const timeFilter = this.getTimeFilter(timePeriod, metric.dateColumn || 'created_at');

      // Build complete SQL query
      let query = `SELECT ${metric.exprSql} as metric_value FROM ${schema}.${metric.sourceTable} f`;

      // Add filters if they exist
      if (metric.filters) {
        const filterClause = await this.renderFilters(metric.filters, companyId);
        if (filterClause) {
          query += ` WHERE ${filterClause}`;
          if (timeFilter) query += ` AND ${timeFilter}`;
        } else if (timeFilter) {
          query += ` WHERE ${timeFilter}`;
        }
      } else if (timeFilter) {
        query += ` WHERE ${timeFilter}`;
      }

      console.log(`Calculating running sum for ${metric.name}:`, query);

      const result = await postgresAnalyticsService.executeQuery(query, companyId);

      if (result.success && result.data && result.data.length > 0) {
        const value = Number(result.data[0].metric_value) || 0;
        console.log(`✅ Running sum for ${metric.name}: ${value}`);
        return value;
      }

      return 0;
    } catch (error) {
      console.error(`Error calculating running sum for ${metric.name}:`, error);
      return 0;
    }
  }

  /**
   * Get goal value for the specified time period
   */
  private async getGoalForPeriod(metric: any, timePeriod: string): Promise<number> {
    try {
      // If metric has yearly goal, calculate period-specific goal
      if (metric.yearlyGoal) {
        const yearlyGoal = Number(metric.yearlyGoal);
        return this.calculatePeriodGoal(yearlyGoal, timePeriod);
      }

      // Try to get goal from goals table
      const companyId = metric.companyId;
      const schema = `analytics_company_${companyId}`;

      const query = `
        SELECT target
        FROM ${schema}.goals
        WHERE metric_key = '${metric.metricKey}'
        AND granularity = '${this.mapTimePeriodToGranularity(timePeriod)}'
        AND period_start <= CURRENT_DATE
        AND (
          CASE
            WHEN granularity = 'month' THEN period_start + INTERVAL '1 month'
            WHEN granularity = 'quarter' THEN period_start + INTERVAL '3 months'
            WHEN granularity = 'year' THEN period_start + INTERVAL '1 year'
          END
        ) > CURRENT_DATE
        ORDER BY period_start DESC
        LIMIT 1
      `;

      const result = await postgresAnalyticsService.executeQuery(query, companyId);

      if (result.success && result.data && result.data.length > 0) {
        return Number(result.data[0].target) || 0;
      }

      // Fallback: estimate goal based on metric type
      return this.estimateGoal(metric, timePeriod);

    } catch (error) {
      console.error(`Error getting goal for ${metric.name}:`, error);
      return 0;
    }
  }

  /**
   * Get trend data for time series chart
   */
  private async getTrendData(
    metric: any,
    companyId: number,
    timePeriod: string
  ): Promise<TrendData[]> {
    try {
      const schema = `analytics_company_${companyId}`;

      // Determine date grouping and period formatting
      const { dateGroup, dateFormat, intervalBack } = this.getTrendParams(timePeriod, metric.dateColumn || 'created_at');

      const query = `
        SELECT
          ${dateFormat} as period,
          ${metric.exprSql} as value,
          0 as goal
        FROM ${schema}.${metric.sourceTable} f
        WHERE ${metric.dateColumn || 'created_at'} >= CURRENT_DATE - ${intervalBack}
        GROUP BY ${dateGroup}
        ORDER BY ${dateGroup}
      `;

      console.log(`Getting trend data for ${metric.name}:`, query);

      const result = await postgresAnalyticsService.executeQuery(query, companyId);

      if (result.success && result.data) {
        return result.data.map((row: any) => ({
          period: row.period || 'Unknown',
          value: Number(row.value) || 0,
          goal: Number(row.goal) || 0
        }));
      }

      return [];
    } catch (error) {
      console.error(`Error getting trend data for ${metric.name}:`, error);
      return [];
    }
  }

  /**
   * Get time filter SQL for running sum calculations
   */
  private getTimeFilter(timePeriod: string, dateColumn: string): string {
    switch (timePeriod.toLowerCase()) {
      case 'daily':
        return `DATE(${dateColumn}) = CURRENT_DATE`;
      case 'weekly':
        return `DATE_TRUNC('week', ${dateColumn}) = DATE_TRUNC('week', CURRENT_DATE)`;
      case 'monthly':
        return `EXTRACT(YEAR FROM ${dateColumn}) = EXTRACT(YEAR FROM CURRENT_DATE)
                AND EXTRACT(MONTH FROM ${dateColumn}) = EXTRACT(MONTH FROM CURRENT_DATE)`;
      case 'quarterly':
        return `EXTRACT(YEAR FROM ${dateColumn}) = EXTRACT(YEAR FROM CURRENT_DATE)
                AND EXTRACT(QUARTER FROM ${dateColumn}) = EXTRACT(QUARTER FROM CURRENT_DATE)`;
      case 'yearly':
      case 'ytd':
        return `EXTRACT(YEAR FROM ${dateColumn}) = EXTRACT(YEAR FROM CURRENT_DATE)`;
      default:
        return `EXTRACT(YEAR FROM ${dateColumn}) = EXTRACT(YEAR FROM CURRENT_DATE)`;
    }
  }

  /**
   * Get trend query parameters based on time period
   */
  private getTrendParams(timePeriod: string, dateColumn: string) {
    switch (timePeriod.toLowerCase()) {
      case 'daily':
        return {
          dateGroup: `DATE(${dateColumn})`,
          dateFormat: `TO_CHAR(DATE(${dateColumn}), 'YYYY-MM-DD')`,
          intervalBack: "INTERVAL '30 days'"
        };
      case 'weekly':
        return {
          dateGroup: `DATE_TRUNC('week', ${dateColumn})`,
          dateFormat: `TO_CHAR(DATE_TRUNC('week', ${dateColumn}), 'YYYY-MM-DD')`,
          intervalBack: "INTERVAL '12 weeks'"
        };
      case 'quarterly':
        return {
          dateGroup: `DATE_TRUNC('quarter', ${dateColumn})`,
          dateFormat: `TO_CHAR(DATE_TRUNC('quarter', ${dateColumn}), 'YYYY-Q')`,
          intervalBack: "INTERVAL '2 years'"
        };
      case 'yearly':
        return {
          dateGroup: `DATE_TRUNC('year', ${dateColumn})`,
          dateFormat: `TO_CHAR(DATE_TRUNC('year', ${dateColumn}), 'YYYY')`,
          intervalBack: "INTERVAL '5 years'"
        };
      default: // monthly
        return {
          dateGroup: `DATE_TRUNC('month', ${dateColumn})`,
          dateFormat: `TO_CHAR(DATE_TRUNC('month', ${dateColumn}), 'YYYY-MM')`,
          intervalBack: "INTERVAL '12 months'"
        };
    }
  }

  /**
   * Calculate period-specific goal from yearly goal
   */
  private calculatePeriodGoal(yearlyGoal: number, timePeriod: string): number {
    switch (timePeriod.toLowerCase()) {
      case 'daily':
        return yearlyGoal / 365;
      case 'weekly':
        return yearlyGoal / 52;
      case 'monthly':
        return yearlyGoal / 12;
      case 'quarterly':
        return yearlyGoal / 4;
      case 'yearly':
      case 'ytd':
      default:
        return yearlyGoal;
    }
  }

  /**
   * Map time period to goals table granularity
   */
  private mapTimePeriodToGranularity(timePeriod: string): string {
    switch (timePeriod.toLowerCase()) {
      case 'daily':
      case 'weekly':
      case 'monthly':
        return 'month';
      case 'quarterly':
        return 'quarter';
      case 'yearly':
      case 'ytd':
      default:
        return 'year';
    }
  }

  /**
   * Estimate goal when no explicit goal is set
   */
  private estimateGoal(metric: any, timePeriod: string): number {
    // Simple estimation based on metric category and expected growth
    const baseValue = 1000; // Base estimation
    const multiplier = this.calculatePeriodGoal(1, timePeriod);

    if (metric.category === 'revenue') {
      return baseValue * multiplier * 100; // Higher goal for revenue
    } else if (metric.category === 'profit') {
      return baseValue * multiplier * 50; // Moderate goal for profit
    }

    return baseValue * multiplier * 10; // Conservative goal for other metrics
  }

  /**
   * Render JSON filters to SQL WHERE clause
   */
  private async renderFilters(filters: any, companyId: number): Promise<string> {
    try {
      if (!filters) return '';

      // Use the company-specific render_filter function
      const schema = `analytics_company_${companyId}`;
      const query = `SELECT ${schema}.render_filter('${JSON.stringify(filters)}'::jsonb) as filter_clause`;

      const result = await postgresAnalyticsService.executeQuery(query, companyId);

      if (result.success && result.data && result.data.length > 0) {
        return result.data[0].filter_clause || '';
      }

      return '';
    } catch (error) {
      console.error('Error rendering filters:', error);
      return '';
    }
  }

  /**
   * Get summary data for multiple metrics (dashboard overview)
   */
  async getMetricsSummary(
    metricIds: number[],
    companyId: number,
    timePeriod: string = 'monthly'
  ): Promise<MetricDisplayData[]> {
    const summaries: MetricDisplayData[] = [];

    for (const metricId of metricIds) {
      const summary = await this.getMetricForDisplay(metricId, companyId, timePeriod);
      if (summary) {
        summaries.push(summary);
      }
    }

    return summaries;
  }
}

// Export singleton instance
export const enhancedMetricsService = new EnhancedMetricsService();