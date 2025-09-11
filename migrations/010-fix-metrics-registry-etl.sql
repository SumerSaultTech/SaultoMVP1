-- Migration to fix populate_company_metrics_time_series to use metric_registry
-- This replaces the hardcoded metrics with dynamic registry-based metrics

-- Drop existing function first
DROP FUNCTION IF EXISTS populate_company_metrics_time_series(BIGINT, TEXT, DATE, DATE);

CREATE FUNCTION populate_company_metrics_time_series(
  company_id_param BIGINT,
  period_type_param TEXT,
  start_date_param DATE,
  end_date_param DATE
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  schema_name TEXT;
  metric_record RECORD;
  date_record RECORD;
  daily_actual NUMERIC := 0;
  daily_goal NUMERIC := 0;
  running_actual NUMERIC := 0;
  running_goal NUMERIC := 0;
  filter_clause TEXT := '';
  date_col TEXT;
BEGIN
  -- Build schema name
  schema_name := 'analytics_company_' || company_id_param::text;
  
  RAISE NOTICE 'Starting ETL for company % schema %, period %, range % to %', 
    company_id_param, schema_name, period_type_param, start_date_param, end_date_param;

  -- Delete existing data for this period and date range
  EXECUTE format('
    DELETE FROM %I.metrics_time_series 
    WHERE period_type = %L 
    AND ts BETWEEN %L AND %L
  ', schema_name, period_type_param, start_date_param, end_date_param);

  -- Process each active metric from the registry
  FOR metric_record IN 
    EXECUTE format('
      SELECT metric_key, label, source_table, expr_sql, date_column, filters
      FROM %I.metric_registry 
      WHERE is_active = TRUE 
      ORDER BY metric_key
    ', schema_name)
  LOOP
    RAISE NOTICE 'Processing metric: % (%)', metric_record.label, metric_record.metric_key;
    
    -- Reset running sums for this metric
    running_actual := 0;
    running_goal := 0;
    
    -- Set date column (default to resolved_at)
    date_col := COALESCE(metric_record.date_column, 'resolved_at');
    
    -- Build filter clause if filters exist
    filter_clause := '';
    IF metric_record.filters IS NOT NULL THEN
      filter_clause := ' AND ' || (metric_record.filters->>'resolved_only')::text;
    END IF;
    
    -- Generate time series for each day in the period
    FOR date_record IN 
      SELECT generate_series(start_date_param, end_date_param, '1 day'::interval)::date AS dt
    LOOP
      -- Calculate daily actual using the expr_sql from registry
      BEGIN
        EXECUTE format('
          SELECT COALESCE((%s), 0)
          FROM %I.%I f
          WHERE f.%I::date = %L
            AND f.resolved_at IS NOT NULL
        ', 
        metric_record.expr_sql,
        schema_name, metric_record.source_table,
        date_col, date_record.dt
        ) INTO daily_actual;
      EXCEPTION 
        WHEN OTHERS THEN
          daily_actual := 0;
      END;
      
      -- For now, set daily goal to 0 (can be enhanced later)
      daily_goal := 0;
      
      -- Update running sums
      running_actual := running_actual + daily_actual;
      running_goal := running_goal + daily_goal;
      
      -- Insert actual values
      EXECUTE format('
        INSERT INTO %I.metrics_time_series 
        (ts, metric_key, series_label, value, running_sum, is_goal, period_type,
         period_start, period_end, period_relative_value, period_relative_running_sum, period_baseline_value, updated_at)
        VALUES (%L, %L, %L, %L, %L, false, %L, %L, %L, %L, %L, 0, NOW())
        ON CONFLICT (ts, metric_key, is_goal, period_type) 
        DO UPDATE SET 
          value = EXCLUDED.value,
          running_sum = EXCLUDED.running_sum,
          series_label = EXCLUDED.series_label,
          period_start = EXCLUDED.period_start,
          period_end = EXCLUDED.period_end,
          period_relative_value = EXCLUDED.period_relative_value,
          period_relative_running_sum = EXCLUDED.period_relative_running_sum,
          updated_at = NOW()
      ', 
      schema_name,
      date_record.dt, metric_record.metric_key, metric_record.label, daily_actual, running_actual, period_type_param,
      start_date_param, end_date_param, daily_actual, running_actual
      );
      
      -- Insert goal values (set to 0 for now)
      EXECUTE format('
        INSERT INTO %I.metrics_time_series 
        (ts, metric_key, series_label, value, running_sum, is_goal, period_type,
         period_start, period_end, period_relative_value, period_relative_running_sum, period_baseline_value, updated_at)
        VALUES (%L, %L, %L, %L, %L, true, %L, %L, %L, %L, %L, 0, NOW())
        ON CONFLICT (ts, metric_key, is_goal, period_type) 
        DO UPDATE SET 
          value = EXCLUDED.value,
          running_sum = EXCLUDED.running_sum,
          series_label = EXCLUDED.series_label,
          period_start = EXCLUDED.period_start,
          period_end = EXCLUDED.period_end,
          period_relative_value = EXCLUDED.period_relative_value,
          period_relative_running_sum = EXCLUDED.period_relative_running_sum,
          updated_at = NOW()
      ', 
      schema_name,
      date_record.dt, metric_record.metric_key, metric_record.label, daily_goal, running_goal, period_type_param,
      start_date_param, end_date_param, daily_goal, running_goal
      );
    END LOOP;
    
    RAISE NOTICE 'Completed metric: % with % actual, % goal running sums', 
      metric_record.label, running_actual, running_goal;
  END LOOP;
  
  RAISE NOTICE 'Completed ETL for company % period %', company_id_param, period_type_param;
END;
$$;