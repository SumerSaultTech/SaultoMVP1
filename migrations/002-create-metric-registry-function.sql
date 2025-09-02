-- Migration: Create Metric Registry Tables Function
-- Date: 2025-01-XX  
-- Purpose: Create metric registry tables in each company analytics schema

-- Function to create metric registry table for a company
CREATE OR REPLACE FUNCTION create_company_metric_registry(company_id BIGINT)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  schema_name TEXT;
  result TEXT;
BEGIN
  -- Generate schema name using company ID
  schema_name := 'analytics_company_' || company_id;
  
  -- Create the metric registry table in the company's analytics schema
  EXECUTE format('
    CREATE TABLE IF NOT EXISTS %I.metric_registry (
      metric_key TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      source_table TEXT NOT NULL,     -- e.g., ''core_jira_issues''
      expr_sql TEXT NOT NULL,         -- e.g., ''SUM(f.amount)''
      filters JSONB,                  -- JSON filter tree from UI
      unit TEXT,                      -- USD, %, count (derived from format)
      date_column TEXT,               -- Column to join with dim_date (e.g. resolved_at)
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      tags TEXT[] DEFAULT ARRAY[]::TEXT[],
      description TEXT
    )', schema_name);
  
  -- Create indexes for performance
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.metric_registry(is_active) WHERE is_active = TRUE', 
    schema_name || '_metric_registry_active_idx', schema_name);
  EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I.metric_registry(source_table)', 
    schema_name || '_metric_registry_source_idx', schema_name);
  
  -- Create updated_at trigger
  EXECUTE format('
    CREATE OR REPLACE FUNCTION %I.update_metric_registry_updated_at()
    RETURNS TRIGGER AS $func$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $func$ LANGUAGE plpgsql;
  ', schema_name);
  
  EXECUTE format('
    DROP TRIGGER IF EXISTS metric_registry_updated_at ON %I.metric_registry;
    CREATE TRIGGER metric_registry_updated_at
      BEFORE UPDATE ON %I.metric_registry
      FOR EACH ROW EXECUTE FUNCTION %I.update_metric_registry_updated_at();
  ', schema_name, schema_name, schema_name);
  
  result := 'Metric registry created successfully for company ' || company_id || ' in schema ' || schema_name;
  RAISE NOTICE '%', result;
  RETURN result;
END;
$$;

-- Safe JSON filter renderer (prevents SQL injection)
CREATE OR REPLACE FUNCTION render_metric_filter(filter_json JSONB)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE 
  result TEXT; 
  condition JSONB;
BEGIN
  IF filter_json IS NULL OR filter_json = 'null'::jsonb THEN 
    RETURN ''; 
  END IF;
  
  -- Handle leaf conditions (column operators)
  IF filter_json ? 'column' THEN
    CASE filter_json->>'op'
      WHEN 'IN' THEN
        SELECT INTO result format('f.%I IN (%s)', 
          filter_json->>'column',
          (SELECT string_agg(quote_literal(x::text), ',') 
           FROM jsonb_array_elements_text(filter_json->'value') x));
      WHEN 'IS NOT NULL' THEN
        result := format('f.%I IS NOT NULL', filter_json->>'column');
      WHEN '=' THEN
        result := format('f.%I = %s', filter_json->>'column', quote_literal(filter_json->>'value'));
      WHEN '>' THEN
        result := format('f.%I > %s', filter_json->>'column', quote_literal(filter_json->>'value'));
      WHEN '<' THEN
        result := format('f.%I < %s', filter_json->>'column', quote_literal(filter_json->>'value'));
      WHEN '>=' THEN
        result := format('f.%I >= %s', filter_json->>'column', quote_literal(filter_json->>'value'));
      WHEN '<=' THEN
        result := format('f.%I <= %s', filter_json->>'column', quote_literal(filter_json->>'value'));
      WHEN '!=' THEN
        result := format('f.%I != %s', filter_json->>'column', quote_literal(filter_json->>'value'));
      WHEN 'LIKE' THEN
        result := format('f.%I LIKE %s', filter_json->>'column', quote_literal(filter_json->>'value'));
      ELSE
        result := format('f.%I %s %s', filter_json->>'column', filter_json->>'op', quote_literal(filter_json->>'value'));
    END CASE;
    RETURN result;
  END IF;
  
  -- Handle logical operators (AND/OR with conditions array)
  IF filter_json ? 'conditions' THEN
    SELECT INTO result 
      string_agg('(' || render_metric_filter(condition) || ')', ' ' || (filter_json->>'op') || ' ')
    FROM jsonb_array_elements(filter_json->'conditions') AS condition
    WHERE render_metric_filter(condition) != '';
    RETURN COALESCE(result, '');
  END IF;
  
  RETURN '';
END;
$$;

COMMENT ON FUNCTION create_company_metric_registry(BIGINT) IS 'Creates metric registry table in company analytics schema with proper isolation';
COMMENT ON FUNCTION render_metric_filter(JSONB) IS 'Safely converts JSON filter tree to SQL WHERE clause with injection prevention';