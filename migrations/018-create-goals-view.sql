-- Create PostgreSQL view to replace TypeScript goal generation
-- This view replicates the exact logic from MetricsSeriesService.generateGoalSeries()
-- Company: 1756502314139 (test company)

-- First, create the goals view for company 1756502314139
CREATE OR REPLACE VIEW analytics_company_1756502314139.metrics_goals_view AS
WITH goal_calculations AS (
  SELECT 
    m.ts,
    m.metric_key,
    m.series_label,
    m.period_type,
    m.period_start,
    m.period_end,
    -- Get KPI goal configuration
    kpi.yearly_goal::numeric as yearly_goal,
    kpi.goal_type,
    kpi.quarterly_goals,
    kpi.monthly_goals,
    -- Detect if this is an average metric (same logic as TypeScript)
    (
      LOWER(m.series_label) LIKE '%average%' OR 
      LOWER(m.series_label) LIKE '%avg%' OR 
      LOWER(m.series_label) LIKE '%cycle%'
    ) as is_average_metric,
    -- Detect if we're working with monthly aggregated data for yearly period
    (
      m.period_type = 'yearly' AND 
      (SELECT COUNT(DISTINCT ts) FROM analytics_company_1756502314139.metrics_time_series 
       WHERE series_label = m.series_label AND period_type = 'yearly' AND NOT is_goal) <= 15
    ) as is_monthly_aggregated
  FROM analytics_company_1756502314139.metrics_time_series m
  JOIN kpi_metrics kpi ON kpi.name = m.series_label 
    AND kpi.company_id = 1756502314139
  WHERE NOT m.is_goal 
    AND kpi.yearly_goal IS NOT NULL
    AND kpi.yearly_goal != ''
    AND kpi.yearly_goal != '0'
),
goal_periods AS (
  SELECT *,
    -- Calculate period goal (daily or monthly) - exact TypeScript logic
    CASE 
      WHEN is_average_metric THEN yearly_goal  -- For averages: always the target value
      WHEN is_monthly_aggregated THEN yearly_goal / 12  -- Monthly goals for aggregated yearly
      WHEN goal_type = 'yearly' THEN yearly_goal / 365  -- Daily goal
      WHEN goal_type = 'quarterly' THEN yearly_goal / 90  -- ~90 days per quarter
      WHEN goal_type = 'monthly' THEN yearly_goal / 30   -- ~30 days per month
      ELSE yearly_goal / 365  -- Default to yearly
    END as period_goal,
    -- Target value (for averages, this is the flat target)
    yearly_goal as target_value
  FROM goal_calculations
),
running_goals AS (
  SELECT *,
    -- Calculate running goal (cumulative for counts, flat for averages)
    CASE 
      WHEN is_average_metric THEN target_value  -- Flat target for averages
      ELSE SUM(period_goal) OVER (
        PARTITION BY series_label, period_type 
        ORDER BY ts 
        ROWS UNBOUNDED PRECEDING
      )  -- Cumulative for counts
    END as running_goal
  FROM goal_periods
)
SELECT 
  ts,
  metric_key,
  'Goal: ' || series_label as series_label,  -- Prefix with "Goal: "
  period_goal as value,
  running_goal as running_sum,
  true as is_goal,
  period_type,
  period_start,
  period_end,
  period_goal as period_relative_value,
  running_goal as period_relative_running_sum,
  0 as period_baseline_value,
  NOW() as updated_at
FROM running_goals;

-- Create a unified view that combines actual data with generated goals
CREATE OR REPLACE VIEW analytics_company_1756502314139.metrics_with_goals AS
-- Actual metrics (unchanged)
SELECT 
  ts, metric_key, series_label, value, running_sum, 
  is_goal, period_type, period_start, period_end,
  period_relative_value, period_relative_running_sum, period_baseline_value, updated_at
FROM analytics_company_1756502314139.metrics_time_series 
WHERE NOT is_goal

UNION ALL

-- Generated goals (from our new view)
SELECT 
  ts, metric_key, series_label, value, running_sum,
  is_goal, period_type, period_start, period_end,
  period_relative_value, period_relative_running_sum, period_baseline_value, updated_at
FROM analytics_company_1756502314139.metrics_goals_view;

-- Add helpful comment
COMMENT ON VIEW analytics_company_1756502314139.metrics_with_goals IS 
'Unified view combining actual metrics with dynamically generated goals. 
Replaces TypeScript goal generation logic for better performance.
Created: 2025-09-08';