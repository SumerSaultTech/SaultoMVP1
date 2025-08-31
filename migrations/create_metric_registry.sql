-- Metric Registry System Implementation
-- Creates the core.goals, core.goals_daily, and core.metric_registry tables
-- Based on the provided documentation for proper metric and goal management

-- 0. Create core schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS core;

-- 1. Create core.goals table for storing metric targets
CREATE TABLE IF NOT EXISTS core.goals (
  tenant_id uuid NOT NULL,
  metric_key text NOT NULL,
  granularity text NOT NULL CHECK (granularity IN ('month','quarter','year')),
  period_start date NOT NULL,
  target numeric NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (tenant_id, metric_key, granularity, period_start)
);

-- 2. Create core.goals_daily materialized view for daily goal alignment
-- This expands goals to daily for alignment (step-style goals)
CREATE MATERIALIZED VIEW IF NOT EXISTS core.goals_daily AS
WITH ranges AS (
  SELECT tenant_id, metric_key, granularity, period_start,
         CASE WHEN granularity='month'   THEN (period_start + INTERVAL '1 month')::date
              WHEN granularity='quarter' THEN (period_start + INTERVAL '3 months')::date
              WHEN granularity='year'    THEN (period_start + INTERVAL '1 year')::date END AS period_end,
         target
  FROM core.goals
)
SELECT r.tenant_id, r.metric_key, r.granularity, d::date AS ts_day, r.period_start, r.period_end, r.target
FROM ranges r, LATERAL generate_series(r.period_start, r.period_end - INTERVAL '1 day', INTERVAL '1 day') d;

-- Create index on goals_daily for performance
CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_daily_pk ON core.goals_daily (tenant_id, metric_key, ts_day);

-- 3. Create core.metric_registry table with expressions and safe filters
CREATE TABLE IF NOT EXISTS core.metric_registry (
  metric_key text PRIMARY KEY,
  label text NOT NULL,
  source_fact regclass NOT NULL,     -- e.g., 'core.hubspot_deals'::regclass
  expr_sql text NOT NULL,            -- e.g., 'SUM(f.amount)'
  filters jsonb,                     -- JSON filter tree
  unit text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. Create safe JSON -> SQL filter rendering function
-- This function prevents SQL injection by whitelisting operators
CREATE OR REPLACE FUNCTION core.render_filter(j jsonb)
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
      SELECT string_agg('('||core.render_filter(c)||')', ' '||(j->>'op')||' ') INTO res
      FROM jsonb_array_elements(j->'conditions') c;
      RETURN COALESCE(res, '');
    END IF;
  END IF;
  
  RETURN '';
END; 
$$;

-- 5. Create helper function to build metric SQL with filters
CREATE OR REPLACE FUNCTION core.build_metric_sql(metric_key_param text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  registry_row core.metric_registry%ROWTYPE;
  filter_clause text;
  full_sql text;
BEGIN
  -- Get metric registry entry
  SELECT * INTO registry_row 
  FROM core.metric_registry 
  WHERE metric_key = metric_key_param AND is_active = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Metric key % not found or inactive', metric_key_param;
  END IF;
  
  -- Build filter clause
  filter_clause := core.render_filter(registry_row.filters);
  IF filter_clause != '' THEN
    filter_clause := 'WHERE ' || filter_clause;
  END IF;
  
  -- Build complete SQL
  full_sql := format('SELECT %s FROM %s f %s', 
                     registry_row.expr_sql, 
                     registry_row.source_fact::text, 
                     filter_clause);
  
  RETURN full_sql;
END;
$$;

-- 6. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_goals_tenant_metric ON core.goals (tenant_id, metric_key);
CREATE INDEX IF NOT EXISTS idx_goals_period ON core.goals (period_start, granularity);
CREATE INDEX IF NOT EXISTS idx_metric_registry_active ON core.metric_registry (is_active) WHERE is_active = true;

-- 7. Add comments for documentation
COMMENT ON TABLE core.goals IS 'Stores metric targets at the cadence they are entered (month/quarter/year)';
COMMENT ON TABLE core.metric_registry IS 'Single source of truth for metric definitions with safe SQL expressions';
COMMENT ON MATERIALIZED VIEW core.goals_daily IS 'Daily expansion of goals for alignment with actuals using date spine';
COMMENT ON FUNCTION core.render_filter(jsonb) IS 'Safely renders JSON filter tree to SQL with whitelisted operators';
COMMENT ON FUNCTION core.build_metric_sql(text) IS 'Builds complete metric SQL from registry entry with safe filters';

-- 8. Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON core.goals TO your_app_role;
-- GRANT SELECT ON core.goals_daily TO your_app_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON core.metric_registry TO your_app_role;
-- GRANT EXECUTE ON FUNCTION core.render_filter(jsonb) TO your_app_role;
-- GRANT EXECUTE ON FUNCTION core.build_metric_sql(text) TO your_app_role;