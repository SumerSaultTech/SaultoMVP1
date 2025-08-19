-- Demo Data for Company 1748544793859: MIAS_DATA
-- Data Sources: Jira (existing) + Salesforce (demo) + HubSpot (demo)  
-- Focus: Mixed operational + sales analytics

-- =============================================================================
-- SALESFORCE DATA (Demo Sales Data)
-- =============================================================================

-- Salesforce Opportunities 
CREATE TABLE IF NOT EXISTS analytics_company_1748544793859.salesforce_opportunity (
    id TEXT PRIMARY KEY,
    name TEXT,
    amount NUMERIC,
    stagename TEXT,
    closedate DATE,
    probability NUMERIC,
    accountid TEXT,
    ownerid TEXT,
    type TEXT,
    leadsource TEXT,
    created_date TIMESTAMP,
    last_modified_date TIMESTAMP,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_system TEXT DEFAULT 'salesforce',
    company_id BIGINT DEFAULT 1748544793859
);

INSERT INTO analytics_company_1748544793859.salesforce_opportunity (id, name, amount, stagename, closedate, probability, accountid, ownerid, type, leadsource, created_date, last_modified_date) VALUES
-- Recent Closed Won Deals
('006MD001', 'MIAS Enterprise Platform', 185000, 'Closed Won', '2024-12-15', 100, 'ACC_MD001', 'USR_MD001', 'New Business', 'Website', '2024-10-01', '2024-12-15'),
('006MD002', 'Data Analytics Package', 125000, 'Closed Won', '2025-01-28', 100, 'ACC_MD002', 'USR_MD002', 'New Business', 'Referral', '2024-11-15', '2025-01-28'),
('006MD003', 'Custom Integration Project', 95000, 'Closed Won', '2025-02-14', 100, 'ACC_MD003', 'USR_MD001', 'New Business', 'Trade Show', '2024-12-01', '2025-02-14'),

-- Current Pipeline
('006MD004', 'Global Expansion Deal', 275000, 'Negotiation/Review', '2025-09-30', 75, 'ACC_MD004', 'USR_MD001', 'New Business', 'Partner Referral', '2025-06-01', '2025-08-15'),
('006MD005', 'Multi-Year Subscription', 165000, 'Proposal/Price Quote', '2025-10-15', 60, 'ACC_MD005', 'USR_MD002', 'New Business', 'Cold Call', '2025-07-01', '2025-08-16'),
('006MD006', 'Advanced Features Upsell', 78000, 'Value Proposition', '2025-11-01', 45, 'ACC_MD006', 'USR_MD001', 'Upsell', 'Customer Success', '2025-07-15', '2025-08-17');

-- Salesforce Contacts
CREATE TABLE IF NOT EXISTS analytics_company_1748544793859.salesforce_contact (
    id TEXT PRIMARY KEY,
    firstname TEXT,
    lastname TEXT,
    email TEXT,
    phone TEXT,
    title TEXT,
    accountid TEXT,
    department TEXT,
    leadsource TEXT,
    created_date TIMESTAMP,
    last_modified_date TIMESTAMP,
    last_activity_date DATE,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_system TEXT DEFAULT 'salesforce',
    company_id BIGINT DEFAULT 1748544793859
);

INSERT INTO analytics_company_1748544793859.salesforce_contact (id, firstname, lastname, email, phone, title, accountid, department, leadsource, created_date, last_modified_date, last_activity_date) VALUES
('003MD001', 'Patricia', 'Johnson', 'pjohnson@enterprise-platform.com', '555-3001', 'VP Technology', 'ACC_MD001', 'Technology', 'Website', '2024-09-15', '2025-08-15', '2025-08-12'),
('003MD002', 'Michael', 'Chen', 'mchen@data-analytics.co', '555-3002', 'Chief Data Officer', 'ACC_MD002', 'Analytics', 'Referral', '2024-10-20', '2025-08-16', '2025-08-14'),
('003MD003', 'Lisa', 'Rodriguez', 'lrodriguez@custom-integration.net', '555-3003', 'Integration Manager', 'ACC_MD003', 'IT', 'Trade Show', '2024-11-25', '2025-08-17', '2025-08-15'),
('003MD004', 'David', 'Park', 'dpark@global-expansion.io', '555-3004', 'Director of Operations', 'ACC_MD004', 'Operations', 'Partner Referral', '2025-05-20', '2025-08-18', '2025-08-16'),
('003MD005', 'Jennifer', 'Williams', 'jwilliams@multi-year.com', '555-3005', 'Procurement Manager', 'ACC_MD005', 'Procurement', 'Cold Call', '2025-06-25', '2025-08-18', '2025-08-17');

