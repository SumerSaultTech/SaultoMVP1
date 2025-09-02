-- Migration: Setup Metric Registry for Existing Companies  
-- Date: 2025-01-XX
-- Purpose: Create metric registry tables for all existing companies

-- Create metric registry for all existing companies
DO $$
DECLARE
  company_record RECORD;
  result TEXT;
BEGIN
  -- Loop through all active companies
  FOR company_record IN 
    SELECT id, name, slug 
    FROM companies 
    WHERE is_active = TRUE 
    ORDER BY id
  LOOP
    -- Create metric registry table for each company
    SELECT create_company_metric_registry(company_record.id) INTO result;
    RAISE NOTICE 'Company: % (%) - %', company_record.name, company_record.id, result;
  END LOOP;
  
  RAISE NOTICE 'Metric registry setup complete for all existing companies';
END;
$$;

-- Verify setup by checking schema count
SELECT 
  COUNT(*) as total_companies,
  COUNT(*) FILTER (WHERE schema_name LIKE 'analytics_company_%') as companies_with_analytics
FROM (
  SELECT c.id, c.name, 
         'analytics_company_' || c.id as expected_schema,
         s.schema_name
  FROM companies c
  LEFT JOIN information_schema.schemata s 
    ON s.schema_name = 'analytics_company_' || c.id
  WHERE c.is_active = TRUE
) company_schemas;

-- Show metric registry tables created
SELECT 
  schemaname as schema_name,
  tablename as table_name,
  'analytics_company_' || SUBSTRING(schemaname FROM 'analytics_company_(.*)') as company_id
FROM pg_tables 
WHERE schemaname LIKE 'analytics_company_%' 
  AND tablename = 'metric_registry'
ORDER BY schemaname;