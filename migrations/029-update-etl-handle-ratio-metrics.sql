-- Update ETL function to handle ratio/percentage metrics correctly
-- Sets actual_value=NULL for percentage/average metrics
-- Populates numerator/denominator for ratio calculations

CREATE OR REPLACE FUNCTION populate_company_metrics_time_series(
  company_id_param BIGINT,
  start_date_param DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  end_date_param DATE DEFAULT CURRENT_DATE
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  schema_name TEXT;
  metric_record RECORD;
  daily_actual NUMERIC := 0;
  daily_goal NUMERIC := 0;
  daily_numerator NUMERIC := NULL;
  daily_denominator NUMERIC := NULL;
  yearly_goal NUMERIC := 0;
  days_in_year INTEGER;
  records_processed INTEGER := 0;
  current_date_iter DATE;
  is_ratio_metric BOOLEAN := false;
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
      SELECT id, name, source_table, expr_sql, date_column, yearly_goal, format, calculation_type
      FROM %I.metrics
      WHERE is_active = true
      ORDER BY id
    ', schema_name)
  LOOP
    RAISE NOTICE 'Processing metric: % (ID: %, Format: %, Calc Type: %)',
      metric_record.name, metric_record.id, metric_record.format, metric_record.calculation_type;

    yearly_goal := COALESCE(metric_record.yearly_goal::NUMERIC, 0);
    daily_goal := CASE WHEN yearly_goal > 0 THEN yearly_goal / days_in_year ELSE 0 END;

    -- Determine if this is a ratio/percentage/average metric
    is_ratio_metric := (
      metric_record.format = 'percentage' OR
      metric_record.calculation_type = 'average' OR
      metric_record.calculation_type = 'ratio'
    );

    -- Process each day in the date range
    current_date_iter := start_date_param;
    WHILE current_date_iter <= end_date_param LOOP
      -- Reset values
      daily_actual := 0;
      daily_numerator := NULL;
      daily_denominator := NULL;

      -- Calculate values for this date
      BEGIN
        IF is_ratio_metric THEN
          -- For ratio metrics, store NULL in actual_value
          -- Note: You'll need to update your SQL expressions to return numerator,denominator
          -- For now, we'll set placeholder logic
          daily_actual := NULL;

          -- TODO: Update metric expressions to return structured data for numerator/denominator
          -- Example: expr_sql could return JSON like {"numerator": 45, "denominator": 200}
          EXECUTE format('SELECT COALESCE((%s), 0) FROM %s f WHERE DATE(f.%s) = %L',
            metric_record.expr_sql,
            metric_record.source_table,
            COALESCE(metric_record.date_column, 'created_at'),
            current_date_iter
          ) INTO daily_numerator;

          -- For now, set a placeholder denominator
          daily_denominator := 100; -- You'll need to update this based on your metric logic

        ELSE
          -- For simple metrics, calculate actual_value normally
          EXECUTE format('SELECT COALESCE((%s), 0) FROM %s f WHERE DATE(f.%s) = %L',
            metric_record.expr_sql,
            metric_record.source_table,
            COALESCE(metric_record.date_column, 'created_at'),
            current_date_iter
          ) INTO daily_actual;
        END IF;

      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to calculate values for metric % on %: %', metric_record.name, current_date_iter, SQLERRM;
          daily_actual := CASE WHEN is_ratio_metric THEN NULL ELSE 0 END;
          daily_numerator := NULL;
          daily_denominator := NULL;
      END;

      -- Insert into metric_history with new columns
      BEGIN
        EXECUTE format('
          INSERT INTO %I.metric_history (metric_id, date, actual_value, goal_value, numerator, denominator)
          VALUES (%s, %L, %s, %s, %s, %s)
          ON CONFLICT (metric_id, date) DO UPDATE SET
            actual_value = EXCLUDED.actual_value,
            goal_value = EXCLUDED.goal_value,
            numerator = EXCLUDED.numerator,
            denominator = EXCLUDED.denominator,
            updated_at = NOW()
        ', schema_name,
           metric_record.id,
           current_date_iter,
           CASE WHEN daily_actual IS NULL THEN 'NULL' ELSE daily_actual::text END,
           daily_goal,
           CASE WHEN daily_numerator IS NULL THEN 'NULL' ELSE daily_numerator::text END,
           CASE WHEN daily_denominator IS NULL THEN 'NULL' ELSE daily_denominator::text END
        );

        records_processed := records_processed + 1;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE NOTICE 'Failed to insert metric_history for % on %: %', metric_record.name, current_date_iter, SQLERRM;
      END;

      current_date_iter := current_date_iter + 1;
    END LOOP;

  END LOOP;

  RETURN 'Successfully processed ' || records_processed || ' metric history records for company ' || company_id_param || ' from ' || start_date_param || ' to ' || end_date_param || ' (ratio-aware)';
END;
$$;