-- Migration: Add Period-Relative Columns to Metrics Time Series
-- Date: 2025-09-03  
-- Purpose: Add columns for period-relative calculations to improve performance and consistency

-- Function to add period-relative columns to existing metrics_time_series tables
CREATE OR REPLACE FUNCTION add_period_relative_columns_to_company(company_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  schema_name TEXT;
  result TEXT;
BEGIN
  -- Generate schema name using company ID
  schema_name := 'analytics_company_' || company_id;
  
  -- Add new columns to metrics_time_series table
  EXECUTE format('
    ALTER TABLE %I.metrics_time_series 
    ADD COLUMN IF NOT EXISTS period_relative_value NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS period_relative_running_sum NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS period_baseline_value NUMERIC DEFAULT 0
  ', schema_name);

  -- Create indexes for new columns
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.metrics_time_series(period_type, period_relative_running_sum)', 
    schema_name || '_mts_period_relative_idx', schema_name);

  result := 'Added period-relative columns to company ' || company_id || ' metrics_time_series table';
  RETURN result;
END;
$$;

-- Function to calculate and populate period-relative values
CREATE OR REPLACE FUNCTION calculate_period_relative_values(
  company_id BIGINT,
  period_type TEXT -- 'weekly', 'monthly', 'quarterly', 'yearly'
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  schema_name TEXT;
  metric_record RECORD;
  date_record RECORD;
  baseline_value NUMERIC := 0;
  result TEXT;
BEGIN
  schema_name := 'analytics_company_' || company_id;
  
  -- Process each metric series (both actual and goal)
  FOR metric_record IN 
    EXECUTE format('
      SELECT DISTINCT metric_key, series_label, is_goal, period_start, period_end
      FROM %I.metrics_time_series 
      WHERE period_type = %L
      ORDER BY metric_key, series_label, is_goal
    ', schema_name, period_type)
  LOOP
    -- Find baseline value (first value in the period for this metric/series)
    EXECUTE format('
      SELECT COALESCE(running_sum, 0)
      FROM %I.metrics_time_series
      WHERE metric_key = %L 
        AND series_label = %L 
        AND is_goal = %L
        AND period_type = %L
        AND period_start = %L
      ORDER BY ts ASC
      LIMIT 1
    ', schema_name, 
       metric_record.metric_key, 
       metric_record.series_label,
       metric_record.is_goal,
       period_type,
       metric_record.period_start
    ) INTO baseline_value;
    
    -- If no baseline found, use 0
    baseline_value := COALESCE(baseline_value, 0);
    
    -- Update all records for this metric/series with period-relative values
    EXECUTE format('
      UPDATE %I.metrics_time_series 
      SET 
        period_baseline_value = %L,
        period_relative_value = GREATEST(0, value),
        period_relative_running_sum = GREATEST(0, running_sum - %L)
      WHERE metric_key = %L 
        AND series_label = %L 
        AND is_goal = %L
        AND period_type = %L
        AND period_start = %L
    ', schema_name, 
       baseline_value,
       baseline_value,
       metric_record.metric_key,
       metric_record.series_label,
       metric_record.is_goal,
       period_type,
       metric_record.period_start);

  END LOOP;

  result := 'Calculated period-relative values for company ' || company_id || ' period ' || period_type;
  RETURN result;
END;
$$;

-- Add columns to all existing company schemas
DO $$
DECLARE
  company_record RECORD;
  result TEXT;
BEGIN
  FOR company_record IN 
    SELECT id FROM companies WHERE is_active = TRUE
  LOOP
    SELECT add_period_relative_columns_to_company(company_record.id) INTO result;
    RAISE NOTICE '%', result;
  END LOOP;
END;
$$;

-- Calculate period-relative values for all existing data
DO $$
DECLARE
  company_record RECORD;
  period_type TEXT;
  result TEXT;
BEGIN
  FOR company_record IN 
    SELECT id FROM companies WHERE is_active = TRUE
  LOOP
    -- Calculate for all period types
    FOREACH period_type IN ARRAY ARRAY['weekly', 'monthly', 'quarterly', 'yearly']
    LOOP
      SELECT calculate_period_relative_values(company_record.id, period_type) INTO result;
      RAISE NOTICE '%', result;
    END LOOP;
  END LOOP;
END;
$$;

-- Update the populate function to calculate period-relative values during ETL
CREATE OR REPLACE FUNCTION populate_company_metrics_time_series(
  company_id BIGINT,
  period_type TEXT,
  period_start DATE,
  period_end DATE
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  schema_name TEXT;
  metric_record RECORD;
  date_record RECORD;
  running_sum_actual NUMERIC := 0;
  running_sum_goal NUMERIC := 0;
  baseline_actual NUMERIC := 0;
  baseline_goal NUMERIC := 0;
  result TEXT;
BEGIN
  schema_name := 'analytics_company_' || company_id;
  
  -- Clear existing data for this period
  EXECUTE format('
    DELETE FROM %I.metrics_time_series 
    WHERE period_type = %L 
      AND period_start = %L 
      AND period_end = %L
  ', schema_name, period_type, period_start, period_end);

  -- Process each active metric
  FOR metric_record IN 
    EXECUTE format('
      SELECT metric_key, label, source_table, expr_sql, date_column, filters
      FROM %I.metric_registry 
      WHERE is_active = TRUE 
      ORDER BY metric_key
    ', schema_name)
  LOOP
    running_sum_actual := 0;
    running_sum_goal := 0;
    baseline_actual := 0;
    baseline_goal := 0;
    
    -- First pass: calculate baseline values (pre-period values)
    -- Look for the most recent value before the period starts
    DECLARE
      pre_period_date DATE := period_start - INTERVAL '1 day';
      filter_clause TEXT := '';
      date_col TEXT;
    BEGIN
      -- Handle filters if they exist
      IF metric_record.filters IS NOT NULL AND metric_record.filters::text != 'null' THEN
        EXECUTE format('SELECT render_metric_filter(%L::jsonb)', metric_record.filters) INTO filter_clause;
        IF filter_clause != '' THEN
          filter_clause := 'AND ' || filter_clause;
        END IF;
      END IF;
      
      -- Use date_column from registry or default to common date fields
      date_col := COALESCE(metric_record.date_column, 'created_at', 'date', 'timestamp');
      
      -- Get the cumulative value just before the period starts
      BEGIN
        EXECUTE format('
          WITH daily_values AS (
            SELECT 
              f.%I::date as metric_date,
              COALESCE(%s, 0) as daily_value
            FROM %I.%I f
            WHERE f.%I::date < %L
              %s
          ),
          cumulative_values AS (
            SELECT 
              metric_date,
              SUM(daily_value) OVER (ORDER BY metric_date) as running_total
            FROM daily_values
            ORDER BY metric_date
          )
          SELECT COALESCE(MAX(running_total), 0)
          FROM cumulative_values
        ', 
        date_col,
        metric_record.expr_sql,
        schema_name, metric_record.source_table,
        date_col, period_start,
        filter_clause
        ) INTO baseline_actual;
      EXCEPTION
        WHEN OTHERS THEN
          baseline_actual := 0;
      END;
      
      -- Get baseline goal (cumulative goal before period)
      BEGIN
        EXECUTE format('
          SELECT COALESCE(SUM(target), 0)
          FROM %I.goals_daily
          WHERE metric_key = %L AND ts_day < %L
        ', schema_name, metric_record.metric_key, period_start
        ) INTO baseline_goal;
      EXCEPTION
        WHEN OTHERS THEN
          baseline_goal := 0;
      END;
    END;

    -- Second pass: process each date in the period with running sums
    FOR date_record IN
      SELECT dt
      FROM shared_utils.dim_date
      WHERE dt >= period_start AND dt <= period_end
      ORDER BY dt
    LOOP
      DECLARE
        daily_actual NUMERIC := 0;
        daily_goal NUMERIC := 0;
        filter_clause TEXT := '';
        date_col TEXT;
      BEGIN
        -- Handle filters if they exist
        IF metric_record.filters IS NOT NULL AND metric_record.filters::text != 'null' THEN
          EXECUTE format('SELECT render_metric_filter(%L::jsonb)', metric_record.filters) INTO filter_clause;
          IF filter_clause != '' THEN
            filter_clause := 'AND ' || filter_clause;
          END IF;
        END IF;
        
        -- Use date_column from registry or default to common date fields
        date_col := COALESCE(metric_record.date_column, 'created_at', 'date', 'timestamp');
        
        -- Calculate daily actual value
        BEGIN
          EXECUTE format('
            SELECT COALESCE(%s, 0)
            FROM %I.%I f
            WHERE f.%I::date = %L
              %s
          ', 
          metric_record.expr_sql,
          schema_name, metric_record.source_table,
          date_col, date_record.dt,
          filter_clause
          ) INTO daily_actual;
        EXCEPTION
          WHEN OTHERS THEN
            daily_actual := 0;
        END;

        -- Get daily goal value
        BEGIN
          EXECUTE format('
            SELECT COALESCE(target, 0)
            FROM %I.goals_daily
            WHERE metric_key = %L AND ts_day = %L
          ', schema_name, metric_record.metric_key, date_record.dt
          ) INTO daily_goal;
        EXCEPTION
          WHEN OTHERS THEN
            daily_goal := 0;
        END;

        -- Update running sums
        running_sum_actual := running_sum_actual + daily_actual;
        running_sum_goal := running_sum_goal + daily_goal;

        -- Insert actual value with period-relative calculations
        EXECUTE format('
          INSERT INTO %I.metrics_time_series 
          (ts, metric_key, series_label, value, running_sum, 
           period_baseline_value, period_relative_value, period_relative_running_sum,
           is_goal, period_type, period_start, period_end)
          VALUES (%L, %L, %L, %L, %L, %L, %L, %L, FALSE, %L, %L, %L)
        ', schema_name, 
           date_record.dt, metric_record.metric_key, metric_record.label, 
           daily_actual, baseline_actual + running_sum_actual,
           baseline_actual, daily_actual, running_sum_actual,
           period_type, period_start, period_end);

        -- Insert goal value (only if it exists) with period-relative calculations
        IF daily_goal > 0 THEN
          EXECUTE format('
            INSERT INTO %I.metrics_time_series 
            (ts, metric_key, series_label, value, running_sum,
             period_baseline_value, period_relative_value, period_relative_running_sum,
             is_goal, period_type, period_start, period_end)
            VALUES (%L, %L, %L, %L, %L, %L, %L, %L, TRUE, %L, %L, %L)
          ', schema_name, 
             date_record.dt, metric_record.metric_key, 'Goal: ' || metric_record.label, 
             daily_goal, baseline_goal + running_sum_goal,
             baseline_goal, daily_goal, running_sum_goal,
             period_type, period_start, period_end);
        END IF;

      END;
    END LOOP;
  END LOOP;

  result := 'Populated metrics time series with period-relative values for company ' || company_id || ' period ' || period_type;
  RETURN result;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION add_period_relative_columns_to_company(BIGINT) IS 'Adds period-relative calculation columns to metrics_time_series table';
COMMENT ON FUNCTION calculate_period_relative_values(BIGINT, TEXT) IS 'Calculates and populates period-relative values for existing data';

-- Grant permissions (uncomment and adjust role as needed)
-- GRANT EXECUTE ON FUNCTION add_period_relative_columns_to_company(BIGINT) TO your_app_role;
-- GRANT EXECUTE ON FUNCTION calculate_period_relative_values(BIGINT, TEXT) TO your_app_role;