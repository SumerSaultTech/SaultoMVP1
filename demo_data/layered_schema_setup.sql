-- Layered Schema Setup: RAW → STAGING → INT → CORE
-- This script sets up the complete data pipeline architecture

-- Company ID placeholder (will be replaced dynamically)  
-- Use company ID 1748544793859 for MIAS_DATA

-- ==============================================================================
-- RAW LAYER: Direct outputs from connectors (already exists)
-- ==============================================================================
-- Raw tables are created directly by Python connectors:
-- - {company_schema}.salesforce_opportunity
-- - {company_schema}.salesforce_lead  
-- - {company_schema}.salesforce_contact
-- - {company_schema}.hubspot_deal
-- - {company_schema}.jira_issue
-- These remain unchanged as the source of truth

-- ==============================================================================
-- STAGING LAYER: Clean, standardized raw data
-- ==============================================================================

-- Clear existing staging models for this company
DELETE FROM public.sql_models 
WHERE company_id = 1748544793859 AND layer = 'stg';

-- STG: Salesforce Opportunity cleaning and standardization
INSERT INTO public.sql_models (company_id, name, layer, sql_content, source_table, target_table, execution_order, description, tags) VALUES
(1748544793859, 'stg_salesforce_opportunity', 'stg', '
SELECT 
  id,
  name as opportunity_name,
  CASE 
    WHEN amount IS NULL OR amount = 0 THEN NULL
    ELSE amount
  END as amount,
  LOWER(TRIM(stagename)) as stage_name,
  closedate as close_date,
  probability,
  accountid as account_id,
  ownerid as owner_id,
  type as opportunity_type,
  leadsource as lead_source,
  created_date,
  last_modified_date,
  loaded_at,
  ''salesforce'' as source_system,
  company_id,
  -- Data quality flags
  CASE 
    WHEN amount IS NULL OR amount = 0 THEN FALSE
    WHEN closedate IS NULL THEN FALSE
    WHEN stagename IS NULL THEN FALSE
    ELSE TRUE
  END as is_valid_record
FROM {company_schema}.salesforce_opportunity
WHERE 1=1
  AND id IS NOT NULL
  AND created_date IS NOT NULL
', 'salesforce_opportunity', 'stg_salesforce_opportunity', 100, 'Cleaned and standardized Salesforce opportunities', ARRAY['stg', 'salesforce', 'opportunity']);

-- STG: HubSpot Deal cleaning and standardization  
INSERT INTO public.sql_models (company_id, name, layer, sql_content, source_table, target_table, execution_order, description, tags) VALUES
(1748544793859, 'stg_hubspot_deal', 'stg', '
SELECT 
  id,
  dealname as opportunity_name,
  CASE 
    WHEN amount IS NULL OR amount = 0 THEN NULL
    ELSE amount
  END as amount,
  LOWER(TRIM(dealstage)) as stage_name,
  closedate as close_date,
  probability,
  pipeline,
  dealtype as opportunity_type,
  leadsource as lead_source,
  created_date,
  last_modified_date,
  loaded_at,
  ''hubspot'' as source_system,
  company_id,
  -- Data quality flags
  CASE 
    WHEN amount IS NULL OR amount = 0 THEN FALSE
    WHEN closedate IS NULL THEN FALSE
    WHEN dealstage IS NULL THEN FALSE
    ELSE TRUE
  END as is_valid_record
FROM {company_schema}.hubspot_deal
WHERE 1=1
  AND id IS NOT NULL
  AND created_date IS NOT NULL
', 'hubspot_deal', 'stg_hubspot_deal', 101, 'Cleaned and standardized HubSpot deals', ARRAY['stg', 'hubspot', 'deal']);

-- STG: Salesforce Lead cleaning
INSERT INTO public.sql_models (company_id, name, layer, sql_content, source_table, target_table, execution_order, description, tags) VALUES
(1748544793859, 'stg_salesforce_lead', 'stg', '
SELECT 
  id,
  firstname,
  lastname,
  email,
  company,
  LOWER(TRIM(status)) as status,
  LOWER(TRIM(leadsource)) as lead_source,
  created_date,
  last_modified_date,
  converted_date,
  NULL as converted_account_id,  -- not in demo data
  NULL as converted_opportunity_id,  -- not in demo data
  loaded_at,
  ''salesforce'' as source_system,
  company_id,
  -- Data quality flags
  CASE 
    WHEN email IS NULL OR email = '''' THEN FALSE
    WHEN firstname IS NULL AND lastname IS NULL THEN FALSE
    ELSE TRUE
  END as is_valid_record
FROM {company_schema}.salesforce_lead
WHERE 1=1
  AND id IS NOT NULL
  AND created_date IS NOT NULL
', 'salesforce_lead', 'stg_salesforce_lead', 102, 'Cleaned and standardized Salesforce leads', ARRAY['stg', 'salesforce', 'lead']);

-- ==============================================================================
-- INTERMEDIATE LAYER: Business logic and calculations
-- ==============================================================================

-- Clear existing intermediate models
DELETE FROM public.sql_models 
WHERE company_id = 1748544793859 AND layer = 'int';

-- INT: Won opportunities (closed won deals from all sources)
INSERT INTO public.sql_models (company_id, name, layer, sql_content, source_table, target_table, execution_order, description, tags) VALUES
(1748544793859, 'int_won_opportunities', 'int', '
SELECT 
  id,
  opportunity_name,
  amount,
  stage_name,
  close_date,
  probability,
  opportunity_type,
  lead_source,
  created_date,
  last_modified_date,
  source_system,
  company_id
FROM (
  -- Salesforce won opportunities
  SELECT 
    id,
    opportunity_name,
    amount,
    stage_name,
    close_date,
    probability,
    opportunity_type,
    lead_source,
    created_date,
    last_modified_date,
    source_system,
    company_id
  FROM {company_schema}.stg_salesforce_opportunity
  WHERE stage_name = ''closed won''
    AND is_valid_record = TRUE
    AND amount > 0
  
  UNION ALL
  
  -- HubSpot won deals (different stage naming)
  SELECT 
    id,
    opportunity_name,
    amount,
    stage_name,
    close_date,
    probability,
    opportunity_type,
    lead_source,
    created_date,
    last_modified_date,
    source_system,
    company_id
  FROM {company_schema}.stg_hubspot_deal
  WHERE stage_name IN (''closedwon'', ''closed won'')
    AND is_valid_record = TRUE
    AND amount > 0
) combined_won
', 'stg_salesforce_opportunity,stg_hubspot_deal', 'int_won_opportunities', 200, 'All won opportunities from all sources', ARRAY['int', 'revenue', 'won']);

-- INT: Revenue by time period
INSERT INTO public.sql_models (company_id, name, layer, sql_content, source_table, target_table, execution_order, description, tags) VALUES
(1748544793859, 'int_revenue_by_period', 'int', '
WITH daily_revenue AS (
  SELECT 
    close_date,
    source_system,
    SUM(amount) as daily_revenue,
    COUNT(*) as deal_count
  FROM {company_schema}.int_won_opportunities
  WHERE close_date IS NOT NULL
  GROUP BY close_date, source_system
),
period_aggregates AS (
  SELECT 
    close_date,
    DATE_TRUNC(''day'', close_date) as day_period,
    DATE_TRUNC(''week'', close_date) as week_period,
    DATE_TRUNC(''month'', close_date) as month_period,
    DATE_TRUNC(''quarter'', close_date) as quarter_period,
    DATE_TRUNC(''year'', close_date) as year_period,
    EXTRACT(YEAR FROM close_date) as year,
    EXTRACT(MONTH FROM close_date) as month,
    EXTRACT(WEEK FROM close_date) as week,
    EXTRACT(DOY FROM close_date) as day_of_year,
    SUM(daily_revenue) as daily_revenue,
    SUM(deal_count) as daily_deal_count
  FROM daily_revenue
  GROUP BY close_date
)
SELECT 
  close_date,
  day_period,
  week_period,
  month_period,
  quarter_period,
  year_period,
  year,
  month,
  week,
  day_of_year,
  daily_revenue,
  daily_deal_count,
  -- Calculate cumulative values
  SUM(daily_revenue) OVER (ORDER BY close_date) as cumulative_revenue,
  SUM(daily_deal_count) OVER (ORDER BY close_date) as cumulative_deals
FROM period_aggregates
ORDER BY close_date
', 'int_won_opportunities', 'int_revenue_by_period', 201, 'Revenue aggregated by all time periods with cumulative calculations', ARRAY['int', 'revenue', 'periods']);

-- INT: Profit calculations (revenue minus costs)
INSERT INTO public.sql_models (company_id, name, layer, sql_content, source_table, target_table, execution_order, description, tags) VALUES
(1748544793859, 'int_profit_by_period', 'int', '
SELECT 
  close_date,
  day_period,
  week_period,
  month_period,
  quarter_period,
  year_period,
  year,
  month,
  week,
  day_of_year,
  daily_revenue,
  daily_deal_count,
  cumulative_revenue,
  cumulative_deals,
  -- Profit calculations (assuming 30% cost margin)
  daily_revenue * 0.7 as daily_profit,
  cumulative_revenue * 0.7 as cumulative_profit,
  -- Goals (configurable - using $1M annual revenue target)
  (1000000.0 / 365.0) as daily_revenue_goal,
  (1000000.0 * 0.7 / 365.0) as daily_profit_goal
FROM {company_schema}.int_revenue_by_period
', 'int_revenue_by_period', 'int_profit_by_period', 202, 'Profit calculations with configurable cost margins', ARRAY['int', 'profit', 'calculations']);

-- INT: Lead conversion metrics
INSERT INTO public.sql_models (company_id, name, layer, sql_content, source_table, target_table, execution_order, description, tags) VALUES
(1748544793859, 'int_lead_conversion', 'int', '
WITH lead_metrics AS (
  SELECT 
    DATE_TRUNC(''month'', created_date) as month_period,
    COUNT(*) as total_leads,
    COUNT(CASE WHEN converted_date IS NOT NULL THEN 1 END) as converted_leads,
    COUNT(CASE WHEN status = ''qualified'' THEN 1 END) as qualified_leads
  FROM {company_schema}.stg_salesforce_lead
  WHERE is_valid_record = TRUE
  GROUP BY DATE_TRUNC(''month'', created_date)
)
SELECT 
  month_period,
  total_leads,
  converted_leads,
  qualified_leads,
  CASE 
    WHEN total_leads > 0 
    THEN ROUND((converted_leads::NUMERIC / total_leads::NUMERIC) * 100, 2)
    ELSE 0 
  END as conversion_rate_pct,
  CASE 
    WHEN total_leads > 0 
    THEN ROUND((qualified_leads::NUMERIC / total_leads::NUMERIC) * 100, 2)
    ELSE 0 
  END as qualification_rate_pct
FROM lead_metrics
ORDER BY month_period
', 'stg_salesforce_lead', 'int_lead_conversion', 203, 'Lead conversion and qualification rates by time period', ARRAY['int', 'leads', 'conversion']);

-- ==============================================================================
-- CORE LAYER: Final analytics-ready data for dashboard consumption
-- ==============================================================================

-- Clear existing core models
DELETE FROM public.sql_models 
WHERE company_id = 1748544793859 AND layer = 'core';

-- CORE: Main metrics dashboard table
INSERT INTO public.sql_models (company_id, name, layer, sql_content, source_table, target_table, execution_order, description, tags) VALUES
(1748544793859, 'core_metrics_dashboard', 'core', '
WITH metrics_base AS (
  SELECT 
    close_date,
    day_period,
    week_period,
    month_period,
    quarter_period,
    year_period,
    year,
    month,
    week,
    day_of_year,
    daily_revenue,
    daily_profit,
    daily_deal_count,
    cumulative_revenue,
    cumulative_profit,
    cumulative_deals,
    daily_revenue_goal,
    daily_profit_goal,
    -- Calculate cumulative goals
    SUM(daily_revenue_goal) OVER (ORDER BY close_date) as cumulative_revenue_goal,
    SUM(daily_profit_goal) OVER (ORDER BY close_date) as cumulative_profit_goal
  FROM {company_schema}.int_profit_by_period
),
formatted_metrics AS (
  SELECT 
    *,
    -- Progress calculations
    CASE 
      WHEN cumulative_revenue_goal > 0 
      THEN ROUND((cumulative_revenue / cumulative_revenue_goal) * 100, 1)
      ELSE 0 
    END as revenue_progress_pct,
    CASE 
      WHEN cumulative_profit_goal > 0 
      THEN ROUND((cumulative_profit / cumulative_profit_goal) * 100, 1)
      ELSE 0 
    END as profit_progress_pct,
    -- Period labels for UI display
    TO_CHAR(close_date, ''MM-DD'') as day_label,
    TO_CHAR(close_date, ''Dy MM-DD'') as week_label,
    TO_CHAR(close_date, ''MM-DD'') as month_label,
    TO_CHAR(close_date, ''Q"Q" YYYY'') as quarter_label,
    TO_CHAR(close_date, ''YYYY'') as year_label
  FROM metrics_base
)
SELECT * FROM formatted_metrics
ORDER BY close_date
', 'int_profit_by_period', 'core_metrics_dashboard', 300, 'Final dashboard metrics with all calculations and formatting', ARRAY['core', 'dashboard', 'metrics']);

-- CORE: User-defined metrics summary (from INT layer metric tables)
INSERT INTO public.sql_models (company_id, name, layer, sql_content, source_table, target_table, execution_order, description, tags) VALUES
(1748544793859, 'core_user_metrics', 'core', '
-- This model will be populated dynamically based on user-defined metrics
-- It consolidates all int_metric_* tables into a single queryable view
WITH user_metric_tables AS (
  -- This will be dynamically populated by the SQL model engine
  -- when it detects user-defined metrics in the INT layer
  SELECT 
    ''placeholder'' as metric_name,
    ''operational'' as category,
    ''number'' as format,
    0 as yearly_goal,
    0 as current_value,
    NOW() as calculated_at
  WHERE 1=0  -- This ensures no data initially
)
SELECT 
  metric_name,
  category,
  format,
  yearly_goal,
  current_value,
  calculated_at,
  -- Calculate progress if yearly_goal > 0
  CASE 
    WHEN yearly_goal > 0 
    THEN ROUND((current_value / yearly_goal) * 100, 1)
    ELSE NULL 
  END as progress_pct
FROM user_metric_tables
ORDER BY metric_name
', 'int_metric_*', 'core_user_metrics', 299, 'User-defined metrics from INT layer consolidated for dashboard', ARRAY['core', 'user_metrics', 'dynamic']);

-- CORE: Time series data for charts (optimized for frontend consumption)
INSERT INTO public.sql_models (company_id, name, layer, sql_content, source_table, target_table, execution_order, description, tags) VALUES
(1748544793859, 'core_timeseries_data', 'core', '
SELECT 
  ''daily'' as time_period,
  close_date as period_date,
  day_label as period_label,
  cumulative_revenue as revenue_actual,
  cumulative_revenue_goal as revenue_goal,
  cumulative_profit as profit_actual,
  cumulative_profit_goal as profit_goal,
  revenue_progress_pct,
  profit_progress_pct
FROM {company_schema}.core_metrics_dashboard
WHERE close_date >= CURRENT_DATE - INTERVAL ''30 days''

UNION ALL

SELECT 
  ''weekly'' as time_period,
  week_period as period_date,
  week_label as period_label,
  SUM(daily_revenue) as revenue_actual,
  SUM(daily_revenue_goal) as revenue_goal,
  SUM(daily_profit) as profit_actual,
  SUM(daily_profit_goal) as profit_goal,
  CASE 
    WHEN SUM(daily_revenue_goal) > 0 
    THEN ROUND((SUM(daily_revenue) / SUM(daily_revenue_goal)) * 100, 1)
    ELSE 0 
  END as revenue_progress_pct,
  CASE 
    WHEN SUM(daily_profit_goal) > 0 
    THEN ROUND((SUM(daily_profit) / SUM(daily_profit_goal)) * 100, 1)
    ELSE 0 
  END as profit_progress_pct
FROM {company_schema}.core_metrics_dashboard
WHERE week_period >= DATE_TRUNC(''week'', CURRENT_DATE) - INTERVAL ''12 weeks''
GROUP BY week_period, week_label

UNION ALL

SELECT 
  ''monthly'' as time_period,
  month_period as period_date,
  month_label as period_label,
  SUM(daily_revenue) as revenue_actual,
  SUM(daily_revenue_goal) as revenue_goal,
  SUM(daily_profit) as profit_actual,
  SUM(daily_profit_goal) as profit_goal,
  CASE 
    WHEN SUM(daily_revenue_goal) > 0 
    THEN ROUND((SUM(daily_revenue) / SUM(daily_revenue_goal)) * 100, 1)
    ELSE 0 
  END as revenue_progress_pct,
  CASE 
    WHEN SUM(daily_profit_goal) > 0 
    THEN ROUND((SUM(daily_profit) / SUM(daily_profit_goal)) * 100, 1)
    ELSE 0 
  END as profit_progress_pct
FROM {company_schema}.core_metrics_dashboard
WHERE month_period >= DATE_TRUNC(''month'', CURRENT_DATE) - INTERVAL ''12 months''
GROUP BY month_period, month_label

ORDER BY time_period, period_date
', 'core_metrics_dashboard', 'core_timeseries_data', 301, 'Optimized time series data for chart rendering', ARRAY['core', 'timeseries', 'charts']);

-- CORE: Current period metrics summary (for dashboard KPI cards)
INSERT INTO public.sql_models (company_id, name, layer, sql_content, source_table, target_table, execution_order, description, tags) VALUES
(1748544793859, 'core_current_metrics', 'core', '
WITH current_periods AS (
  SELECT 
    ''daily'' as period_type,
    cumulative_revenue as current_revenue,
    cumulative_revenue_goal as revenue_goal,
    cumulative_profit as current_profit,
    cumulative_profit_goal as profit_goal,
    revenue_progress_pct,
    profit_progress_pct,
    cumulative_deals as total_deals
  FROM {company_schema}.core_metrics_dashboard
  WHERE close_date = CURRENT_DATE
  
  UNION ALL
  
  SELECT 
    ''weekly'' as period_type,
    SUM(daily_revenue) as current_revenue,
    SUM(daily_revenue_goal) as revenue_goal,
    SUM(daily_profit) as current_profit,
    SUM(daily_profit_goal) as profit_goal,
    CASE 
      WHEN SUM(daily_revenue_goal) > 0 
      THEN ROUND((SUM(daily_revenue) / SUM(daily_revenue_goal)) * 100, 1)
      ELSE 0 
    END as revenue_progress_pct,
    CASE 
      WHEN SUM(daily_profit_goal) > 0 
      THEN ROUND((SUM(daily_profit) / SUM(daily_profit_goal)) * 100, 1)
      ELSE 0 
    END as profit_progress_pct,
    MAX(cumulative_deals) as total_deals
  FROM {company_schema}.core_metrics_dashboard
  WHERE week_period = DATE_TRUNC(''week'', CURRENT_DATE)
  
  UNION ALL
  
  SELECT 
    ''monthly'' as period_type,
    SUM(daily_revenue) as current_revenue,
    SUM(daily_revenue_goal) as revenue_goal,
    SUM(daily_profit) as current_profit,
    SUM(daily_profit_goal) as profit_goal,
    CASE 
      WHEN SUM(daily_revenue_goal) > 0 
      THEN ROUND((SUM(daily_revenue) / SUM(daily_revenue_goal)) * 100, 1)
      ELSE 0 
    END as revenue_progress_pct,
    CASE 
      WHEN SUM(daily_profit_goal) > 0 
      THEN ROUND((SUM(daily_profit) / SUM(daily_profit_goal)) * 100, 1)
      ELSE 0 
    END as profit_progress_pct,
    MAX(cumulative_deals) as total_deals
  FROM {company_schema}.core_metrics_dashboard
  WHERE month_period = DATE_TRUNC(''month'', CURRENT_DATE)
  
  UNION ALL
  
  -- YTD (Current Year) calculation
  SELECT 
    ''yearly'' as period_type,
    SUM(daily_revenue) as current_revenue,
    SUM(daily_revenue_goal) as revenue_goal,
    SUM(daily_profit) as current_profit,
    SUM(daily_profit_goal) as profit_goal,
    CASE 
      WHEN SUM(daily_revenue_goal) > 0 
      THEN ROUND((SUM(daily_revenue) / SUM(daily_revenue_goal)) * 100, 1)
      ELSE 0 
    END as revenue_progress_pct,
    CASE 
      WHEN SUM(daily_profit_goal) > 0 
      THEN ROUND((SUM(daily_profit) / SUM(daily_profit_goal)) * 100, 1)
      ELSE 0 
    END as profit_progress_pct,
    COUNT(DISTINCT close_date) as total_deals  -- Count deals in current year
  FROM {company_schema}.core_metrics_dashboard
  WHERE EXTRACT(YEAR FROM close_date) = EXTRACT(YEAR FROM CURRENT_DATE)
  
  UNION ALL
  
  -- All-Time (Lifetime) calculation
  SELECT 
    ''lifetime'' as period_type,
    MAX(cumulative_revenue) as current_revenue,  -- Latest cumulative is total lifetime
    NULL as revenue_goal,  -- No lifetime goal
    MAX(cumulative_profit) as current_profit,
    NULL as profit_goal,
    NULL as revenue_progress_pct,
    NULL as profit_progress_pct,
    MAX(cumulative_deals) as total_deals
  FROM {company_schema}.core_metrics_dashboard
  
  UNION ALL
  
  -- Previous Year for comparison
  SELECT 
    ''previous_year'' as period_type,
    SUM(daily_revenue) as current_revenue,
    NULL as revenue_goal,
    SUM(daily_profit) as current_profit,
    NULL as profit_goal,
    NULL as revenue_progress_pct,
    NULL as profit_progress_pct,
    COUNT(DISTINCT close_date) as total_deals
  FROM {company_schema}.core_metrics_dashboard
  WHERE EXTRACT(YEAR FROM close_date) = EXTRACT(YEAR FROM CURRENT_DATE) - 1
)
SELECT 
  period_type,
  current_revenue,
  revenue_goal,
  current_profit,
  profit_goal,
  revenue_progress_pct,
  profit_progress_pct,
  total_deals,
  -- Additional calculated metrics
  CASE 
    WHEN total_deals > 0 
    THEN ROUND(current_revenue / total_deals, 2)
    ELSE 0 
  END as avg_deal_size,
  CASE 
    WHEN revenue_goal > 0 
    THEN revenue_goal - current_revenue
    ELSE 0 
  END as revenue_remaining
FROM current_periods
', 'core_metrics_dashboard', 'core_current_metrics', 302, 'Current period metrics summary for dashboard KPI display', ARRAY['core', 'current', 'kpi']);

COMMIT;