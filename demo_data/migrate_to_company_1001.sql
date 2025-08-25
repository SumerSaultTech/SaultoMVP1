-- Migration Script: Copy demo data from company 1748544793859 to company 1001
-- This ensures the pipeline has raw data to work with

-- Create schema for company 1001 if it doesn't exist
CREATE SCHEMA IF NOT EXISTS analytics_company_1001;

-- Copy Salesforce Opportunity data
DROP TABLE IF EXISTS analytics_company_1001.salesforce_opportunity CASCADE;
CREATE TABLE analytics_company_1001.salesforce_opportunity AS
SELECT 
  id,
  name,
  amount,
  stagename,
  closedate,
  probability,
  accountid,
  ownerid,
  type,
  leadsource,
  created_date,
  last_modified_date,
  loaded_at,
  source_system,
  1001 as company_id  -- Update to company 1001
FROM analytics_company_1748544793859.salesforce_opportunity;

-- Copy Salesforce Contact data  
DROP TABLE IF EXISTS analytics_company_1001.salesforce_contact CASCADE;
CREATE TABLE analytics_company_1001.salesforce_contact AS
SELECT 
  id,
  firstname,
  lastname,
  email,
  phone,
  title,
  accountid,
  department,
  leadsource,
  created_date,
  last_modified_date,
  last_activity_date,
  loaded_at,
  source_system,
  1001 as company_id  -- Update to company 1001
FROM analytics_company_1748544793859.salesforce_contact;

-- Copy Salesforce Lead data
DROP TABLE IF EXISTS analytics_company_1001.salesforce_lead CASCADE;
CREATE TABLE analytics_company_1001.salesforce_lead AS
SELECT 
  id,
  firstname,
  lastname,
  email,
  phone,
  title,
  company,
  industry,
  status,
  rating,
  leadsource,
  created_date,
  last_modified_date,
  converted_date,
  loaded_at,
  source_system,
  1001 as company_id  -- Update to company 1001
FROM analytics_company_1748544793859.salesforce_lead;

-- Copy HubSpot Deal data
DROP TABLE IF EXISTS analytics_company_1001.hubspot_deal CASCADE;
CREATE TABLE analytics_company_1001.hubspot_deal AS
SELECT 
  id,
  dealname,
  amount,
  dealstage,
  closedate,
  probability,
  pipeline,
  dealtype,
  leadsource,
  created_date,
  last_modified_date,
  loaded_at,
  source_system,
  1001 as company_id  -- Update to company 1001
FROM analytics_company_1748544793859.hubspot_deal;

-- Copy HubSpot Contact data
DROP TABLE IF EXISTS analytics_company_1001.hubspot_contact CASCADE;
CREATE TABLE analytics_company_1001.hubspot_contact AS
SELECT 
  id,
  firstname,
  lastname,
  email,
  phone,
  jobtitle,
  company,
  industry,
  lifecycle_stage,
  lead_status,
  original_source,
  created_date,
  last_modified_date,
  last_activity_date,
  email_opens,
  email_clicks,
  form_submissions,
  loaded_at,
  source_system,
  1001 as company_id  -- Update to company 1001
FROM analytics_company_1748544793859.hubspot_contact;

-- Copy HubSpot Company data
DROP TABLE IF EXISTS analytics_company_1001.hubspot_company CASCADE;
CREATE TABLE analytics_company_1001.hubspot_company AS
SELECT 
  id,
  name,
  domain,
  industry,
  employees,
  annual_revenue,
  city,
  state,
  country,
  lifecycle_stage,
  lead_status,
  created_date,
  last_modified_date,
  last_activity_date,
  loaded_at,
  source_system,
  1001 as company_id  -- Update to company 1001
FROM analytics_company_1748544793859.hubspot_company;

-- Update application tables to ensure company 1001 exists
INSERT INTO public.companies (id, name, slug, created_at, is_active)
VALUES (1001, 'Demo Company 1001', 'demo_1001', NOW(), true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  is_active = true;

-- Update data sources for company 1001
INSERT INTO public.data_sources (company_id, name, type, status, connector_id, sync_frequency, last_sync, sync_config)
VALUES 
(1001, 'Demo Salesforce', 'salesforce', 'connected', 'sf_demo_1001', 3, NOW() - INTERVAL '30 minutes', '{"demo": true}'),
(1001, 'Demo HubSpot', 'hubspot', 'connected', 'hs_demo_1001', 3, NOW() - INTERVAL '45 minutes', '{"demo": true}')
ON CONFLICT (company_id, type) DO UPDATE SET
  status = EXCLUDED.status,
  last_sync = EXCLUDED.last_sync;

COMMIT;