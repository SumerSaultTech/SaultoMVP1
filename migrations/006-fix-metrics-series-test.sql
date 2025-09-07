-- Migration: Fix ambiguous column reference in metrics series test function
-- Date: 2025-01-03
-- Purpose: Fix "column reference ts is ambiguous" error in test function

-- Fix the test function to resolve column ambiguity
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
    SELECT s.ts, 'Test Revenue' as series, (random() * 10000 + 5000)::numeric as value FROM spine s
    UNION ALL
    SELECT s.ts, 'Test Profit' as series, (random() * 5000 + 2000)::numeric as value FROM spine s
  )
  SELECT s.ts, tm.series, tm.value
  FROM spine s
  JOIN test_metrics tm ON s.ts = tm.ts
  ORDER BY s.ts, tm.series;
END;
$$;

COMMENT ON FUNCTION get_company_metrics_series_test(BIGINT, DATE, DATE, TEXT) IS 'Test function for metrics series with sample data - fixed column ambiguity';