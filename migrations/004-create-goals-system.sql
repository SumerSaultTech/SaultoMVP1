-- Migration: Create Goals System for All Companies
-- Date: 2025-01-03
-- Purpose: Create goals and goals_daily tables in each company's analytics schema

-- Function to create goals system for a company
CREATE OR REPLACE FUNCTION create_company_goals_tables(company_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  schema_name TEXT;
  result TEXT;
BEGIN
  schema_name := 'analytics_company_' || company_id;
  
  -- 1. Create goals table (store at entry cadence)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.goals (
      id SERIAL PRIMARY KEY,
      metric_key TEXT NOT NULL,
      granularity TEXT NOT NULL CHECK (granularity IN (''month'',''quarter'',''year'')),
      period_start DATE NOT NULL,
      target NUMERIC NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(metric_key, granularity, period_start)
    )', schema_name);
  
  -- 2. Create goals_daily materialized view (daily expansion for alignment)
  EXECUTE format('
    CREATE MATERIALIZED VIEW IF NOT EXISTS %I.goals_daily AS
    WITH ranges AS (
      SELECT metric_key, granularity, period_start,
             CASE WHEN granularity=''month'' THEN (period_start + INTERVAL ''1 month'')::date
                  WHEN granularity=''quarter'' THEN (period_start + INTERVAL ''3 months'')::date  
                  WHEN granularity=''year'' THEN (period_start + INTERVAL ''1 year'')::date 
             END AS period_end,
             target
      FROM %I.goals
    )
    SELECT r.metric_key, r.granularity, d.dt AS ts_day, r.period_start, r.period_end, r.target
    FROM ranges r
    CROSS JOIN shared_utils.dim_date d
    WHERE d.dt >= r.period_start AND d.dt < r.period_end
  ', schema_name, schema_name);
  
  -- 3. Create indexes for performance
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.goals (metric_key, period_start)', 
    schema_name || '_goals_metric_period_idx', schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.goals (granularity, period_start)', 
    schema_name || '_goals_granularity_period_idx', schema_name);
  EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON %I.goals_daily (metric_key, ts_day)', 
    schema_name || '_goals_daily_pk', schema_name);
  
  -- 4. Create updated_at trigger for goals table
  EXECUTE format('
    CREATE OR REPLACE FUNCTION %I.update_goals_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  ', schema_name);
  
  EXECUTE format('
    DROP TRIGGER IF EXISTS goals_updated_at ON %I.goals;
    CREATE TRIGGER goals_updated_at
      BEFORE UPDATE ON %I.goals
      FOR EACH ROW EXECUTE FUNCTION %I.update_goals_updated_at();
  ', schema_name, schema_name, schema_name);
  
  -- 5. Add table comments
  EXECUTE format('COMMENT ON TABLE %I.goals IS ''Company-specific metric targets stored at entry cadence (month/quarter/year)''', schema_name);
  EXECUTE format('COMMENT ON MATERIALIZED VIEW %I.goals_daily IS ''Daily expansion of goals for alignment with actuals using date spine''', schema_name);
  
  result := 'Goals system created successfully for company ' || company_id || ' in schema ' || schema_name;
  RAISE NOTICE '%', result;
  RETURN result;
END;
$$;

-- Create goals system for all existing companies
DO $$
DECLARE
  company_record RECORD;
  result TEXT;
BEGIN
  RAISE NOTICE 'Creating goals system for all existing companies...';
  
  FOR company_record IN 
    SELECT id, name, slug 
    FROM companies 
    WHERE is_active = TRUE 
    ORDER BY id
  LOOP
    SELECT create_company_goals_tables(company_record.id) INTO result;
    RAISE NOTICE 'Company: % (ID: %) - %', company_record.name, company_record.id, result;
  END LOOP;
  
  RAISE NOTICE 'Goals system setup complete for all existing companies';
END;
$$;

-- Verify goals system creation
SELECT 
  schemaname as schema_name,
  tablename as table_name,
  'analytics_company_' || SUBSTRING(schemaname FROM 'analytics_company_(.*)') as company_id
FROM pg_tables 
WHERE schemaname LIKE 'analytics_company_%' 
  AND tablename IN ('goals')
ORDER BY schemaname;

SELECT 
  schemaname as schema_name,
  matviewname as view_name,
  'analytics_company_' || SUBSTRING(schemaname FROM 'analytics_company_(.*)') as company_id  
FROM pg_matviews
WHERE schemaname LIKE 'analytics_company_%'
  AND matviewname IN ('goals_daily')
ORDER BY schemaname;

COMMENT ON FUNCTION create_company_goals_tables(BIGINT) IS 'Creates goals and goals_daily tables in company analytics schema for metric target tracking';