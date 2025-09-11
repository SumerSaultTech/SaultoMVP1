-- Migration 024: Consolidate kpi_metrics and metric_registry into single metrics table
-- This eliminates redundancy and simplifies the metrics system

-- 1. Create new consolidated metrics table
CREATE TABLE metrics (
  -- Core Identity  
  id SERIAL PRIMARY KEY,
  company_id BIGINT NOT NULL REFERENCES companies(id),
  metric_key TEXT NOT NULL, -- for ETL reference, auto-generated from name
  name TEXT NOT NULL,
  description TEXT,
  
  -- Calculation Logic (from metric_registry)
  source_table TEXT NOT NULL, -- e.g., "analytics_company_123.core_jira_issues"
  expr_sql TEXT NOT NULL, -- SQL expression for calculation
  filters JSONB, -- JSON filter tree
  date_column TEXT NOT NULL DEFAULT 'created_at', -- date column for time-based queries
  
  -- Display & Goals (from kpi_metrics)
  category TEXT NOT NULL DEFAULT 'revenue', -- revenue, growth, retention, efficiency
  format TEXT DEFAULT 'currency', -- currency, percentage, number
  unit TEXT DEFAULT 'count', -- measurement unit
  yearly_goal TEXT,
  quarterly_goals JSONB, -- {Q1: value, Q2: value, Q3: value, Q4: value}
  monthly_goals JSONB, -- {Jan: value, Feb: value, ...}
  goal_type TEXT DEFAULT 'yearly', -- yearly, quarterly, monthly
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
  
  -- Composite unique constraint: metric_key is unique per company
  UNIQUE(company_id, metric_key)
);

-- 2. Migrate data from kpi_metrics table
INSERT INTO metrics (
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
  LOWER(REGEXP_REPLACE(REGEXP_REPLACE(name, '[^a-zA-Z0-9\s]', '', 'g'), '\s+', '_', 'g')) as metric_key,
  name,
  description,
  -- Use table field if available, otherwise build from mainDataSource
  COALESCE("table", 
    CASE 
      WHEN main_data_source = 'jira' THEN 'analytics_company_' || company_id || '.core_jira_issues'
      WHEN main_data_source = 'salesforce' THEN 'analytics_company_' || company_id || '.core_salesforce_opportunities'
      WHEN main_data_source = 'hubspot' THEN 'analytics_company_' || company_id || '.core_hubspot_deals'
      ELSE 'analytics_company_' || company_id || '.core_data'
    END
  ) as source_table,
  -- Build expr_sql from existing fields
  CASE 
    WHEN use_calculated_field = true AND calculation_type = 'time_difference' THEN
      CASE 
        WHEN aggregation_type = 'AVG' THEN 'AVG(EXTRACT(DAY FROM (' || COALESCE(date_to_column, 'CURRENT_DATE') || ' - ' || date_from_column || ')))'
        ELSE 'SUM(EXTRACT(DAY FROM (' || COALESCE(date_to_column, 'CURRENT_DATE') || ' - ' || date_from_column || ')))'
      END
    WHEN use_calculated_field = true AND calculation_type = 'conditional_count' THEN
      'COUNT(CASE WHEN ' || conditional_field || ' ' || conditional_operator || ' ' || 
      CASE WHEN conditional_operator NOT IN ('IS NULL', 'IS NOT NULL') THEN '''' || conditional_value || '''' ELSE conditional_value END || ' THEN 1 END)'
    WHEN aggregation_type = 'COUNT' THEN 'COUNT(*)'
    WHEN value_column IS NOT NULL THEN COALESCE(aggregation_type, 'SUM') || '(' || value_column || ')'
    ELSE 'COUNT(*)'
  END as expr_sql,
  filter_config as filters,
  COALESCE(date_column, 'created_at') as date_column,
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
  true as is_active, -- assume all existing metrics are active
  last_calculated_at,
  NOW() as created_at
FROM kpi_metrics;

-- 3. Migrate any standalone metric_registry entries that don't have kpi_metrics counterparts
-- (This handles cases where metric_registry has entries not in kpi_metrics)
INSERT INTO metrics (
  company_id, metric_key, name, description, source_table, expr_sql, filters, date_column,
  category, format, unit, is_active, created_at
)
SELECT 
  1 as company_id, -- Default to company 1, adjust as needed
  metric_key,
  label as name,
  label as description, -- Use label as description if no separate description
  source_fact as source_table,
  expr_sql,
  filters,
  'created_at' as date_column,
  'revenue' as category, -- Default category
  'number' as format, -- Default format
  unit,
  is_active,
  created_at
FROM metric_registry mr
WHERE NOT EXISTS (
  SELECT 1 FROM metrics m 
  WHERE m.metric_key = mr.metric_key
);

-- 4. Update metric_history table to reference new metrics table
-- First create a mapping from old kpi_metrics.id to new metrics.id
CREATE TEMP TABLE metric_id_mapping AS 
SELECT 
  km.id as old_metric_id,
  m.id as new_metric_id
FROM kpi_metrics km
JOIN metrics m ON m.company_id = km.company_id AND m.name = km.name;

-- Update metric_history to point to new metrics table
UPDATE metric_history mh
SET metric_id = mim.new_metric_id
FROM metric_id_mapping mim
WHERE mh.metric_id = mim.old_metric_id;

-- 5. Create indexes for performance
CREATE INDEX idx_metrics_company_id ON metrics(company_id);
CREATE INDEX idx_metrics_metric_key ON metrics(metric_key);
CREATE INDEX idx_metrics_category ON metrics(category);
CREATE INDEX idx_metrics_is_active ON metrics(is_active);
CREATE INDEX idx_metrics_is_north_star ON metrics(is_north_star);

-- 6. Update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_metrics_updated_at 
    BEFORE UPDATE ON metrics 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 7. Drop old tables (commented out for safety - run manually after verification)
-- DROP TABLE kpi_metrics;
-- DROP TABLE metric_registry;

-- 8. Success message
SELECT 'Migration 024 completed successfully - metrics tables consolidated' as status;