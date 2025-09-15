-- Create a simple, working daily ETL function
-- This version uses a cleaner approach without complex formatting

-- Drop existing function first
DROP FUNCTION IF EXISTS populate_daily_metric_history(BIGINT, DATE);

-- Create new working function
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
  days_in_year INTEGER;
  records_processed INTEGER := 0;
BEGIN
  -- Build schema name
  schema_name := 'analytics_company_' || company_id_param::text;

  RAISE NOTICE 'Starting daily ETL for company % schema % on date %',
    company_id_param, schema_name, target_date_param;

  -- Calculate days in year for goal calculation
  days_in_year := CASE
    WHEN (EXTRACT(YEAR FROM target_date_param)::INTEGER % 4 = 0 AND
          EXTRACT(YEAR FROM target_date_param)::INTEGER % 100 != 0) OR
         (EXTRACT(YEAR FROM target_date_param)::INTEGER % 400 = 0) THEN 366
    ELSE 365
  END;

  -- Process each active metric
  FOR metric_record IN
    EXECUTE format('
      SELECT id, name, source_table, expr_sql, date_column, yearly_goal
      FROM %I.metrics
      WHERE is_active = true
      ORDER BY id
    ', schema_name)
  LOOP
    RAISE NOTICE 'Processing metric: % (ID: %)', metric_record.name, metric_record.id;

    -- Reset values
    daily_actual := 0;
    daily_goal := 0;
    yearly_goal := COALESCE(metric_record.yearly_goal::NUMERIC, 0);

    -- Calculate daily actual value
    BEGIN
      EXECUTE format('SELECT COALESCE((%s), 0) FROM %s f WHERE DATE(f.%s) = %L',
        metric_record.expr_sql,
        metric_record.source_table,
        COALESCE(metric_record.date_column, 'created_at'),
        target_date_param
      ) INTO daily_actual;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Failed to calculate actual for metric %: %', metric_record.name, SQLERRM;
        daily_actual := 0;
    END;

    -- Calculate daily goal (simple yearly goal / days)
    IF yearly_goal > 0 THEN
      daily_goal := yearly_goal / days_in_year;
    END IF;

    RAISE NOTICE 'Calculated for %: actual=%, goal=%', metric_record.name, daily_actual, daily_goal;

    -- Insert the record using simpler approach
    BEGIN
      EXECUTE format('
        INSERT INTO %I.metric_history (company_id, metric_id, date, actual_value, goal_value, period)
        VALUES (%s, %s, %L, %s, %s, %L)
        ON CONFLICT (metric_id, date) DO UPDATE SET
          actual_value = EXCLUDED.actual_value,
          goal_value = EXCLUDED.goal_value,
          recorded_at = NOW()
      ', schema_name, company_id_param, metric_record.id, target_date_param, daily_actual, daily_goal, 'daily');

      records_processed := records_processed + 1;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE NOTICE 'Failed to insert metric history for %: %', metric_record.name, SQLERRM;
    END;

  END LOOP;

  RETURN format('Successfully processed % metrics for company % on %',
    records_processed, company_id_param, target_date_param);
END;
$$;

-- Add comment
COMMENT ON FUNCTION populate_daily_metric_history(BIGINT, DATE) IS 'Simple daily metric_history population with actual vs goal values';