-- Salesforce Leads
CREATE TABLE IF NOT EXISTS analytics_company_1748544793859.salesforce_lead (
    id TEXT PRIMARY KEY,
    firstname TEXT,
    lastname TEXT,
    email TEXT,
    phone TEXT,
    title TEXT,
    company TEXT,
    industry TEXT,
    status TEXT,
    rating TEXT,
    leadsource TEXT,
    created_date TIMESTAMP,
    last_modified_date TIMESTAMP,
    converted_date TIMESTAMP,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_system TEXT DEFAULT 'salesforce',
    company_id BIGINT DEFAULT 1748544793859
);

INSERT INTO analytics_company_1748544793859.salesforce_lead (id, firstname, lastname, email, phone, title, company, industry, status, rating, leadsource, created_date, last_modified_date, converted_date) VALUES
('00QMD001', 'Robert', 'Taylor', 'rtaylor@tech-solutions.io', '555-3101', 'CTO', 'Tech Solutions Inc', 'Technology', 'Working', 'Hot', 'Inbound', '2025-08-01', '2025-08-16', NULL),
('00QMD002', 'Amanda', 'Brown', 'abrown@manufacturing-tech.com', '555-3102', 'IT Director', 'Manufacturing Tech Co', 'Manufacturing', 'Qualified', 'Warm', 'Website', '2025-08-05', '2025-08-17', NULL),
('00QMD003', 'James', 'Wilson', 'jwilson@financial-data.org', '555-3103', 'Head of Analytics', 'Financial Data Corp', 'Financial Services', 'Nurturing', 'Warm', 'Social Media', '2025-08-08', '2025-08-18', NULL);

-- =============================================================================
-- HUBSPOT DATA (Marketing Intelligence)
-- =============================================================================

-- HubSpot Deals 
CREATE TABLE IF NOT EXISTS analytics_company_1748544793859.hubspot_deal (
    id TEXT PRIMARY KEY,
    dealname TEXT,
    amount NUMERIC,
    dealstage TEXT,
    closedate DATE,
    probability NUMERIC,
    pipeline TEXT,
    dealtype TEXT,
    leadsource TEXT,
    created_date TIMESTAMP,
    last_modified_date TIMESTAMP,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_system TEXT DEFAULT 'hubspot',
    company_id BIGINT DEFAULT 1748544793859
);

INSERT INTO analytics_company_1748544793859.hubspot_deal (id, dealname, amount, dealstage, closedate, probability, pipeline, dealtype, leadsource, created_date, last_modified_date) VALUES
-- Marketing Generated Deals (Closed Won)
('HSMD001', 'Content Marketing Success', 75000, 'closedwon', '2024-12-22', 100, 'sales', 'newbusiness', 'Blog Content', '2024-10-10', '2024-12-22'),
('HSMD002', 'Email Campaign Conversion', 45000, 'closedwon', '2025-01-18', 100, 'sales', 'newbusiness', 'Email Marketing', '2024-11-20', '2025-01-18'),
('HSMD003', 'Webinar Lead Conversion', 65000, 'closedwon', '2025-02-25', 100, 'sales', 'newbusiness', 'Webinar', '2024-12-15', '2025-02-25'),

-- Current Marketing Pipeline
('HSMD004', 'SEO Organic Opportunity', 125000, 'qualified', '2025-10-10', 70, 'sales', 'newbusiness', 'Organic Search', '2025-06-10', '2025-08-16'),
('HSMD005', 'Social Media Generated', 85000, 'presentation', '2025-09-20', 50, 'sales', 'newbusiness', 'Social Media', '2025-07-01', '2025-08-17'),
('HSMD006', 'PPC Campaign Lead', 110000, 'negotiation', '2025-09-30', 65, 'sales', 'newbusiness', 'Paid Search', '2025-07-15', '2025-08-18');

-- HubSpot Contacts
CREATE TABLE IF NOT EXISTS analytics_company_1748544793859.hubspot_contact (
    id TEXT PRIMARY KEY,
    firstname TEXT,
    lastname TEXT,
    email TEXT,
    phone TEXT,
    jobtitle TEXT,
    company TEXT,
    industry TEXT,
    lifecycle_stage TEXT,
    lead_status TEXT,
    original_source TEXT,
    created_date TIMESTAMP,
    last_modified_date TIMESTAMP,
    last_activity_date DATE,
    email_opens INTEGER,
    email_clicks INTEGER,
    form_submissions INTEGER,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_system TEXT DEFAULT 'hubspot',
    company_id BIGINT DEFAULT 1748544793859
);

