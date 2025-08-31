-- Company-Specific Metric Registry System Implementation
-- Creates goals, goals_daily, and metric_registry tables in each company's analytics schema
-- Each company gets: analytics_company_{id}.goals, analytics_company_{id}.goals_daily, analytics_company_{id}.metric_registry
-- Based on the provided documentation for proper metric and goal management

-- Note: This template will be executed for each company schema
-- Replace {COMPANY_SCHEMA} with the actual company schema name (e.g., analytics_company_1)

-- 1. Create company-specific goals table for storing metric targets
CREATE TABLE IF NOT EXISTS {COMPANY_SCHEMA}.goals (
  id SERIAL PRIMARY KEY,
  metric_key text NOT NULL,
  granularity text NOT NULL CHECK (granularity IN ('month','quarter','year')),
  period_start date NOT NULL,
  target numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(metric_key, granularity, period_start)
);

-- 2. Create company-specific goals_daily materialized view for daily goal alignment
-- This expands goals to daily for alignment (step-style goals)
CREATE MATERIALIZED VIEW IF NOT EXISTS {COMPANY_SCHEMA}.goals_daily AS
WITH ranges AS (
  SELECT metric_key, granularity, period_start,
         CASE WHEN granularity='month'   THEN (period_start + INTERVAL '1 month')::date
              WHEN granularity='quarter' THEN (period_start + INTERVAL '3 months')::date
              WHEN granularity='year'    THEN (period_start + INTERVAL '1 year')::date END AS period_end,
         target
  FROM {COMPANY_SCHEMA}.goals
)
SELECT r.metric_key, r.granularity, d::date AS ts_day, r.period_start, r.period_end, r.target
FROM ranges r, LATERAL generate_series(r.period_start, r.period_end - INTERVAL '1 day', INTERVAL '1 day') d;

-- Create index on goals_daily for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_{COMPANY_ID}_goals_daily_pk ON {COMPANY_SCHEMA}.goals_daily (metric_key, ts_day);

-- 3. Create company-specific metric_registry table with expressions and safe filters
CREATE TABLE IF NOT EXISTS {COMPANY_SCHEMA}.metric_registry (
  metric_key text PRIMARY KEY,
  label text NOT NULL,
  source_fact text NOT NULL,           -- e.g., 'hubspot_deals', 'salesforce_opportunities'
  expr_sql text NOT NULL,              -- e.g., 'SUM(f.amount)'
  filters jsonb,                       -- JSON filter tree
  unit text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Create safe JSON -> SQL filter rendering function (company-specific)
CREATE OR REPLACE FUNCTION {COMPANY_SCHEMA}.render_filter(j jsonb)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE 
  res text; 
BEGIN
  IF j IS NULL THEN RETURN ''; END IF;
  
  IF (j ? 'column') THEN
    -- Handle different operators safely
    IF j->>'op' = 'IN' THEN
      RETURN format('%I IN (%s)', 'f.'||(j->>'column'),
        (SELECT string_agg(quote_literal(x::text), ',') FROM jsonb_array_elements_text(j->'value') x));
    ELSIF j->>'op' = 'IS NOT NULL' THEN
      RETURN format('%I IS NOT NULL', 'f.'||(j->>'column'));
    ELSIF j->>'op' = 'IS NULL' THEN
      RETURN format('%I IS NULL', 'f.'||(j->>'column'));
    ELSIF j->>'op' IN ('=', '!=', '<>', '>', '<', '>=', '<=', 'LIKE', 'ILIKE') THEN
      RETURN format('%I %s %s', 'f.'||(j->>'column'), j->>'op', quote_literal(j->>'value'));
    ELSE
      -- Default safe handling for unknown operators
      RETURN format('%I = %s', 'f.'||(j->>'column'), quote_literal(j->>'value'));
    END IF;
  ELSE
    -- Handle compound conditions (AND/OR)
    IF j->>'op' IN ('AND', 'OR') THEN
      SELECT string_agg('('||{COMPANY_SCHEMA}.render_filter(c)||')', ' '||(j->>'op')||' ') INTO res
      FROM jsonb_array_elements(j->'conditions') c;
      RETURN COALESCE(res, '');
    END IF;
  END IF;
  
  RETURN '';
END; 
$$;

-- 5. Create helper function to build metric SQL with filters (company-specific)
CREATE OR REPLACE FUNCTION {COMPANY_SCHEMA}.build_metric_sql(metric_key_param text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  registry_row {COMPANY_SCHEMA}.metric_registry%ROWTYPE;
  filter_clause text;
  full_sql text;
BEGIN
  -- Get metric registry entry
  SELECT * INTO registry_row 
  FROM {COMPANY_SCHEMA}.metric_registry 
  WHERE metric_key = metric_key_param AND is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Metric key % not found or inactive', metric_key_param;
  END IF;
  
  -- Build filter clause
  filter_clause := {COMPANY_SCHEMA}.render_filter(registry_row.filters);
  IF filter_clause != '' THEN
    filter_clause := 'WHERE ' || filter_clause;
  END IF;
  
  -- Build complete SQL with company schema
  full_sql := format('SELECT %s FROM {COMPANY_SCHEMA}.%s f %s', 
                     registry_row.expr_sql, 
                     registry_row.source_fact, 
                     filter_clause);
  
  RETURN full_sql;
END;
$$;

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_{COMPANY_ID}_goals_metric ON {COMPANY_SCHEMA}.goals (metric_key);
CREATE INDEX IF NOT EXISTS idx_{COMPANY_ID}_goals_period ON {COMPANY_SCHEMA}.goals (period_start, granularity);
CREATE INDEX IF NOT EXISTS idx_{COMPANY_ID}_metric_registry_active ON {COMPANY_SCHEMA}.metric_registry (is_active) WHERE is_active = true;

-- 7. Add comments for documentation
COMMENT ON TABLE {COMPANY_SCHEMA}.goals IS 'Company-specific metric targets at the cadence they are entered (month/quarter/year)';
COMMENT ON TABLE {COMPANY_SCHEMA}.metric_registry IS 'Company-specific single source of truth for metric definitions with safe SQL expressions';
COMMENT ON MATERIALIZED VIEW {COMPANY_SCHEMA}.goals_daily IS 'Company-specific daily expansion of goals for alignment with actuals using date spine';
COMMENT ON FUNCTION {COMPANY_SCHEMA}.render_filter(jsonb) IS 'Company-specific safe rendering of JSON filter tree to SQL with whitelisted operators';
COMMENT ON FUNCTION {COMPANY_SCHEMA}.build_metric_sql(text) IS 'Company-specific function to build complete metric SQL from registry entry with safe filters';