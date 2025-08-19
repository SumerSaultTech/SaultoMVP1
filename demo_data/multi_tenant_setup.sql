-- Multi-Tenant Demo Data Setup
-- This script creates demo companies and populates their data sources table
-- Run this after the main application tables are created

-- =============================================================================
-- 1. CREATE DEMO COMPANIES
-- =============================================================================

-- Insert demo companies (if they don't exist)
INSERT INTO companies (id, name, slug, created_at, is_active) VALUES
(1001, 'TechCorp Solutions', 'techcorp', NOW(), true),
(1002, 'StartupCo Inc', 'startupco', NOW(), true), 
(1003, 'Enterprise LLC', 'enterprise', NOW(), true),
(1748544793859, 'MIAS_DATA', 'mias_data', NOW(), true)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 2. POPULATE DATA SOURCES TABLE
-- =============================================================================

-- TechCorp Solutions (Company 1001) - Salesforce + HubSpot + QuickBooks
INSERT INTO data_sources (company_id, name, type, status, connector_id, table_count, last_sync_at, sync_tables, last_sync_records, created_at, updated_at) VALUES
(1001, 'TechCorp Salesforce', 'salesforce', 'connected', 'sf_techcorp_001', 3, NOW() - INTERVAL '2 hours', 
 ARRAY['salesforce_opportunity', 'salesforce_contact', 'salesforce_lead'], 125, NOW(), NOW()),
(1001, 'TechCorp HubSpot', 'hubspot', 'connected', 'hs_techcorp_001', 3, NOW() - INTERVAL '1 hour',
 ARRAY['hubspot_deal', 'hubspot_contact', 'hubspot_company'], 195, NOW(), NOW()),
(1001, 'TechCorp QuickBooks', 'quickbooks', 'connected', 'qb_techcorp_001', 3, NOW() - INTERVAL '30 minutes',
 ARRAY['quickbooks_invoice', 'quickbooks_expense', 'quickbooks_customer'], 255, NOW(), NOW());

-- StartupCo Inc (Company 1002) - Salesforce + Jira  
INSERT INTO data_sources (company_id, name, type, status, connector_id, table_count, last_sync_at, sync_tables, last_sync_records, created_at, updated_at) VALUES
(1002, 'StartupCo Salesforce', 'salesforce', 'connected', 'sf_startupco_001', 3, NOW() - INTERVAL '1 hour',
 ARRAY['salesforce_opportunity', 'salesforce_contact', 'salesforce_lead'], 102, NOW(), NOW()),
(1002, 'StartupCo Jira', 'jira', 'connected', 'jira_startupco_001', 3, NOW() - INTERVAL '15 minutes',
 ARRAY['jira_project', 'jira_issue', 'jira_user'], 158, NOW(), NOW());

-- Enterprise LLC (Company 1003) - HubSpot + QuickBooks
INSERT INTO data_sources (company_id, name, type, status, connector_id, table_count, last_sync_at, sync_tables, last_sync_records, created_at, updated_at) VALUES
(1003, 'Enterprise HubSpot', 'hubspot', 'connected', 'hs_enterprise_001', 3, NOW() - INTERVAL '45 minutes',
 ARRAY['hubspot_deal', 'hubspot_contact', 'hubspot_company'], 315, NOW(), NOW()),
(1003, 'Enterprise QuickBooks', 'quickbooks', 'connected', 'qb_enterprise_001', 3, NOW() - INTERVAL '20 minutes',
 ARRAY['quickbooks_invoice', 'quickbooks_expense', 'quickbooks_customer'], 455, NOW(), NOW());

-- MIAS_DATA (Company 1748544793859) - Jira (existing) + Salesforce (demo) + HubSpot (demo)
INSERT INTO data_sources (company_id, name, type, status, connector_id, table_count, last_sync_at, sync_tables, last_sync_records, created_at, updated_at) VALUES
(1748544793859, 'MIAS Jira', 'jira', 'connected', 'jira_mias_001', 5, NOW() - INTERVAL '10 minutes',
 ARRAY['jira_projects', 'jira_users', 'jira_statuses', 'jira_priorities', 'jira_issue_types'], 64, NOW(), NOW()),
(1748544793859, 'MIAS Salesforce', 'salesforce', 'connected', 'sf_mias_001', 3, NOW() - INTERVAL '25 minutes',
 ARRAY['salesforce_opportunity', 'salesforce_contact', 'salesforce_lead'], 80, NOW(), NOW()),
(1748544793859, 'MIAS HubSpot', 'hubspot', 'connected', 'hs_mias_001', 3, NOW() - INTERVAL '35 minutes', 
 ARRAY['hubspot_deal', 'hubspot_contact', 'hubspot_company'], 92, NOW(), NOW())
ON CONFLICT (connector_id) DO NOTHING;

-- =============================================================================
-- 3. CREATE ANALYTICS SCHEMAS
-- =============================================================================

-- Create analytics schemas for each company
CREATE SCHEMA IF NOT EXISTS analytics_company_1001;
CREATE SCHEMA IF NOT EXISTS analytics_company_1002;
CREATE SCHEMA IF NOT EXISTS analytics_company_1003;
-- analytics_company_1748544793859 already exists

-- =============================================================================
-- 4. SETUP SUMMARY
-- =============================================================================

-- Display setup summary
SELECT 
    c.id as company_id,
    c.name as company_name,
    c.slug,
    COUNT(ds.id) as connected_sources,
    STRING_AGG(ds.type, ', ') as source_types,
    SUM(ds.last_sync_records) as total_records
FROM companies c
LEFT JOIN data_sources ds ON c.id = ds.company_id
WHERE c.id IN (1001, 1002, 1003, 1748544793859)
GROUP BY c.id, c.name, c.slug
ORDER BY c.id;