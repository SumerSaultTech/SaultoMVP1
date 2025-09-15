-- Create simplified ETL function for daily metric_history population
-- This replaces the complex metrics_time_series ETL with simple daily actual vs goal tracking

-- Drop existing function first
DROP FUNCTION IF EXISTS populate_company_metrics_time_series(BIGINT, TEXT, DATE, DATE);

-- Create new simplified function for daily metric history
CREATE OR REPLACE FUNCTION populate_daily_metric_history(
  company_id_param BIGINT,
  target_date_param DATE DEFAULT CURRENT_DATE
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  schema_name TEXT;
  metric_record RECORD;
  daily_actual NUMERIC := 0;
  daily_goal NUMERIC := 0;
  yearly_goal NUMERIC := 0;
  quarterly_goal NUMERIC := 0;
  monthly_goal NUMERIC := 0;
  current_year INTEGER;
  current_quarter INTEGER;
  current_month INTEGER;
  days_in_year INTEGER;
  days_in_quarter INTEGER;
  days_in_month INTEGER;
  goal_type TEXT;
  quarterly_goals JSONB;
  monthly_goals JSONB;
  records_processed INTEGER := 0;
BEGIN
  -- Build schema name
  schema_name := 'analytics_company_' || company_id_param::text;

  RAISE NOTICE 'Starting daily ETL for company % schema % on date %',
    company_id_param, schema_name, target_date_param;

  -- Calculate time period constants for goal calculations
  current_year := EXTRACT(YEAR FROM target_date_param);
  current_quarter := EXTRACT(QUARTER FROM target_date_param);
  current_month := EXTRACT(MONTH FROM target_date_param);

  days_in_year := CASE
    WHEN (current_year % 4 = 0 AND current_year % 100 != 0) OR (current_year % 400 = 0) THEN 366
    ELSE 365
  END;

  days_in_quarter := CASE current_quarter
    WHEN 1 THEN 90  -- Jan-Mar
    WHEN 2 THEN 91  -- Apr-Jun
    WHEN 3 THEN 92  -- Jul-Sep
    WHEN 4 THEN 92  -- Oct-Dec
  END;

  days_in_month := EXTRACT(DAYS FROM DATE_TRUNC('month', target_date_param) + INTERVAL '1 month' - INTERVAL '1 day');

  -- Process each active metric
  FOR metric_record IN
    EXECUTE format('
      SELECT
        m.id as metric_id,
        m.name,
        m.source_table,
        m.expr_sql,
        m.date_column,
        m.yearly_goal,
        m.goal_type,
        m.quarterly_goals,
        m.monthly_goals
      FROM %I.metrics m
      WHERE m.is_active = TRUE
      ORDER BY m.id
    ', schema_name)
  LOOP
    RAISE NOTICE 'Processing metric: % (ID: %)', metric_record.name, metric_record.metric_id;

    -- Reset values
    daily_actual := 0;
    daily_goal := 0;
    yearly_goal := COALESCE(metric_record.yearly_goal::NUMERIC, 0);
    goal_type := COALESCE(metric_record.goal_type, 'yearly');
    quarterly_goals := metric_record.quarterly_goals;
    monthly_goals := metric_record.monthly_goals;

    -- Calculate daily actual value using the metric's SQL expression
    BEGIN
      -- Handle source_table that may already include schema name
      EXECUTE format('
        SELECT COALESCE((%s), 0)
        FROM %s f
        WHERE DATE(f.%s) = %L
      ',
      metric_record.expr_sql,
      metric_record.source_table,  -- Use source_table as-is (already includes schema)
      COALESCE(metric_record.date_column, 'created_at'),
      target_date_param
      ) INTO daily_actual;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Failed to calculate actual for metric %: %', metric_record.name, SQLERRM;
        daily_actual := 0;
    END;

    -- Calculate daily goal based on goal type
    IF yearly_goal > 0 THEN
      IF goal_type = 'yearly' THEN
        daily_goal := yearly_goal / days_in_year;
      ELSIF goal_type = 'quarterly' AND quarterly_goals IS NOT NULL THEN
        quarterly_goal := COALESCE((quarterly_goals->('Q' || current_quarter))::NUMERIC, 0);
        IF quarterly_goal > 0 THEN
          daily_goal := quarterly_goal / days_in_quarter;
        ELSE
          daily_goal := yearly_goal / days_in_year; -- Fallback to yearly
        END IF;
      ELSIF goal_type = 'monthly' AND monthly_goals IS NOT NULL THEN
        monthly_goal := COALESCE((monthly_goals->(TO_CHAR(target_date_param, 'Mon')))::NUMERIC, 0);
        IF monthly_goal > 0 THEN
          daily_goal := monthly_goal / days_in_month;
        ELSE
          daily_goal := yearly_goal / days_in_year; -- Fallback to yearly
        END IF;
      ELSE
        daily_goal := yearly_goal / days_in_year; -- Default fallback
      END IF;
    END IF;

    RAISE NOTICE 'Calculated for %: actual=%, goal=% (from % goal: %)',
      metric_record.name, daily_actual, daily_goal, goal_type, yearly_goal;

    -- Insert or update the metric_history record
    DECLARE
      insert_sql TEXT;
    BEGIN
      insert_sql := format('
        INSERT INTO %I.metric_history
        (company_id, metric_id, date, actual_value, goal_value, period)
        VALUES (%s, %s, %L, %s, %s, %L)
        ON CONFLICT (metric_id, date)
        DO UPDATE SET
          actual_value = EXCLUDED.actual_value,
          goal_value = EXCLUDED.goal_value,
          recorded_at = NOW()
      ', schema_name, company_id_param, metric_record.metric_id, target_date_param, daily_actual, daily_goal, 'daily');

      EXECUTE insert_sql;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Failed to insert metric history for %: %', metric_record.name, SQLERRM;
    END;

    records_processed := records_processed + 1;
  END LOOP;

  RETURN format('Successfully processed % metrics for company % on %',
    records_processed, company_id_param, target_date_param);
END;
$$;

-- Add comment
COMMENT ON FUNCTION populate_daily_metric_history(BIGINT, DATE) IS 'Populates daily metric_history with actual vs goal values for a specific date';