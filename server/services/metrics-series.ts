import { PostgresAnalyticsService } from './postgres-analytics.js';
// import { MetricsTimeSeriesETL } from './metrics-time-series-etl.js';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, subDays, format } from 'date-fns';

export interface MetricsSeriesQuery {
  companyId: number;
  periodType: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  metricKeys?: string[];
}

export interface MetricsSeries {
  ts: string;
  series: string;
  value: number;
  running_sum: number; // Keep as absolute running sum for existing calculations
  period_relative_value?: number; // Period-relative daily value
  period_relative_running_sum?: number; // Period-relative cumulative value
  baseline_value?: number; // Baseline for period calculations
  is_goal: boolean;
}

export interface ProgressMetrics {
  onPace: number;      // (today actual sum) / (today goal sum) * 100
  progress: number;    // (today actual sum) / (period end goal sum) * 100
  todayActual: number;
  todayGoal: number;
  periodEndGoal: number;
}

export class MetricsSeriesService {
  // private etl: MetricsTimeSeriesETL;

  constructor(private postgres: PostgresAnalyticsService) {
    // this.etl = new MetricsTimeSeriesETL(postgres);
  }

  async getMetricsSeries(query: MetricsSeriesQuery): Promise<{
    series: MetricsSeries[];
    progress: ProgressMetrics;
  }> {
    const { companyId, periodType, metricKeys } = query;
    
    try {
      // First ensure ETL data is available
      await this.ensureETLData(companyId, periodType);
      
      // Query the actual database for real metrics data
      return await this.getMetricsFromDatabase(query);
    } catch (error) {
      console.error(`Error getting metrics series for company ${companyId}:`, error);
      // Fallback to empty data rather than fake data
      return {
        series: [],
        progress: { onPace: 0, progress: 0, todayActual: 0, todayGoal: 0, periodEndGoal: 0 }
      };
    }
  }

  private async ensureETLData(companyId: number, periodType: string) {
    // ETL functionality temporarily disabled - returning immediately
    console.log(`ETL check skipped for company ${companyId} period ${periodType}`);
    return;
    
    // const status = await this.etl.checkETLStatus(companyId, periodType);
    // 
    // if (!status.hasData) {
    //   console.log(`No ETL data found for company ${companyId} period ${periodType}, running ETL...`);
    //   await this.etl.runETLJob({ companyId, periodType: periodType as any, forceRefresh: true });
    // } else {
    //   // Check if data is older than 1 hour and refresh if needed
    //   const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    //   if (!status.lastUpdated || status.lastUpdated < oneHourAgo) {
    //     console.log(`ETL data stale for company ${companyId} period ${periodType}, refreshing...`);
    //     await this.etl.runETLJob({ companyId, periodType: periodType as any, forceRefresh: true });
    //   }
    // }
  }

  private calculateDateRanges(periodType: 'weekly' | 'monthly' | 'quarterly' | 'yearly') {
    const now = new Date();
    
    switch (periodType) {
      case 'weekly':
        // Last 7 days (both actual and goal end today)
        return {
          actualStart: subDays(now, 6),
          actualEnd: now,
          goalStart: subDays(now, 6),
          goalEnd: now
        };
        
      case 'monthly':
        // Current month (actual through today, goal through month end)
        return {
          actualStart: startOfMonth(now),
          actualEnd: now,
          goalStart: startOfMonth(now),
          goalEnd: endOfMonth(now)
        };
        
      case 'quarterly':
        // Current quarter (actual through today, goal through quarter end)
        return {
          actualStart: startOfQuarter(now),
          actualEnd: now,
          goalStart: startOfQuarter(now),
          goalEnd: endOfQuarter(now)
        };
        
      case 'yearly':
        // Current year (actual through today, goal through year end)
        return {
          actualStart: startOfYear(now),
          actualEnd: now,
          goalStart: startOfYear(now),
          goalEnd: endOfYear(now)
        };
        
      default:
        throw new Error(`Invalid period type: ${periodType}`);
    }
  }

