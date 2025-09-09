import { PostgresAnalyticsService } from './postgres-analytics.js';
import { MetricsTimeSeriesETL } from './metrics-time-series-etl.js';
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
  private etl: MetricsTimeSeriesETL;

  constructor(private postgres: PostgresAnalyticsService) {
    this.etl = new MetricsTimeSeriesETL(postgres);
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
    const status = await this.etl.checkETLStatus(companyId, periodType);
    
    if (!status.hasData) {
      console.log(`No ETL data found for company ${companyId} period ${periodType}, running ETL...`);
      await this.etl.runETLJob({ companyId, periodType: periodType as any, forceRefresh: true });
    } else {
      // Check if data is older than 1 hour and refresh if needed
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (!status.lastUpdated || status.lastUpdated < oneHourAgo) {
        console.log(`ETL data stale for company ${companyId} period ${periodType}, refreshing...`);
        await this.etl.runETLJob({ companyId, periodType: periodType as any, forceRefresh: true });
      }
    }
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
    
    // Use database-calculated period-relative values, fall back to running_sum if period_relative is 0
    const actualSeries = series.filter(s => !s.is_goal && s.ts <= today);
    const currentActualPeriodRelative = Math.max(...actualSeries.map(s => s.period_relative_running_sum || 0), 0);
    const currentActualRunningSum = Math.max(...actualSeries.map(s => s.running_sum || 0), 0);
    const currentActual = currentActualPeriodRelative > 0 ? currentActualPeriodRelative : currentActualRunningSum;
    
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
    return this.etl.getAvailableMetrics(companyId);
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
    return this.etl.runETLJob({ companyId, periodType, forceRefresh });
  }

  // Helper method to check ETL status
  async getETLStatus(companyId: number, periodType: string) {
    return this.etl.checkETLStatus(companyId, periodType);
  }

  // Helper method to validate time series data (for debugging)
  async validateTimeSeriesData(companyId: number, periodType: string, limit = 10) {
    return this.etl.validateTimeSeriesData(companyId, periodType, limit);
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
      
      // Convert database results to MetricsSeries format - filter only actual data (not goals)
      let actualSeries: MetricsSeries[] = result.data
        .filter((row: any) => !row.is_goal) // Only get actual data, ignore stored goals
        .map((row: any) => ({
          ts: format(new Date(row.ts), 'yyyy-MM-dd'),
          series: row.series, // Don't prefix actual data
          value: parseFloat(row.value) || 0,
          running_sum: parseFloat(row.running_sum) || 0,
          period_relative_value: parseFloat(row.period_relative_value) || 0,
          period_relative_running_sum: parseFloat(row.period_relative_running_sum) || 0,
          baseline_value: parseFloat(row.period_baseline_value) || 0,
          is_goal: false
        }));
      
      // For yearly views, aggregate daily data into monthly points for better UX
      if (periodType === 'yearly') {
        console.log(`📊 Before aggregation: ${actualSeries.length} daily data points`);
        actualSeries = this.aggregateToMonthlyPoints(actualSeries);
        console.log(`📊 After aggregation: ${actualSeries.length} monthly points`);
      }
      
      // Check feature flags for goal generation method
      const useDatabaseGoals = process.env.USE_DATABASE_GOALS === 'true';
      const useETLGoals = process.env.USE_ETL_GOALS === 'true';
      let goalSeries: MetricsSeries[] = [];
      
      if (useDatabaseGoals && useETLGoals) {
        console.log('🎯 Using pre-stored ETL goals (fastest)');
        goalSeries = await this.getETLGoalsFromDatabase(companyId, periodType, actualSeries);
      } else if (useDatabaseGoals) {
        console.log('🎯 Using PostgreSQL view for goal generation');
        goalSeries = await this.getGoalsFromDatabase(companyId, periodType, actualSeries);
      } else {
        console.log('🎯 Using TypeScript service for goal generation');
        goalSeries = await this.generateGoalSeries(companyId, actualSeries, periodType);
      }
      
      // Combine actual and generated goal series
      const allSeries = [...actualSeries, ...goalSeries];
      
      // Calculate progress metrics from all series data (both actual and goal)
      const progress = await this.calculateProgress(companyId, periodType, allSeries);
      
      console.log(`✅ Retrieved ${actualSeries.length} actual data points and generated ${goalSeries.length} goal data points`);
      
      return { series: allSeries, progress };
      
    } catch (error) {
      console.error('Error querying metrics from database:', error);
      return {
        series: [],
        progress: { onPace: 0, progress: 0, todayActual: 0, todayGoal: 0, periodEndGoal: 0 }
      };
    }
  }

  // Aggregate daily data points into monthly points for yearly views
  private aggregateToMonthlyPoints(dailySeries: MetricsSeries[]): MetricsSeries[] {
    // Group data by metric series and month
    const monthlyGroups = new Map<string, Map<string, MetricsSeries[]>>();
    
    for (const point of dailySeries) {
      const date = new Date(point.ts);
      const monthKey = format(date, 'yyyy-MM'); // e.g., "2025-08"
      const seriesKey = point.series;
      
      if (!monthlyGroups.has(seriesKey)) {
        monthlyGroups.set(seriesKey, new Map());
      }
      
      const seriesGroups = monthlyGroups.get(seriesKey)!;
      if (!seriesGroups.has(monthKey)) {
        seriesGroups.set(monthKey, []);
      }
      
      seriesGroups.get(monthKey)!.push(point);
    }
    
    const monthlyPoints: MetricsSeries[] = [];
    
    // Convert grouped data to monthly aggregated points
    for (const [seriesKey, monthsMap] of monthlyGroups) {
      // Sort months chronologically
      const sortedMonths = Array.from(monthsMap.keys()).sort();
      
      for (const monthKey of sortedMonths) {
        const monthData = monthsMap.get(monthKey)!;
        
        // Sort daily points within the month by date
        monthData.sort((a, b) => a.ts.localeCompare(b.ts));
        
        // Get the last day of the month (month-end values)
        const lastDay = monthData[monthData.length - 1];
        
        // Check if this metric is an average type
        const isAverage = seriesKey.toLowerCase().includes('average') || 
                         seriesKey.toLowerCase().includes('avg') || 
                         seriesKey.toLowerCase().includes('cycle');
        
        let monthlyValue: number;
        let monthlyRunningSum: number;
        
        if (isAverage) {
          // For averages: use the final cumulative average for the month
          monthlyValue = lastDay.running_sum;
          monthlyRunningSum = lastDay.running_sum; // Final average, not sum
        } else {
          // For counts/sums: sum up all daily values in the month, use end-of-month running sum
          monthlyValue = monthData.reduce((sum, day) => sum + day.value, 0);
          monthlyRunningSum = lastDay.running_sum; // Cumulative through year
        }
        
        // Use last day of month as the timestamp for better hover experience
        const lastDayOfMonth = format(new Date(monthKey + '-01'), 'yyyy-MM-') + 
                              format(new Date(new Date(monthKey + '-01').getFullYear(), 
                                            new Date(monthKey + '-01').getMonth() + 1, 0), 'dd');
        
        monthlyPoints.push({
          ts: lastDayOfMonth, // e.g., "2025-08-31" for August
          series: seriesKey,
          value: monthlyValue, // Monthly total for counts, monthly average for averages
          running_sum: monthlyRunningSum, // Year-to-date cumulative
          period_relative_value: monthlyValue, 
          period_relative_running_sum: monthlyRunningSum,
          baseline_value: lastDay.baseline_value,
          is_goal: lastDay.is_goal // Preserve the goal flag from the source data
        });
      }
    }
    
    // Sort final results by date and series for consistent ordering
    return monthlyPoints.sort((a, b) => {
      const dateCompare = a.ts.localeCompare(b.ts);
      return dateCompare !== 0 ? dateCompare : a.series.localeCompare(b.series);
    });
  }

  // Generate goal series data based on KPI metrics
  private async generateGoalSeries(companyId: number, actualSeries: MetricsSeries[], periodType: string): Promise<MetricsSeries[]> {
    try {
      console.log(`🎯 Generating goal series for ${actualSeries.length} actual data points`);
      
      // Get KPI metrics for goal calculations from company-specific schema
      const schemaName = `analytics_company_${companyId}`;
      const kpiResult = await this.postgres.executeQuery(`
        SELECT id, name, yearly_goal, goal_type, quarterly_goals, monthly_goals
        FROM ${schemaName}.kpi_metrics 
        WHERE yearly_goal IS NOT NULL
        AND yearly_goal != ''
        AND yearly_goal != '0'
      `);

      if (!kpiResult.success || !kpiResult.data.length) {
        console.log('🎯 No KPI goals found, returning empty goal series');
        return [];
      }

      console.log(`🎯 Found ${kpiResult.data.length} KPI metrics with goals`);
      
      const goalSeries: MetricsSeries[] = [];
      
      // Group actual series by metric name
      const actualByMetric = actualSeries.reduce((acc, item) => {
        if (!acc[item.series]) acc[item.series] = [];
        acc[item.series].push(item);
        return acc;
      }, {} as Record<string, MetricsSeries[]>);

      // Generate goal data for each metric
      for (const kpiMetric of kpiResult.data) {
        const metricName = kpiMetric.name;
        const actualData = actualByMetric[metricName];
        
        if (!actualData?.length) {
          console.log(`🎯 No actual data found for metric: ${metricName}`);
          continue;
        }

        // Check if this is an average-type metric (cycle time, etc.)
        const isAverageMetric = metricName.toLowerCase().includes('average') || 
                               metricName.toLowerCase().includes('avg') || 
                               metricName.toLowerCase().includes('cycle');
        
        // Calculate goal values based on metric type and data granularity
        const yearlyGoal = parseFloat(kpiMetric.yearly_goal) || 0;
        let periodGoal = 0; // Goal per data point (daily or monthly)
        let targetValue = yearlyGoal; // For averages, this is the flat target
        
        // Detect if we're working with monthly aggregated data (for yearly period)
        const isMonthlyAggregated = periodType === 'yearly' && actualData.length <= 15; // ~12 months + buffer
        
        if (isAverageMetric) {
          // For average metrics: goal is always the target value (e.g., 5 days cycle time)
          periodGoal = yearlyGoal;
          targetValue = yearlyGoal;
        } else {
          // For count/sum metrics: proportional breakdown
          if (isMonthlyAggregated) {
            // Monthly goals for aggregated yearly data
            periodGoal = yearlyGoal / 12; // Monthly goal
          } else if (kpiMetric.goal_type === 'yearly') {
            periodGoal = yearlyGoal / 365; // Daily goal
          } else if (kpiMetric.goal_type === 'quarterly') {
            periodGoal = yearlyGoal / 90; // Approximate quarter = 90 days
          } else if (kpiMetric.goal_type === 'monthly') {
            periodGoal = yearlyGoal / 30; // Approximate month = 30 days
          } else {
            periodGoal = yearlyGoal / 365; // Default to yearly
          }
        }

        console.log(`🎯 Calculated goal for ${metricName}: periodGoal=${periodGoal}, target=${targetValue} (type: ${kpiMetric.goal_type}, is_average: ${isAverageMetric}, monthlyAggregated: ${isMonthlyAggregated})`);

        // Generate goal data for each date in actual data
        let runningGoal = 0;
        
        // Sort actual data by date to ensure proper calculation
        const sortedActualData = actualData.sort((a, b) => a.ts.localeCompare(b.ts));
        
        for (const actualPoint of sortedActualData) {
          if (isAverageMetric) {
            // For averages: running goal stays flat at target value
            runningGoal = targetValue;
          } else {
            // For counts/sums: cumulative goal
            runningGoal += periodGoal;
          }
          
          goalSeries.push({
            ts: actualPoint.ts,
            series: `Goal: ${metricName}`, // Prefix with "Goal: "
            value: periodGoal, // Period goal value (daily or monthly)
            running_sum: runningGoal, // Flat target for averages, cumulative for counts
            period_relative_value: periodGoal,
            period_relative_running_sum: runningGoal,
            baseline_value: 0,
            is_goal: true
          });
        }
        
        console.log(`🎯 Generated ${sortedActualData.length} goal data points for ${metricName}, final cumulative: ${runningGoal}`);
      }
      
      console.log(`🎯 Generated total ${goalSeries.length} goal data points`);
      return goalSeries;
      
    } catch (error) {
      console.error('Error generating goal series:', error);
      return [];
    }
  }

  /**
   * Get goals from PostgreSQL view instead of generating in TypeScript
   * This method queries the metrics_with_goals view for goal data
   */
  private async getGoalsFromDatabase(companyId: number, periodType: string, actualSeries: MetricsSeries[]): Promise<MetricsSeries[]> {
    try {
      console.log(`🎯 Querying PostgreSQL goals view for ${actualSeries.length} actual data points`);
      
      // Get the date range and metric names from actual series
      const dateRange = {
        start: actualSeries.length > 0 ? actualSeries[0].ts : format(new Date(), 'yyyy-MM-dd'),
        end: actualSeries.length > 0 ? actualSeries[actualSeries.length - 1].ts : format(new Date(), 'yyyy-MM-dd')
      };
      
      const metricNames = [...new Set(actualSeries.map(s => s.series))];
      const metricNamesStr = metricNames.map(name => `'${name}'`).join(',');
      
      // Query goals from database view
      const result = await this.postgres.executeQuery(`
        SELECT ts, series_label as series, value, running_sum, is_goal,
               period_relative_value, period_relative_running_sum, period_baseline_value
        FROM analytics_company_${companyId}.metrics_with_goals
        WHERE period_type = '${periodType}'
          AND is_goal = true
          AND ts BETWEEN '${dateRange.start}' AND '${dateRange.end}'
          AND series_label LIKE 'Goal:%'
        ORDER BY ts ASC, series_label
      `);

      if (!result.success || !result.data) {
        console.log('🎯 No goal data found in database view');
        return [];
      }

      // Transform database results to MetricsSeries format
      const goalSeries: MetricsSeries[] = result.data.map((row: any) => ({
        ts: row.ts,
        series: row.series,
        value: parseFloat(row.value) || 0,
        running_sum: parseFloat(row.running_sum) || 0,
        period_relative_value: parseFloat(row.period_relative_value) || 0,
        period_relative_running_sum: parseFloat(row.period_relative_running_sum) || 0,
        baseline_value: parseFloat(row.period_baseline_value) || 0,
        is_goal: true
      }));

      // Apply monthly aggregation if needed (for yearly views)
      let finalGoalSeries = goalSeries;
      if (periodType === 'yearly' && actualSeries.length <= 15) {
        console.log(`📊 Applying monthly aggregation to ${goalSeries.length} goal points`);
        finalGoalSeries = this.aggregateToMonthlyPoints(goalSeries);
      }

      console.log(`🎯 Retrieved ${finalGoalSeries.length} goal data points from PostgreSQL view`);
      return finalGoalSeries;
      
    } catch (error) {
      console.error('Error querying goals from database:', error);
      // Fallback to TypeScript generation if database query fails
      console.log('🔄 Falling back to TypeScript goal generation');
      return await this.generateGoalSeries(companyId, actualSeries, periodType);
    }
  }

  private async getETLGoalsFromDatabase(companyId: number, periodType: string, actualSeries: MetricsSeries[]): Promise<MetricsSeries[]> {
    try {
      console.log(`⚡ Querying pre-stored ETL goals for ${actualSeries.length} actual data points`);
      
      // Get the date range from actual series
      const dateRange = {
        start: actualSeries.length > 0 ? actualSeries[0].ts : format(new Date(), 'yyyy-MM-dd'),
        end: actualSeries.length > 0 ? actualSeries[actualSeries.length - 1].ts : format(new Date(), 'yyyy-MM-dd')
      };
      
      // Query stored goals directly from base table (fast!)
      const result = await this.postgres.executeQuery(`
        SELECT ts, series_label as series, value, running_sum, is_goal,
               period_relative_value, period_relative_running_sum, period_baseline_value
        FROM analytics_company_${companyId}.metrics_time_series
        WHERE period_type = '${periodType}'
          AND is_goal = true
          AND ts BETWEEN '${dateRange.start}' AND '${dateRange.end}'
        ORDER BY ts ASC, series_label
      `);

      if (!result.success || !result.data) {
        console.log('⚠️ No ETL goal data found, falling back to view');
        return await this.getGoalsFromDatabase(companyId, periodType, actualSeries);
      }

      // Transform database results to MetricsSeries format
      const goalSeries: MetricsSeries[] = result.data.map((row: any) => ({
        ts: row.ts,
        series: `Goal: ${row.series}`, // Add "Goal:" prefix to match view format
        value: parseFloat(row.value) || 0,
        running_sum: parseFloat(row.running_sum) || 0,
        period_relative_value: parseFloat(row.period_relative_value) || 0,
        period_relative_running_sum: parseFloat(row.period_relative_running_sum) || 0,
        baseline_value: parseFloat(row.period_baseline_value) || 0,
        is_goal: true
      }));

      // Apply monthly aggregation if needed (for yearly views)
      let finalGoalSeries = goalSeries;
      if (periodType === 'yearly' && actualSeries.length <= 15) {
        console.log(`📊 Applying monthly aggregation to ${goalSeries.length} ETL goal points`);
        finalGoalSeries = this.aggregateToMonthlyPoints(goalSeries);
      }

      console.log(`⚡ Retrieved ${finalGoalSeries.length} pre-stored ETL goal data points (fast!)`);
      return finalGoalSeries;
      
    } catch (error) {
      console.error('Error querying ETL goals from database:', error);
      // Fallback to view-based goals if ETL goals query fails
      console.log('🔄 Falling back to PostgreSQL view goals');
      return await this.getGoalsFromDatabase(companyId, periodType, actualSeries);
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