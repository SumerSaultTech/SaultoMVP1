-- Migration 009: Fix duplicate key constraint with UPSERT functionality
-- Replace INSERT with INSERT ... ON CONFLICT UPDATE for ETL process

-- Drop existing function first
DROP FUNCTION IF EXISTS populate_company_metrics_time_series(BIGINT, TEXT, DATE, DATE);

CREATE OR REPLACE FUNCTION populate_company_metrics_time_series(
  company_id BIGINT,
  period_type TEXT,
  period_start DATE,
  period_end DATE
) RETURNS VOID AS $$
DECLARE
  schema_name TEXT;
  metric_record RECORD;
  date_record RECORD;
  daily_actual NUMERIC;
  daily_goal NUMERIC;
  running_sum_actual NUMERIC := 0;
  running_sum_goal NUMERIC := 0;
  period_baseline NUMERIC := 0;
  period_relative_actual NUMERIC;
  period_relative_goal NUMERIC;
  period_relative_running_actual NUMERIC := 0;
  period_relative_running_goal NUMERIC := 0;
BEGIN
  schema_name := 'analytics_company_' || company_id::text;
  
  RAISE NOTICE 'Starting ETL for company % schema %, period %, range % to %', 
    company_id, schema_name, period_type, period_start, period_end;

  -- Get all metrics for this company
  FOR metric_record IN
    SELECT 
      'jira_story_points_completed' as metric_key, 
      'Jira Story Points Completed' as label
    UNION ALL
    SELECT 
      'jira_issues_resolved' as metric_key, 
      'Jira Issues Resolved' as label
    UNION ALL
    SELECT 
      'jira_avg_cycle_time' as metric_key, 
      'Average Jira Cycle Time' as label
  LOOP
    -- Reset running sums for each metric
    running_sum_actual := 0;
    running_sum_goal := 0;
    period_relative_running_actual := 0;
    period_relative_running_goal := 0;
    period_baseline := 0;

    RAISE NOTICE 'Processing metric: % (%)', metric_record.label, metric_record.metric_key;

    -- Generate dates within the period
    FOR date_record IN
      SELECT generate_series(period_start::date, period_end::date, '1 day'::interval)::date as dt
    LOOP
      -- Get actual value for this date (currently returns 0 for demo data)
      BEGIN
        EXECUTE format('
          SELECT COALESCE(SUM(value), 0) 
          FROM %I.core_%s_daily 
          WHERE metric_key = %L AND ts_day = %L
        ', schema_name, lower(replace(metric_record.metric_key, '_', '_')), metric_record.metric_key, date_record.dt
        ) INTO daily_actual;
      EXCEPTION
        WHEN OTHERS THEN
          daily_actual := 0;
      END;

      -- Get goal value for this date (currently returns 0 for demo data)  
      BEGIN
        EXECUTE format('
          SELECT COALESCE(SUM(goal_value), 0)
          FROM %I.core_%s_daily 
          WHERE metric_key = %L AND ts_day = %L
        ', schema_name, lower(replace(metric_record.metric_key, '_', '_')), metric_record.metric_key, date_record.dt
        ) INTO daily_goal;
      EXCEPTION
        WHEN OTHERS THEN
          daily_goal := 0;
      END;

      -- Update running sums
      running_sum_actual := running_sum_actual + daily_actual;
      running_sum_goal := running_sum_goal + daily_goal;

      -- Calculate period-relative values (change from baseline)
      IF date_record.dt = period_start THEN
        period_baseline := daily_actual;
        period_relative_actual := 0; -- First day is baseline
      ELSE
        period_relative_actual := daily_actual - period_baseline;
      END IF;
      
      period_relative_running_actual := period_relative_running_actual + period_relative_actual;

      -- UPSERT actual value with ON CONFLICT UPDATE
      EXECUTE format('
        INSERT INTO %I.metrics_time_series 
        (ts, metric_key, series_label, value, running_sum, 
         period_baseline_value, period_relative_value, period_relative_running_sum,
         is_goal, period_type, period_start, period_end)
        VALUES (%L, %L, %L, %L, %L, %L, %L, %L, FALSE, %L, %L, %L)
        ON CONFLICT (ts, metric_key, is_goal, period_type) 
        DO UPDATE SET 
          series_label = EXCLUDED.series_label,
          value = EXCLUDED.value,
          running_sum = EXCLUDED.running_sum,
          period_baseline_value = EXCLUDED.period_baseline_value,
          period_relative_value = EXCLUDED.period_relative_value,
          period_relative_running_sum = EXCLUDED.period_relative_running_sum,
          period_start = EXCLUDED.period_start,
          period_end = EXCLUDED.period_end,
          updated_at = CURRENT_TIMESTAMP
      ', schema_name, 
         date_record.dt, metric_record.metric_key, metric_record.label, 
         daily_actual, running_sum_actual, period_baseline, 
         period_relative_actual, period_relative_running_actual,
         period_type, period_start, period_end);

      -- UPSERT goal value (only if it exists) with ON CONFLICT UPDATE
      IF daily_goal > 0 THEN
        period_relative_goal := daily_goal - period_baseline;
        period_relative_running_goal := period_relative_running_goal + period_relative_goal;
        
        EXECUTE format('
          INSERT INTO %I.metrics_time_series 
          (ts, metric_key, series_label, value, running_sum, 
           period_baseline_value, period_relative_value, period_relative_running_sum,
           is_goal, period_type, period_start, period_end)
          VALUES (%L, %L, %L, %L, %L, %L, %L, %L, TRUE, %L, %L, %L)
          ON CONFLICT (ts, metric_key, is_goal, period_type)
          DO UPDATE SET 
            series_label = EXCLUDED.series_label,
            value = EXCLUDED.value,
            running_sum = EXCLUDED.running_sum,
            period_baseline_value = EXCLUDED.period_baseline_value,
            period_relative_value = EXCLUDED.period_relative_value,
            period_relative_running_sum = EXCLUDED.period_relative_running_sum,
            period_start = EXCLUDED.period_start,
            period_end = EXCLUDED.period_end,
            updated_at = CURRENT_TIMESTAMP
        ', schema_name, 
           date_record.dt, metric_record.metric_key, metric_record.label || ' Goal', 
           daily_goal, running_sum_goal, period_baseline,
           period_relative_goal, period_relative_running_goal,
           period_type, period_start, period_end);
      END IF;

    END LOOP;

    RAISE NOTICE 'Completed metric: % with % actual, % goal running sums', 
      metric_record.label, running_sum_actual, running_sum_goal;

  END LOOP;

  RAISE NOTICE 'Completed ETL for company % period %', company_id, period_type;
END;
$$ LANGUAGE plpgsql;

-- Also add updated_at column if it doesn't exist
DO $$
DECLARE
  schema_rec RECORD;
BEGIN
  FOR schema_rec IN 
    SELECT schemaname 
    FROM pg_tables 
    WHERE tablename = 'metrics_time_series' 
      AND schemaname LIKE 'analytics_company_%'
  LOOP
    -- Add updated_at column if it doesn't exist
    EXECUTE format('
      ALTER TABLE %I.metrics_time_series 
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ', schema_rec.schemaname);
    
    RAISE NOTICE 'Added updated_at column to %.metrics_time_series', schema_rec.schemaname;
  END LOOP;
END;
$$;