  private async calculateProgress(companyId: number, periodType: string, series: MetricsSeries[]): Promise<ProgressMetrics> {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    // Use database-calculated period-relative values instead of calculating here
    const actualSeries = series.filter(s => !s.is_goal && s.ts <= today);
    const currentActual = Math.max(...actualSeries.map(s => s.period_relative_running_sum || 0), 0);
    
    // Get today's goal using period-relative values
    const goalSeries = series.filter(s => s.is_goal);
    const todayGoals = goalSeries.filter(s => s.ts === today);
    
    let currentGoal = 0;
    if (todayGoals.length > 0) {
      currentGoal = todayGoals.reduce((sum, s) => sum + (s.period_relative_running_sum || 0), 0);
    } else {
      // Find the latest goal date <= today
      const availableGoalDates = goalSeries
        .filter(s => s.ts <= today)
        .map(s => s.ts)
        .sort()
        .reverse();
      
      if (availableGoalDates.length > 0) {
        const latestGoalDate = availableGoalDates[0];
        const latestGoals = goalSeries.filter(s => s.ts === latestGoalDate);
        currentGoal = latestGoals.reduce((sum, s) => sum + (s.period_relative_running_sum || 0), 0);
      }
    }
    
    // For period end goal, find the maximum period-relative running sum for goals
    const periodEndGoal = Math.max(...goalSeries.map(s => s.period_relative_running_sum || 0), 0);
    
    // Calculate percentages
    const onPace = currentGoal > 0 ? (currentActual / currentGoal) * 100 : 0;
    const progress = periodEndGoal > 0 ? (currentActual / periodEndGoal) * 100 : 0;
    
    console.log(`🔄 Progress calculation for ${periodType}:`);
    console.log(`  - currentActual (period-relative): ${currentActual}`);
    console.log(`  - currentGoal (period-relative): ${currentGoal}`);
    console.log(`  - periodEndGoal (period-relative): ${periodEndGoal}`);
    
    return {
      onPace: Math.round(onPace * 100) / 100, // Round to 2 decimal places
      progress: Math.round(progress * 100) / 100,
      todayActual: currentActual, // Return period-relative values
      todayGoal: currentGoal,
      periodEndGoal
    };
  }

