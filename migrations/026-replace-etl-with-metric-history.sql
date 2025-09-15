-- Replace the old ETL function with one that populates metric_history
-- This ensures that when the system calls populate_company_metrics_time_series,
-- it actually populates metric_history as requested by the user

-- Drop existing function first
DROP FUNCTION IF EXISTS populate_company_metrics_time_series(BIGINT, TEXT, DATE, DATE);

-- Create new function that populates metric_history instead of time series
CREATE OR REPLACE FUNCTION populate_company_metrics_time_series(
  company_id_param BIGINT,
  period_type_param TEXT,
  start_date_param DATE,
  end_date_param DATE
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
  current_date_iter DATE;
BEGIN
  -- Build schema name
  schema_name := 'analytics_company_' || company_id_param::text;

  RAISE NOTICE 'Starting metric_history population for company % schema % from % to %',
    company_id_param, schema_name, start_date_param, end_date_param;

  -- Calculate days in year for goal calculation
  days_in_year := CASE
    WHEN (EXTRACT(YEAR FROM start_date_param)::INTEGER % 4 = 0 AND
          EXTRACT(YEAR FROM start_date_param)::INTEGER % 100 != 0) OR
         (EXTRACT(YEAR FROM start_date_param)::INTEGER % 400 = 0) THEN 366
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

    yearly_goal := COALESCE(metric_record.yearly_goal::NUMERIC, 0);
    daily_goal := CASE WHEN yearly_goal > 0 THEN yearly_goal / days_in_year ELSE 0 END;

    -- Process each day in the date range
    current_date_iter := start_date_param;
    WHILE current_date_iter <= end_date_param LOOP
      -- Reset actual value
      daily_actual := 0;

      -- Calculate actual value for this date
      BEGIN
        EXECUTE format('SELECT COALESCE((%s), 0) FROM %s f WHERE DATE(f.%s) = %L',
          metric_record.expr_sql,
          metric_record.source_table,
          COALESCE(metric_record.date_column, 'created_at'),
          current_date_iter
        ) INTO daily_actual;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to calculate actual for metric % on %: %', metric_record.name, current_date_iter, SQLERRM;
          daily_actual := 0;
      END;

      -- Insert into metric_history
      BEGIN
        EXECUTE format('
          INSERT INTO %I.metric_history (company_id, metric_id, date, actual_value, goal_value, period)
          VALUES (%s, %s, %L, %s, %s, %L)
          ON CONFLICT (metric_id, date) DO UPDATE SET
            actual_value = EXCLUDED.actual_value,
            goal_value = EXCLUDED.goal_value,
            recorded_at = NOW()
        ', schema_name, company_id_param, metric_record.id, current_date_iter, daily_actual, daily_goal, 'daily');

        records_processed := records_processed + 1;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to insert metric_history for % on %: %', metric_record.name, current_date_iter, SQLERRM;
      END;

      current_date_iter := current_date_iter + 1;
    END LOOP;

  END LOOP;

  RETURN 'Successfully processed ' || records_processed || ' metric history records for company ' || company_id_param || ' from ' || start_date_param || ' to ' || end_date_param;
END;
$$;

-- Add comment
COMMENT ON FUNCTION populate_company_metrics_time_series(BIGINT, TEXT, DATE, DATE) IS 'Populates metric_history with daily actual vs goal values for date range (replaces old time series ETL)';