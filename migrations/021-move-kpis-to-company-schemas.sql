-- Move KPI definitions from public.kpi_metrics to company-specific schemas
-- This creates true multi-tenancy by isolating KPI definitions per company

-- First, let's create the KPI table structure in each company schema
-- We'll remove the company_id column since it's implicit in the schema

-- Function to create KPI table in a specific schema
CREATE OR REPLACE FUNCTION create_company_kpi_table(schema_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Create kpi_metrics table in the specified schema (without company_id)
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.kpi_metrics (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      value TEXT,
      change_percent TEXT,
      sql_query TEXT,
      yearly_goal TEXT,
      current_progress TEXT,
      goal_progress TEXT,
      goal_type TEXT,
      quarterly_goals JSONB,
      monthly_goals JSONB,
      category TEXT NOT NULL,
      priority INTEGER,
      format TEXT,
      is_increasing BOOLEAN,
      is_north_star BOOLEAN,
      last_calculated_at TIMESTAMP WITHOUT TIME ZONE,
      UNIQUE(name)  -- Ensure unique KPI names per company
    )
  ', schema_name);
  
  RAISE NOTICE 'Created kpi_metrics table in schema %', schema_name;
END;
$$;

-- Function to migrate KPI data for a specific company
CREATE OR REPLACE FUNCTION migrate_company_kpis(target_company_id BIGINT, schema_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  kpi_count INTEGER;
BEGIN
  -- First create the table structure
  PERFORM create_company_kpi_table(schema_name);
  
  -- Copy KPI data from public.kpi_metrics to company schema (excluding company_id)
  EXECUTE format('
    INSERT INTO %I.kpi_metrics (
      name, description, value, change_percent, sql_query, yearly_goal,
      current_progress, goal_progress, goal_type, quarterly_goals, monthly_goals,
      category, priority, format, is_increasing, is_north_star, last_calculated_at
    )
    SELECT 
      name, description, value, change_percent, sql_query, yearly_goal,
      current_progress, goal_progress, goal_type, quarterly_goals, monthly_goals,
      category, priority, format, is_increasing, is_north_star, last_calculated_at
    FROM public.kpi_metrics 
    WHERE company_id = %L
    ON CONFLICT (name) DO UPDATE SET
      description = EXCLUDED.description,
      value = EXCLUDED.value,
      yearly_goal = EXCLUDED.yearly_goal,
      goal_type = EXCLUDED.goal_type
  ', schema_name, target_company_id);
  
  -- Get count of migrated KPIs
  EXECUTE format('SELECT COUNT(*) FROM %I.kpi_metrics', schema_name) INTO kpi_count;
  
  RAISE NOTICE 'Migrated % KPIs for company % to schema %', kpi_count, target_company_id, schema_name;
END;
$$;

-- Migrate KPIs for each company that has data
DO $$
DECLARE
  company_record RECORD;
  schema_name TEXT;
BEGIN
  -- Get all companies that have KPI data
  FOR company_record IN 
    SELECT DISTINCT company_id, COUNT(*) as kpi_count
    FROM public.kpi_metrics 
    GROUP BY company_id
    ORDER BY company_id
  LOOP
    -- Build schema name
    schema_name := 'analytics_company_' || company_record.company_id::text;
    
    -- Check if schema exists
    IF EXISTS (
      SELECT 1 FROM information_schema.schemata s
      WHERE s.schema_name = 'analytics_company_' || company_record.company_id::text
    ) THEN
      -- Migrate KPIs for this company
      PERFORM migrate_company_kpis(company_record.company_id, schema_name);
    ELSE
      RAISE NOTICE 'Schema % does not exist, skipping migration for company %', 
        schema_name, company_record.company_id;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'KPI migration completed!';
END;
$$;

-- Create KPI tables in any additional analytics schemas that exist (for future companies)
DO $$
DECLARE
  schema_record RECORD;
BEGIN
  FOR schema_record IN 
    SELECT s.schema_name 
    FROM information_schema.schemata s
    WHERE s.schema_name LIKE 'analytics_company_%'
      AND s.schema_name NOT IN (
        SELECT 'analytics_company_' || company_id::text 
        FROM public.kpi_metrics
      )
  LOOP
    -- Create empty KPI table structure for schemas without current KPI data
    PERFORM create_company_kpi_table(schema_record.schema_name);
  END LOOP;
END;
$$;

-- Clean up the helper functions (optional - comment out if you want to keep them)
-- DROP FUNCTION IF EXISTS create_company_kpi_table(TEXT);
-- DROP FUNCTION IF EXISTS migrate_company_kpis(BIGINT, TEXT);

-- Note: public.kpi_metrics table is preserved for now for rollback safety
-- After verifying the migration, you can optionally drop or rename it