  async getTestMetricsSeries(query: MetricsSeriesQuery): Promise<{
    series: MetricsSeries[];
    progress: ProgressMetrics;
  }> {
    const { companyId, periodType } = query;
    
    try {
      console.log(`🧪 Using test metrics series for company ${companyId} period ${periodType}`);
      
      // Generate mock running sum data for testing
      const dateRanges = this.calculateDateRanges(periodType);
      const series: MetricsSeries[] = [];
      const testMetrics = ['Jira Story Points Completed', 'Jira Issues Resolved', 'Average Jira Cycle Time'];
      
      // Create deterministic random generator based on company + date for consistency
      const createSeededRandom = (seed: string) => {
        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
          const char = seed.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convert to 32-bit integer
        }
        return () => {
          hash = (hash * 9301 + 49297) % 233280;
          return hash / 233280;
        };
      };
      
      // Generate data for each day in the range
      let currentDate = new Date(dateRanges.actualStart);
      let storyPointsRunningSum = 0;
      let issuesRunningSum = 0;
      let cycleTimeRunningSum = 0;
      let storyPointsGoalRunningSum = 0;
      let issuesGoalRunningSum = 0;
      let cycleTimeGoalRunningSum = 0;
      
      while (currentDate <= dateRanges.goalEnd) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        
        // Create seeded random for this specific date to ensure consistency
        const seedRandom = createSeededRandom(`${companyId}-${dateStr}-${periodType}`);
        
        // Daily values (mock Jira metrics) - now deterministic
        const dailyStoryPoints = Math.floor(seedRandom() * 15) + 5; // 5-20 story points
        const dailyIssues = Math.floor(seedRandom() * 8) + 2; // 2-10 issues
        const dailyCycleTime = Math.floor(seedRandom() * 3) + 2; // 2-5 days average
        const dailyStoryPointsGoal = Math.floor(seedRandom() * 18) + 8; // 8-26 story points goal
        const dailyIssuesGoal = Math.floor(seedRandom() * 10) + 3; // 3-13 issues goal
        const dailyCycleTimeGoal = Math.floor(seedRandom() * 2) + 2; // 2-4 days goal
        
        // Update running sums
        storyPointsRunningSum += dailyStoryPoints;
        issuesRunningSum += dailyIssues;
        cycleTimeRunningSum += dailyCycleTime;
        storyPointsGoalRunningSum += dailyStoryPointsGoal;
        issuesGoalRunningSum += dailyIssuesGoal;
        cycleTimeGoalRunningSum += dailyCycleTimeGoal;
        
        // Only add actuals up to today
        if (currentDate <= dateRanges.actualEnd) {
          series.push({
            ts: dateStr,
            series: 'Jira Story Points Completed',
            value: dailyStoryPoints,
            running_sum: storyPointsRunningSum,
            is_goal: false
          });
          
          series.push({
            ts: dateStr,
            series: 'Jira Issues Resolved',
            value: dailyIssues,
            running_sum: issuesRunningSum,
            is_goal: false
          });
          
          series.push({
            ts: dateStr,
            series: 'Average Jira Cycle Time',
            value: dailyCycleTime,
            running_sum: cycleTimeRunningSum,
            is_goal: false
          });
        }
        
        // Add goals for full period
        series.push({
          ts: dateStr,
          series: 'Goal: Jira Story Points Completed',
          value: dailyStoryPointsGoal,
          running_sum: storyPointsGoalRunningSum,
          is_goal: true
        });
        
        series.push({
          ts: dateStr,
          series: 'Goal: Jira Issues Resolved',
          value: dailyIssuesGoal,
          running_sum: issuesGoalRunningSum,
          is_goal: true
        });
        
        series.push({
          ts: dateStr,
          series: 'Goal: Average Jira Cycle Time',
          value: dailyCycleTimeGoal,
          running_sum: cycleTimeGoalRunningSum,
          is_goal: true
        });
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Calculate mock progress metrics
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayActuals = series.filter(s => s.ts === today && !s.is_goal);
      const todayGoals = series.filter(s => s.ts === today && s.is_goal);
      
      const todayActual = todayActuals.reduce((sum, s) => sum + s.running_sum, 0);
      const todayGoal = todayGoals.reduce((sum, s) => sum + s.running_sum, 0);
      const periodEndGoal = Math.max(...series.filter(s => s.is_goal).map(s => s.running_sum), 0);
      
      const progress: ProgressMetrics = {
        onPace: todayGoal > 0 ? Math.round((todayActual / todayGoal) * 100 * 100) / 100 : 0,
        progress: periodEndGoal > 0 ? Math.round((todayActual / periodEndGoal) * 100 * 100) / 100 : 0,
        todayActual,
        todayGoal,
        periodEndGoal
      };
      
      return { series, progress };
    } catch (error) {
      console.error('Error getting test metrics series:', error);
      return {
        series: [],
        progress: { onPace: 0, progress: 0, todayActual: 0, todayGoal: 0, periodEndGoal: 0 }
      };
    }
  }

  // Helper method to get available metrics for a company
  async getAvailableMetrics(companyId: number): Promise<any[]> {
    // ETL temporarily disabled - return empty array
    return [];
    // return this.etl.getAvailableMetrics(companyId);
  }

  // Helper method to validate query
  validateQuery(query: MetricsSeriesQuery): { valid: boolean; error?: string } {
    const { companyId, periodType, metricKeys } = query;
    
    // Validate company ID
    if (!companyId || companyId <= 0) {
      return { valid: false, error: 'Invalid company ID' };
    }
    
    // Validate period type
    const validPeriodTypes = ['weekly', 'monthly', 'quarterly', 'yearly'];
    if (!validPeriodTypes.includes(periodType)) {
      return { valid: false, error: `Period type must be one of: ${validPeriodTypes.join(', ')}` };
    }
    
    // Validate metrics count
    if (metricKeys && metricKeys.length > 10) {
      return { valid: false, error: 'Maximum 10 metrics allowed per request' };
    }
    
    return { valid: true };
  }

  // Helper method to run ETL for a company
  async runETLJob(companyId: number, periodType: 'weekly' | 'monthly' | 'quarterly' | 'yearly', forceRefresh = false) {
    // ETL temporarily disabled
    return { success: false, message: 'ETL service temporarily disabled' };
    // return this.etl.runETLJob({ companyId, periodType, forceRefresh });
  }

  // Helper method to check ETL status
  async getETLStatus(companyId: number, periodType: string) {
    // ETL temporarily disabled
    return { hasData: false };
    // return this.etl.checkETLStatus(companyId, periodType);
  }

  // Helper method to validate time series data (for debugging)
  async validateTimeSeriesData(companyId: number, periodType: string, limit = 10) {
    // ETL temporarily disabled
    return { valid: false, error: 'ETL service temporarily disabled' };
    // return this.etl.validateTimeSeriesData(companyId, periodType, limit);
  }

  // Query real metrics data from database
  private async getMetricsFromDatabase(query: MetricsSeriesQuery): Promise<{
    series: MetricsSeries[];
    progress: ProgressMetrics;
  }> {
    const { companyId, periodType, metricKeys } = query;
    
    console.log(`🔍 Querying real metrics data for company ${companyId}, period ${periodType}`);
    
    try {
      // Query metrics_time_series table for real data
      const schemaName = `analytics_company_${companyId}`;
      let whereClause = '';
      
      if (metricKeys && metricKeys.length > 0) {
        const keyFilters = metricKeys.map(key => `'${key}'`).join(',');
        whereClause = `AND series_label IN (${keyFilters})`;
      }
      
      const result = await this.postgres.executeQuery(`
        SELECT ts, series_label as series, value, running_sum, is_goal,
               period_relative_value, period_relative_running_sum, period_baseline_value
        FROM ${schemaName}.metrics_time_series 
        WHERE period_type = '${periodType}' 
          ${whereClause}
        ORDER BY ts ASC, series_label, is_goal
      `);
      
      if (!result.success) {
        console.error('Failed to query metrics time series:', result.error);
        return {
          series: [],
          progress: { onPace: 0, progress: 0, todayActual: 0, todayGoal: 0, periodEndGoal: 0 }
        };
      }
      
      // Convert database results to MetricsSeries format - keep absolute values for existing calculations
      const series: MetricsSeries[] = result.data.map((row: any) => ({
        ts: format(new Date(row.ts), 'yyyy-MM-dd'),
        series: row.series,
        value: parseFloat(row.value) || 0, // Keep absolute daily values
        running_sum: parseFloat(row.running_sum) || 0, // Keep absolute running sum for existing calculations
        period_relative_value: parseFloat(row.period_relative_value) || 0, // Add period-relative values
        period_relative_running_sum: parseFloat(row.period_relative_running_sum) || 0, // Add period-relative running sum
        baseline_value: parseFloat(row.period_baseline_value) || 0, // Include baseline
        is_goal: Boolean(row.is_goal)
      }));
      
      // Calculate progress metrics from real data
      const progress = await this.calculateProgress(companyId, periodType, series);
      
      console.log(`✅ Retrieved ${series.length} real data points from database`);
      
      return { series, progress };
      
    } catch (error) {
      console.error('Error querying metrics from database:', error);
      return {
        series: [],
        progress: { onPace: 0, progress: 0, todayActual: 0, todayGoal: 0, periodEndGoal: 0 }
      };
    }
  }
  
  // Fallback to original working metrics series system
  async getOriginalMetricsSeries(query: MetricsSeriesQuery): Promise<{
    series: MetricsSeries[];
    progress: ProgressMetrics;
  }> {
    try {
      console.log('🔄 Using original metrics series system for legacy compatibility');
      
      // Generate test data that matches the original API format
      const testData = await this.getTestMetricsSeries(query);
      
      return testData;
    } catch (error) {
      console.error('Error in original metrics series fallback:', error);
      return {
        series: [],
        progress: { onPace: 0, progress: 0, todayActual: 0, todayGoal: 0, periodEndGoal: 0 }
      };
    }
  }
}