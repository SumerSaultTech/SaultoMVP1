-- Migration: Create Company Metrics Series Function
-- Date: 2025-01-03
-- Purpose: Single query function for multiple metrics with time-series bucketing using dim_date

-- Company metrics series query function (single query, multiple metrics, goals support)
CREATE OR REPLACE FUNCTION get_company_metrics_series(
  company_id BIGINT,
  start_date DATE,
  end_date DATE,
  granularity TEXT, -- 'day'|'week'|'month'|'quarter'|'year'
  metric_keys TEXT[] DEFAULT NULL,
  include_goals BOOLEAN DEFAULT FALSE
) RETURNS TABLE(
  ts DATE,
  series TEXT,
  value NUMERIC
) LANGUAGE plpgsql AS $$
DECLARE
  schema_name TEXT;
  metric_record RECORD;
  union_parts TEXT[] := ARRAY[]::TEXT[];
  spine_sql TEXT;
  final_sql TEXT;
BEGIN
  schema_name := 'analytics_company_' || company_id;
  
  -- Build time spine SQL based on granularity
  spine_sql := format('
    WITH spine AS (
      SELECT CASE %L
        WHEN ''day'' THEN d.dt
        WHEN ''week'' THEN d.week_start
        WHEN ''month'' THEN d.month_start
        WHEN ''quarter'' THEN d.quarter_start
        WHEN ''year'' THEN d.year_start
      END AS ts
      FROM shared_utils.dim_date d
      WHERE d.dt >= %L AND d.dt <= %L
      GROUP BY 1
    ),
    metrics AS (',
    granularity, start_date, end_date);
  
  -- Get active metrics from registry
  FOR metric_record IN 
    EXECUTE format('
      SELECT metric_key, label, source_table, expr_sql, date_column, filters
      FROM %I.metric_registry 
      WHERE is_active = TRUE 
        AND (%L IS NULL OR metric_key = ANY(%L))
      ORDER BY metric_key
    ', schema_name, metric_keys, metric_keys)
  LOOP
    -- Build metric CTE with proper date bucketing and filtering
    DECLARE
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
      
      -- Add this metric's CTE to union parts
      union_parts := array_append(union_parts, format('
        SELECT 
          CASE %L
            WHEN ''day'' THEN d.dt
            WHEN ''week'' THEN d.week_start
            WHEN ''month'' THEN d.month_start
            WHEN ''quarter'' THEN d.quarter_start
            WHEN ''year'' THEN d.year_start
          END AS ts,
          %L AS series,
          %s AS value
        FROM %I.%I f
        JOIN shared_utils.dim_date d ON d.dt = f.%I::date
        WHERE f.%I >= %L AND f.%I <= %L
          %s
        GROUP BY 1, 2
      ', 
        granularity,
        metric_record.label,
        metric_record.expr_sql,
        schema_name, metric_record.source_table,
        date_col,
        date_col, start_date,
        date_col, end_date,
        filter_clause
      ));
    END;
  END LOOP;
  
  -- Add goals if requested and goals exist
  IF include_goals THEN
    BEGIN
      -- Check if goals_daily view exists and has data
      EXECUTE format('SELECT 1 FROM %I.goals_daily LIMIT 1', schema_name);
      
      union_parts := array_append(union_parts, format('
        SELECT 
          CASE %L
            WHEN ''day'' THEN g.ts_day
            WHEN ''week'' THEN date_trunc(''week'', g.ts_day)::date
            WHEN ''month'' THEN date_trunc(''month'', g.ts_day)::date
            WHEN ''quarter'' THEN date_trunc(''quarter'', g.ts_day)::date
            WHEN ''year'' THEN date_trunc(''year'', g.ts_day)::date
          END AS ts,
          ''Goal: '' || g.metric_key AS series,
          g.target AS value
        FROM %I.goals_daily g
        WHERE g.ts_day >= %L AND g.ts_day <= %L
          AND (%L IS NULL OR g.metric_key = ANY(%L))
        GROUP BY 1, 2, 3
      ', granularity, schema_name, start_date, end_date, metric_keys, metric_keys));
    EXCEPTION
      WHEN OTHERS THEN
        -- Goals table doesn't exist or has no data, skip goals
        NULL;
    END;
  END IF;
  
  -- If no metrics found, return empty result
  IF array_length(union_parts, 1) IS NULL OR array_length(union_parts, 1) = 0 THEN
    RETURN;
  END IF;
  
  -- Build complete query with spine and metrics union
  final_sql := spine_sql || array_to_string(union_parts, ' UNION ALL ') || '
    )
    SELECT s.ts, m.series, COALESCE(m.value, 0) AS value
    FROM spine s
    LEFT JOIN metrics m USING (ts)
    WHERE m.series IS NOT NULL
    ORDER BY s.ts, m.series';
  
  -- Execute and return results
  RETURN QUERY EXECUTE final_sql;
END;
$$;

-- Create a simpler function for testing with static data
CREATE OR REPLACE FUNCTION get_company_metrics_series_test(
  company_id BIGINT,
  start_date DATE,
  end_date DATE,
  granularity TEXT DEFAULT 'month'
) RETURNS TABLE(
  ts DATE,
  series TEXT,
  value NUMERIC
) LANGUAGE plpgsql AS $$
BEGIN
  -- Return test data for validation
  RETURN QUERY
  WITH spine AS (
    SELECT CASE granularity
      WHEN 'day' THEN d.dt
      WHEN 'week' THEN d.week_start
      WHEN 'month' THEN d.month_start
      WHEN 'quarter' THEN d.quarter_start
      WHEN 'year' THEN d.year_start
    END AS ts
    FROM shared_utils.dim_date d
    WHERE d.dt >= start_date AND d.dt <= end_date
    GROUP BY 1
  ),
  test_metrics AS (
    SELECT ts, 'Test Revenue' as series, (random() * 10000 + 5000)::numeric as value FROM spine
    UNION ALL
    SELECT ts, 'Test Profit' as series, (random() * 5000 + 2000)::numeric as value FROM spine
  )
  SELECT s.ts, tm.series, tm.value
  FROM spine s
  JOIN test_metrics tm USING (ts)
  ORDER BY s.ts, tm.series;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION get_company_metrics_series(BIGINT, DATE, DATE, TEXT, TEXT[], BOOLEAN) IS 'Single query function for multiple company metrics with time-series bucketing and optional goals';
COMMENT ON FUNCTION get_company_metrics_series_test(BIGINT, DATE, DATE, TEXT) IS 'Test function for metrics series with sample data for validation';

-- Grant permissions
-- GRANT EXECUTE ON FUNCTION get_company_metrics_series(BIGINT, DATE, DATE, TEXT, TEXT[], BOOLEAN) TO your_app_role;
-- GRANT EXECUTE ON FUNCTION get_company_metrics_series_test(BIGINT, DATE, DATE, TEXT) TO your_app_role;