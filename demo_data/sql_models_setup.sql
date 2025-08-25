-- SQL Models Setup for Data Warehouse Architecture
-- Creates the core SQL models for metrics calculations

-- Insert SQL models for company 1748544793859
INSERT INTO public.sql_models (company_id, name, layer, sql_content, source_table, target_table, execution_order, description, tags) VALUES

-- INTERMEDIATE LAYER MODELS
(1748544793859, 'int_revenue_daily', 'int', '
SELECT 
  close_date,
  source_system,
  SUM(amount) as daily_revenue,
  COUNT(*) as deal_count
FROM (
  SELECT close_date, amount, source_system 
  FROM {company_schema}.stg_salesforce_opportunity 
  WHERE stage_name = ''Closed Won''
  
  UNION ALL
  
  SELECT close_date, amount, source_system 
  FROM {company_schema}.stg_hubspot_deal 
  WHERE stage_name = ''closedwon''
) combined_revenue
WHERE close_date IS NOT NULL
GROUP BY close_date, source_system
ORDER BY close_date
', 'stg_salesforce_opportunity,stg_hubspot_deal', 'int_revenue_daily', 200, 'Daily revenue aggregated from all sources', ARRAY['revenue', 'daily']),

(1748544793859, 'int_profit_daily', 'int', '
SELECT 
  close_date,
  SUM(amount) as daily_revenue,
  SUM(amount) * 0.7 as daily_profit, -- 30% cost deduction
  COUNT(*) as deal_count
FROM {company_schema}.int_revenue_daily
GROUP BY close_date
ORDER BY close_date
', 'int_revenue_daily', 'int_profit_daily', 210, 'Daily profit calculations with cost deductions', ARRAY['profit', 'daily']),

-- CORE LAYER MODELS  
(1748544793859, 'core_metrics_daily', 'core', '
WITH daily_base AS (
  SELECT 
    close_date,
    daily_revenue,
    daily_profit,
    deal_count,
    -- Calculate cumulative values using window functions
    SUM(daily_revenue) OVER (ORDER BY close_date) as cumulative_revenue,
    SUM(daily_profit) OVER (ORDER BY close_date) as cumulative_profit,
    SUM(deal_count) OVER (ORDER BY close_date) as cumulative_deals,
    
    -- Calculate daily goals (assuming $1M annual revenue goal)
    (1000000.0 / 365.0) as daily_revenue_goal,
    (500000.0 / 365.0) as daily_profit_goal,
    
    -- Extract time periods for filtering
    EXTRACT(YEAR FROM close_date) as year,
    EXTRACT(MONTH FROM close_date) as month,
    EXTRACT(WEEK FROM close_date) as week,
    EXTRACT(DOY FROM close_date) as day_of_year,
    DATE_TRUNC(''week'', close_date) as week_start,
    DATE_TRUNC(''month'', close_date) as month_start,
    DATE_TRUNC(''quarter'', close_date) as quarter_start
  FROM {company_schema}.int_profit_daily
),
goals AS (
  SELECT 
    *,
    -- Calculate cumulative goals
    SUM(daily_revenue_goal) OVER (ORDER BY close_date) as cumulative_revenue_goal,
    SUM(daily_profit_goal) OVER (ORDER BY close_date) as cumulative_profit_goal
  FROM daily_base
)
SELECT 
  close_date,
  year,
  month,
  week,
  day_of_year,
  week_start,
  month_start,
  quarter_start,
  daily_revenue,
  daily_profit,
  deal_count,
  cumulative_revenue,
  cumulative_profit,
  cumulative_deals,
  daily_revenue_goal,
  daily_profit_goal,
  cumulative_revenue_goal,
  cumulative_profit_goal,
  
  -- Format for display
  TO_CHAR(close_date, ''MM-DD'') as period_monthly,
  TO_CHAR(close_date, ''Dy MM-DD'') as period_weekly,
  TO_CHAR(close_date, ''HH24:00'') as period_daily,
  
  -- Calculate progress percentages
  CASE 
    WHEN cumulative_revenue_goal > 0 
    THEN ROUND((cumulative_revenue / cumulative_revenue_goal) * 100, 1)
    ELSE 0 
  END as revenue_progress_pct,
  
  CASE 
    WHEN cumulative_profit_goal > 0 
    THEN ROUND((cumulative_profit / cumulative_profit_goal) * 100, 1)
    ELSE 0 
  END as profit_progress_pct

FROM goals
ORDER BY close_date
', 'int_profit_daily', 'core_metrics_daily', 300, 'Final metrics table with cumulative calculations and time period formatting', ARRAY['metrics', 'daily', 'cumulative']),

(1748544793859, 'core_metrics_summary', 'core', '
SELECT 
  ''daily'' as time_period,
  close_date as period_date,
  period_daily as period_label,
  cumulative_revenue as revenue_actual,
  cumulative_revenue_goal as revenue_goal,
  cumulative_profit as profit_actual,
  cumulative_profit_goal as profit_goal
FROM {company_schema}.core_metrics_daily
WHERE close_date = CURRENT_DATE

UNION ALL

SELECT 
  ''weekly'' as time_period,
  close_date as period_date,
  period_weekly as period_label,
  cumulative_revenue as revenue_actual,
  cumulative_revenue_goal as revenue_goal,
  cumulative_profit as profit_actual,
  cumulative_profit_goal as profit_goal
FROM {company_schema}.core_metrics_daily
WHERE week_start = DATE_TRUNC(''week'', CURRENT_DATE)

UNION ALL

SELECT 
  ''monthly'' as time_period,
  close_date as period_date,
  period_monthly as period_label,
  cumulative_revenue as revenue_actual,
  cumulative_revenue_goal as revenue_goal,
  cumulative_profit as profit_actual,
  cumulative_profit_goal as profit_goal
FROM {company_schema}.core_metrics_daily
WHERE month_start = DATE_TRUNC(''month'', CURRENT_DATE)

UNION ALL

SELECT 
  ''yearly'' as time_period,
  close_date as period_date,
  period_monthly as period_label,
  cumulative_revenue as revenue_actual,
  cumulative_revenue_goal as revenue_goal,
  cumulative_profit as profit_actual,
  cumulative_profit_goal as profit_goal
FROM {company_schema}.core_metrics_daily
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)

ORDER BY time_period, period_date
', 'core_metrics_daily', 'core_metrics_summary', 310, 'Summary metrics table for all time periods', ARRAY['metrics', 'summary', 'all-periods']);