INSERT INTO analytics_company_1748544793859.hubspot_contact (id, firstname, lastname, email, phone, jobtitle, company, industry, lifecycle_stage, lead_status, original_source, created_date, last_modified_date, last_activity_date, email_opens, email_clicks, form_submissions) VALUES
-- High-Value Marketing Contacts
('HCMD001', 'Catherine', 'Lee', 'clee@content-marketing.co', '555-3201', 'VP Marketing', 'Content Marketing Co', 'Marketing', 'customer', 'closed', 'Blog Content', '2024-09-25', '2025-08-15', '2025-08-12', 52, 15, 9),
('HCMD002', 'Steven', 'Garcia', 'sgarcia@email-campaign.net', '555-3202', 'Digital Marketing Director', 'Email Campaign Net', 'Technology', 'customer', 'closed', 'Email Marketing', '2024-11-10', '2025-08-16', '2025-08-13', 38, 11, 6),
('HCMD003', 'Monica', 'Thompson', 'mthompson@webinar-leads.org', '555-3203', 'Head of Growth', 'Webinar Leads Org', 'Education', 'customer', 'closed', 'Webinar', '2024-12-05', '2025-08-17', '2025-08-14', 29, 8, 7),

-- Sales Qualified Leads
('HCMD004', 'Brian', 'Miller', 'bmiller@seo-organic.com', '555-3204', 'SEO Manager', 'SEO Organic Com', 'Marketing', 'salesqualifiedlead', 'qualified', 'Organic Search', '2025-06-05', '2025-08-18', '2025-08-15', 25, 6, 4),
('HCMD005', 'Ashley', 'Young', 'ayoung@social-media.io', '555-3205', 'Social Media Manager', 'Social Media IO', 'Media', 'salesqualifiedlead', 'inprogress', 'Social Media', '2025-06-25', '2025-08-18', '2025-08-16', 18, 5, 3),

-- Marketing Qualified Leads
('HCMD006', 'Kevin', 'Lopez', 'klopez@ppc-campaign.co', '555-3206', 'PPC Specialist', 'PPC Campaign Co', 'Advertising', 'marketingqualifiedlead', 'new', 'Paid Search', '2025-07-10', '2025-08-17', '2025-08-14', 14, 3, 2);

-- HubSpot Companies
CREATE TABLE IF NOT EXISTS analytics_company_1748544793859.hubspot_company (
    id TEXT PRIMARY KEY,
    name TEXT,
    domain TEXT,
    industry TEXT,
    employees INTEGER,
    annual_revenue NUMERIC,
    city TEXT,
    state TEXT,
    country TEXT,
    lifecycle_stage TEXT,
    lead_status TEXT,
    created_date TIMESTAMP,
    last_modified_date TIMESTAMP,
    last_activity_date DATE,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_system TEXT DEFAULT 'hubspot',
    company_id BIGINT DEFAULT 1748544793859
);

INSERT INTO analytics_company_1748544793859.hubspot_company (id, name, domain, industry, employees, annual_revenue, city, state, country, lifecycle_stage, lead_status, created_date, last_modified_date, last_activity_date) VALUES
('HCOMD001', 'Content Marketing Co', 'content-marketing.co', 'Marketing', 85, 12000000, 'Austin', 'TX', 'USA', 'customer', 'closed', '2024-09-25', '2025-08-15', '2025-08-12'),
('HCOMD002', 'Email Campaign Net', 'email-campaign.net', 'Technology', 120, 18000000, 'Portland', 'OR', 'USA', 'customer', 'closed', '2024-11-10', '2025-08-16', '2025-08-13'),
('HCOMD003', 'SEO Organic Com', 'seo-organic.com', 'Marketing', 65, 8000000, 'San Diego', 'CA', 'USA', 'salesqualifiedlead', 'qualified', '2025-06-05', '2025-08-18', '2025-08-15'),
('HCOMD004', 'Social Media IO', 'social-media.io', 'Media', 45, 6000000, 'Nashville', 'TN', 'USA', 'salesqualifiedlead', 'inprogress', '2025-06-25', '2025-08-18', '2025-08-16');