-- Migration 024-fix: Create company-specific metrics tables in analytics schemas
-- Each company should have their own metrics table in their analytics schema

-- First, let's drop the incorrectly placed global metrics table
DROP TABLE IF EXISTS metrics CASCADE;

-- Function to create metrics table in company analytics schema
CREATE OR REPLACE FUNCTION create_company_metrics_table(company_schema_name TEXT)
RETURNS void AS $$
BEGIN
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.metrics (
      -- Core Identity  
      id SERIAL PRIMARY KEY,
      company_id BIGINT NOT NULL,
      metric_key TEXT NOT NULL, -- for ETL reference, auto-generated from name
      name TEXT NOT NULL,
      description TEXT,
      
      -- Calculation Logic
      source_table TEXT NOT NULL, -- e.g., "core_jira_issues"
      expr_sql TEXT NOT NULL, -- SQL expression for calculation
      filters JSONB, -- JSON filter tree
      date_column TEXT NOT NULL DEFAULT ''created_at'', -- date column for time-based queries
      
      -- Display & Goals
      category TEXT NOT NULL DEFAULT ''revenue'', -- revenue, growth, retention, efficiency
      format TEXT DEFAULT ''currency'', -- currency, percentage, number
      unit TEXT DEFAULT ''count'', -- measurement unit
      yearly_goal TEXT,
      quarterly_goals JSONB, -- {Q1: value, Q2: value, Q3: value, Q4: value}
      monthly_goals JSONB, -- {Jan: value, Feb: value, ...}
      goal_type TEXT DEFAULT ''yearly'', -- yearly, quarterly, monthly
      is_increasing BOOLEAN DEFAULT true, -- whether higher values are better
      is_north_star BOOLEAN DEFAULT false, -- whether this is a North Star metric
      
      -- Calculated Fields Configuration
      use_calculated_field BOOLEAN DEFAULT false,
      calculation_type TEXT, -- time_difference, conditional_count, conditional_sum
      date_from_column TEXT,
      date_to_column TEXT,
      time_unit TEXT, -- days, hours, weeks
      conditional_field TEXT,
      conditional_operator TEXT,
      conditional_value TEXT,
      convert_to_number BOOLEAN DEFAULT false,
      handle_nulls BOOLEAN DEFAULT true,
      
      -- Metadata
      tags JSONB, -- array of tags
      priority INTEGER DEFAULT 1, -- 1-12 for ordering
      is_active BOOLEAN DEFAULT true,
      last_calculated_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      
      -- Unique constraint: metric_key is unique per company analytics schema
      UNIQUE(metric_key)
    )', company_schema_name);
    
  -- Create indexes for performance
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_metrics_company_id ON %I.metrics(company_id)', 
    replace(company_schema_name, 'analytics_company_', ''), company_schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_metrics_metric_key ON %I.metrics(metric_key)', 
    replace(company_schema_name, 'analytics_company_', ''), company_schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_metrics_category ON %I.metrics(category)', 
    replace(company_schema_name, 'analytics_company_', ''), company_schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_metrics_is_active ON %I.metrics(is_active)', 
    replace(company_schema_name, 'analytics_company_', ''), company_schema_name);
    
END;
$$ LANGUAGE plpgsql;

-- Get all company analytics schemas and create metrics tables
DO $$
DECLARE
    company_rec RECORD;
    company_schema_name TEXT;
BEGIN
    FOR company_rec IN 
        SELECT id 
        FROM companies 
        WHERE is_active = true
    LOOP
        -- Build analytics schema name from company ID
        company_schema_name := 'analytics_company_' || company_rec.id;
        -- Create metrics table in company analytics schema
        PERFORM create_company_metrics_table(company_schema_name);
        
        -- Migrate data from kpi_metrics for this company
        EXECUTE format('
          INSERT INTO %I.metrics (
            company_id, metric_key, name, description, source_table, expr_sql, filters, date_column,
            category, format, unit, yearly_goal, quarterly_goals, monthly_goals, goal_type,
            is_increasing, is_north_star, use_calculated_field, calculation_type,
            date_from_column, date_to_column, time_unit, conditional_field, 
            conditional_operator, conditional_value, convert_to_number, handle_nulls,
            tags, priority, is_active, last_calculated_at, created_at
          )
          SELECT 
            company_id,
            -- Generate metric_key from name
            LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, ''[^a-zA-Z0-9\s]'', '''', ''g''), ''\s+'', ''_'', ''g'')) as metric_key,
            name,
            description,
            -- Use table field if available, otherwise build from mainDataSource
            COALESCE("table", 
              CASE 
                WHEN main_data_source = ''jira'' THEN ''core_jira_issues''
                WHEN main_data_source = ''salesforce'' THEN ''core_salesforce_opportunities''
                WHEN main_data_source = ''hubspot'' THEN ''core_hubspot_deals''
                ELSE ''core_data''
              END
            ) as source_table,
            -- Build expr_sql from existing fields
            CASE 
              WHEN use_calculated_field = true AND calculation_type = ''time_difference'' THEN
                CASE 
                  WHEN aggregation_type = ''AVG'' THEN ''AVG(EXTRACT(DAY FROM ('' || COALESCE(date_to_column, ''CURRENT_DATE'') || '' - '' || date_from_column || '')))''
                  ELSE ''SUM(EXTRACT(DAY FROM ('' || COALESCE(date_to_column, ''CURRENT_DATE'') || '' - '' || date_from_column || '')))''
                END
              WHEN use_calculated_field = true AND calculation_type = ''conditional_count'' THEN
                ''COUNT(CASE WHEN '' || conditional_field || '' '' || conditional_operator || '' '' || 
                CASE WHEN conditional_operator NOT IN (''IS NULL'', ''IS NOT NULL'') THEN '''''' || conditional_value || '''''' ELSE conditional_value END || '' THEN 1 END)''
              WHEN aggregation_type = ''COUNT'' THEN ''COUNT(*)''
              WHEN value_column IS NOT NULL THEN COALESCE(aggregation_type, ''SUM'') || ''('' || value_column || '')''
              ELSE ''COUNT(*)''
            END as expr_sql,
            filter_config as filters,
            COALESCE(date_column, ''created_at'') as date_column,
            category,
            format,
            unit,
            yearly_goal,
            quarterly_goals,
            monthly_goals,
            goal_type,
            is_increasing,
            is_north_star,
            use_calculated_field,
            calculation_type,
            date_from_column,
            date_to_column,
            time_unit,
            conditional_field,
            conditional_operator,
            conditional_value,
            convert_to_number,
            handle_nulls,
            tags,
            priority,
            true as is_active,
            last_calculated_at,
            NOW() as created_at
          FROM kpi_metrics 
          WHERE company_id = %s
        ', company_schema_name, company_rec.id);
        
        RAISE NOTICE 'Created metrics table and migrated data for company % (schema: %)', 
          company_rec.id, company_schema_name;
    END LOOP;
END $$;

-- Drop the function as it's no longer needed
DROP FUNCTION create_company_metrics_table(TEXT);

-- Success message
SELECT 'Migration 024-fix completed - metrics tables created in company-specific analytics schemas' as status;