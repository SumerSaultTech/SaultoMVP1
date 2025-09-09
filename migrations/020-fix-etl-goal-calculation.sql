-- Fix ETL goal calculation logic to properly store goal values
-- The issue is that goals are stored with value=0 instead of calculated values

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
  kpi_record RECORD;
  date_record RECORD;
  daily_actual NUMERIC := 0;
  daily_goal_value NUMERIC := 0;
  running_actual NUMERIC := 0;
  running_goal NUMERIC := 0;
  goal_target NUMERIC := 0;
  cumulative_sum NUMERIC := 0;
  cumulative_count INTEGER := 0;
  filter_clause TEXT := '';
  date_col TEXT;
  current_year INTEGER;
  current_quarter INTEGER;
  current_month INTEGER;
  days_in_year INTEGER;
  days_in_quarter INTEGER;
  days_in_month INTEGER;
  kpi_yearly_goal NUMERIC := 0;
  quarterly_goal NUMERIC := 0;
  monthly_goal NUMERIC := 0;
  is_average_metric BOOLEAN := false;
  daily_count INTEGER := 0;
  kpi_found BOOLEAN := false;  -- NEW: Track if KPI was found
  kpi_goal_type TEXT;
  kpi_quarterly_goals JSONB;
  kpi_monthly_goals JSONB;
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

  -- Calculate time period constants for goal calculations
  current_year := EXTRACT(YEAR FROM start_date_param);
  current_quarter := EXTRACT(QUARTER FROM start_date_param);
  current_month := EXTRACT(MONTH FROM start_date_param);
  
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
  
  days_in_month := EXTRACT(DAYS FROM DATE_TRUNC('month', start_date_param) + INTERVAL '1 month' - INTERVAL '1 day');

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
    cumulative_sum := 0;
    cumulative_count := 0;
    goal_target := 0;
    daily_goal_value := 0;
    kpi_found := false;  -- NEW: Reset KPI found flag
    
    -- Check if this is an average-type metric
    is_average_metric := metric_record.expr_sql ILIKE '%AVG%';
    
    -- Get goal information from kpi_metrics table - MORE ROBUST LOOKUP
    SELECT k.yearly_goal, k.goal_type, k.quarterly_goals, k.monthly_goals, true
    INTO kpi_yearly_goal, kpi_goal_type, kpi_quarterly_goals, kpi_monthly_goals, kpi_found  -- Use separate variables
    FROM kpi_metrics k
    WHERE k.company_id = company_id_param 
      AND (LOWER(k.name) = LOWER(metric_record.label) 
           OR k.name = metric_record.label
           OR TRIM(LOWER(k.name)) = TRIM(LOWER(metric_record.label)))  -- Multiple matching attempts
    LIMIT 1;
    
    -- NEW: Debug KPI lookup
    IF kpi_found THEN
      RAISE NOTICE 'Found KPI for %: yearly_goal=%, goal_type=%', 
        metric_record.label, kpi_yearly_goal, kpi_goal_type;
    ELSE
      RAISE NOTICE 'WARNING: No KPI found for metric %. Available KPIs: %', 
        metric_record.label, (SELECT string_agg(name, ', ') FROM kpi_metrics WHERE company_id = company_id_param);
    END IF;
    
    -- Calculate goal target and daily goal value based on goal type
    IF kpi_found AND kpi_yearly_goal IS NOT NULL AND kpi_yearly_goal > 0 THEN
      IF kpi_goal_type = 'yearly' THEN
        IF is_average_metric THEN
          goal_target := kpi_yearly_goal; -- For averages: flat target (e.g., 6 days)
          daily_goal_value := kpi_yearly_goal;  -- Daily goal value is the same target
        ELSE
          goal_target := kpi_yearly_goal; -- For counts: still use proportional
          daily_goal_value := kpi_yearly_goal / days_in_year;
        END IF;
      ELSIF kpi_goal_type = 'quarterly' AND kpi_quarterly_goals IS NOT NULL THEN
        quarterly_goal := COALESCE((kpi_quarterly_goals->('Q' || current_quarter))::NUMERIC, 0);
        IF is_average_metric THEN
          goal_target := quarterly_goal;
          daily_goal_value := quarterly_goal;
        ELSE
          goal_target := quarterly_goal;
          daily_goal_value := quarterly_goal / days_in_quarter;
        END IF;
      ELSIF kpi_goal_type = 'monthly' AND kpi_monthly_goals IS NOT NULL THEN
        monthly_goal := COALESCE((kpi_monthly_goals->(TO_CHAR(start_date_param, 'Mon')))::NUMERIC, 0);
        IF is_average_metric THEN
          goal_target := monthly_goal;
          daily_goal_value := monthly_goal;
        ELSE
          goal_target := monthly_goal;
          daily_goal_value := monthly_goal / days_in_month;
        END IF;
      ELSE
        -- Fallback to yearly goal if other types not properly configured
        IF is_average_metric THEN
          goal_target := kpi_yearly_goal;
          daily_goal_value := kpi_yearly_goal;
        ELSE
          goal_target := kpi_yearly_goal;
          daily_goal_value := kpi_yearly_goal / days_in_year;
        END IF;
      END IF;
      
      RAISE NOTICE 'Calculated goal for %: target=% daily_goal_value=% (yearly: %, is_average: %)', 
        metric_record.label, goal_target, daily_goal_value, kpi_yearly_goal, is_average_metric;
    ELSE
      RAISE NOTICE 'No valid KPI goal for metric %, skipping goal generation', metric_record.label;
      daily_goal_value := 0;
      goal_target := 0;
    END IF;
    
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
      -- Calculate daily actual using the expr_sql from registry on real data
      BEGIN
        EXECUTE format('
          SELECT COALESCE((%s), 0)
          FROM %I.%I f
          WHERE DATE(f.%I) = %L
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
      
      -- Handle running sum calculation based on metric type
      IF is_average_metric THEN
        -- For averages: Calculate cumulative average by tracking sum and count of all individual records
        -- Get the sum and count of individual records for this day
        BEGIN
          EXECUTE format('
            SELECT COALESCE(SUM(cycle_time_days), 0), COUNT(*) 
            FROM %I.%I f
            WHERE DATE(f.%I) = %L
              AND f.resolved_at IS NOT NULL
              AND f.cycle_time_days IS NOT NULL
          ', 
          schema_name, metric_record.source_table,
          date_col, date_record.dt
          ) INTO daily_actual, daily_count;
        EXCEPTION 
          WHEN OTHERS THEN
            daily_actual := 0;
            daily_count := 0;
        END;
        
        -- Add to cumulative tracking
        cumulative_sum := cumulative_sum + daily_actual;
        cumulative_count := cumulative_count + daily_count;
        
        -- Calculate true cumulative average
        IF cumulative_count > 0 THEN
          running_actual := cumulative_sum / cumulative_count;
        ELSE
          running_actual := 0;
        END IF;
        
        -- Reset daily_actual to the daily average for storage
        IF daily_count > 0 THEN
          daily_actual := daily_actual / daily_count;
        ELSE
          daily_actual := 0;
        END IF;
        
        -- For average goals: running_goal stays at the flat target
        running_goal := goal_target;
      ELSE
        -- For count/sum metrics: Use traditional running sum
        running_actual := running_actual + daily_actual;
        running_goal := running_goal + daily_goal_value;
      END IF;
      
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
      
      -- Insert goal values ONLY if we have valid goals
      IF daily_goal_value > 0 OR goal_target > 0 THEN
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
        date_record.dt, metric_record.metric_key, metric_record.label, daily_goal_value, running_goal, period_type_param,
        start_date_param, end_date_param, daily_goal_value, running_goal
        );
      ELSE
        RAISE NOTICE 'Skipping goal insertion for % on % - no valid goal values', metric_record.label, date_record.dt;
      END IF;
    END LOOP;
    
    RAISE NOTICE 'Completed metric: % with % actual, % goal running sums (goal target: %, daily_goal: %)', 
      metric_record.label, running_actual, running_goal, goal_target, daily_goal_value;
  END LOOP;
  
  RAISE NOTICE 'Completed ETL for company % period %', company_id_param, period_type_param;
END;
$$;