-- Migration: Create Metrics Time Series Table
-- Date: 2025-09-03
-- Purpose: Pre-calculated running sum metrics for fast chart rendering

-- Function to create metrics_time_series table for a company
CREATE OR REPLACE FUNCTION create_company_metrics_time_series(company_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  schema_name TEXT;
  result TEXT;
BEGIN
  -- Generate schema name using company ID
  schema_name := 'analytics_company_' || company_id;
  
  -- Create the metrics time series table in the company's analytics schema
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.metrics_time_series (
      ts DATE NOT NULL,
      metric_key TEXT NOT NULL,
      series_label TEXT NOT NULL,
      value NUMERIC DEFAULT 0,
      running_sum NUMERIC DEFAULT 0,
      is_goal BOOLEAN NOT NULL DEFAULT FALSE,
      period_type TEXT NOT NULL, -- ''daily'', ''weekly'', ''monthly'', ''quarterly'', ''yearly''
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      
      PRIMARY KEY (ts, metric_key, is_goal, period_type)
    )', schema_name);

  -- Create indexes for performance
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.metrics_time_series(ts, metric_key)', 
    schema_name || '_mts_ts_metric_idx', schema_name);
  
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.metrics_time_series(metric_key, period_type, is_goal)', 
    schema_name || '_mts_metric_period_idx', schema_name);
  
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.metrics_time_series(period_start, period_end)', 
    schema_name || '_mts_period_range_idx', schema_name);

  -- Create updated_at trigger
  EXECUTE format('
    CREATE OR REPLACE FUNCTION %I.update_metrics_time_series_updated_at()
    RETURNS TRIGGER AS $t$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $t$ LANGUAGE plpgsql;
  ', schema_name);

  EXECUTE format('
    DROP TRIGGER IF EXISTS metrics_time_series_updated_at ON %I.metrics_time_series;
    CREATE TRIGGER metrics_time_series_updated_at
      BEFORE UPDATE ON %I.metrics_time_series
      FOR EACH ROW EXECUTE FUNCTION %I.update_metrics_time_series_updated_at();
  ', schema_name, schema_name, schema_name);

  result := 'Created metrics_time_series table for company ' || company_id;
  RETURN result;
END;
$$;

-- Function to populate metrics time series for a specific period
CREATE OR REPLACE FUNCTION populate_company_metrics_time_series(
  company_id BIGINT,
  period_type TEXT, -- 'weekly', 'monthly', 'quarterly', 'yearly'
  period_start DATE,
  period_end DATE
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  schema_name TEXT;
  metric_record RECORD;
  date_record RECORD;
  running_sum_actual NUMERIC := 0;
  running_sum_goal NUMERIC := 0;
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

    -- Process each date in the period
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

        -- Insert actual value
        EXECUTE format('
          INSERT INTO %I.metrics_time_series 
          (ts, metric_key, series_label, value, running_sum, is_goal, period_type, period_start, period_end)
          VALUES (%L, %L, %L, %L, %L, FALSE, %L, %L, %L)
        ', schema_name, 
           date_record.dt, metric_record.metric_key, metric_record.label, 
           daily_actual, running_sum_actual, 
           period_type, period_start, period_end);

        -- Insert goal value (only if it exists)
        IF daily_goal > 0 THEN
          EXECUTE format('
            INSERT INTO %I.metrics_time_series 
            (ts, metric_key, series_label, value, running_sum, is_goal, period_type, period_start, period_end)
            VALUES (%L, %L, %L, %L, %L, TRUE, %L, %L, %L)
          ', schema_name, 
             date_record.dt, metric_record.metric_key, 'Goal: ' || metric_record.label, 
             daily_goal, running_sum_goal, 
             period_type, period_start, period_end);
        END IF;

      END;
    END LOOP;
  END LOOP;

  result := 'Populated metrics time series for company ' || company_id || ' period ' || period_type;
  RETURN result;
END;
$$;

-- Create tables for all existing companies
DO $$
DECLARE
  company_record RECORD;
  result TEXT;
BEGIN
  FOR company_record IN 
    SELECT id FROM companies WHERE is_active = TRUE
  LOOP
    SELECT create_company_metrics_time_series(company_record.id) INTO result;
    RAISE NOTICE '%', result;
  END LOOP;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION create_company_metrics_time_series(BIGINT) IS 'Creates metrics_time_series table in company analytics schema for pre-calculated running sums';
COMMENT ON FUNCTION populate_company_metrics_time_series(BIGINT, TEXT, DATE, DATE) IS 'Populates metrics time series with running sum calculations for a specific period';

-- Grant permissions (uncomment and adjust role as needed)
-- GRANT EXECUTE ON FUNCTION create_company_metrics_time_series(BIGINT) TO your_app_role;
-- GRANT EXECUTE ON FUNCTION populate_company_metrics_time_series(BIGINT, TEXT, DATE, DATE) TO your_app_role;