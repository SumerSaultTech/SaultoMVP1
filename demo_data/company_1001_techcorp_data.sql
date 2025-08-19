-- Demo Data for Company 1001: TechCorp Solutions
-- Data Sources: Salesforce + HubSpot + QuickBooks
-- Focus: Multi-source revenue intelligence

-- =============================================================================
-- SALESFORCE DATA
-- =============================================================================

-- Salesforce Opportunities (B2B Sales Pipeline)
CREATE TABLE IF NOT EXISTS analytics_company_1001.salesforce_opportunity (
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
    company_id BIGINT DEFAULT 1001
);

INSERT INTO analytics_company_1001.salesforce_opportunity (id, name, amount, stagename, closedate, probability, accountid, ownerid, type, leadsource, created_date, last_modified_date) VALUES
-- Q4 2024 Closed Won Deals
('006TC001', 'TechCorp Enterprise License', 125000, 'Closed Won', '2024-12-15', 100, 'ACC001', 'USR001', 'New Business', 'Website', '2024-10-01', '2024-12-15'),
('006TC002', 'DataFlow Implementation', 95000, 'Closed Won', '2024-11-28', 100, 'ACC002', 'USR002', 'New Business', 'Referral', '2024-09-15', '2024-11-28'),
('006TC003', 'CloudSync Renewal', 78000, 'Closed Won', '2024-12-10', 100, 'ACC003', 'USR001', 'Renewal', 'Existing Customer', '2024-11-01', '2024-12-10'),
('006TC004', 'Analytics Plus Package', 156000, 'Closed Won', '2024-12-20', 100, 'ACC004', 'USR003', 'Upsell', 'Inbound', '2024-10-15', '2024-12-20'),

-- Q1 2025 Closed Won Deals  
('006TC005', 'SmartData Integration', 88000, 'Closed Won', '2025-01-15', 100, 'ACC005', 'USR002', 'New Business', 'Trade Show', '2024-11-20', '2025-01-15'),
('006TC006', 'Process Automation Suite', 112000, 'Closed Won', '2025-02-08', 100, 'ACC006', 'USR001', 'New Business', 'Cold Call', '2024-12-01', '2025-02-08'),
('006TC007', 'Premium Support Upgrade', 45000, 'Closed Won', '2025-03-12', 100, 'ACC007', 'USR003', 'Upsell', 'Customer Success', '2025-01-10', '2025-03-12'),

-- Current Pipeline (Open Opportunities)
('006TC008', 'Global Enterprise Deal', 285000, 'Negotiation/Review', '2025-09-30', 75, 'ACC008', 'USR001', 'New Business', 'Partner Referral', '2025-01-15', '2025-08-15'),
('006TC009', 'Multi-Region Deployment', 198000, 'Proposal/Price Quote', '2025-10-15', 60, 'ACC009', 'USR002', 'New Business', 'Website', '2025-02-01', '2025-08-10'),
('006TC010', 'Advanced Analytics Add-on', 67000, 'Value Proposition', '2025-11-01', 40, 'ACC010', 'USR003', 'Upsell', 'Inbound', '2025-03-01', '2025-08-12'),
('006TC011', 'Startup Growth Package', 43000, 'Qualification', '2025-12-15', 25, 'ACC011', 'USR002', 'New Business', 'Social Media', '2025-04-01', '2025-08-14'),
('006TC012', 'Insurance Compliance Module', 89000, 'Needs Analysis', '2025-10-30', 35, 'ACC012', 'USR001', 'New Business', 'Trade Show', '2025-03-15', '2025-08-16'),

-- Historical Closed Lost
('006TC013', 'Manufacturing ERP Integration', 134000, 'Closed Lost', '2024-11-30', 0, 'ACC013', 'USR003', 'New Business', 'Website', '2024-08-01', '2024-11-30'),
('006TC014', 'Retail Analytics Platform', 76000, 'Closed Lost', '2024-12-05', 0, 'ACC014', 'USR002', 'New Business', 'Cold Call', '2024-09-10', '2024-12-05');

-- Salesforce Contacts
CREATE TABLE IF NOT EXISTS analytics_company_1001.salesforce_contact (
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
    company_id BIGINT DEFAULT 1001
);

INSERT INTO analytics_company_1001.salesforce_contact (id, firstname, lastname, email, phone, title, accountid, department, leadsource, created_date, last_modified_date, last_activity_date) VALUES
('003TC001', 'Sarah', 'Johnson', 'sarah.johnson@enterprise-corp.com', '555-0101', 'CTO', 'ACC001', 'Technology', 'Website', '2024-09-15', '2025-08-14', '2025-08-10'),
('003TC002', 'Michael', 'Chen', 'mchen@dataflow-systems.com', '555-0102', 'VP Engineering', 'ACC002', 'Engineering', 'Referral', '2024-08-20', '2025-08-12', '2025-08-08'),
('003TC003', 'Lisa', 'Rodriguez', 'lrodriguez@cloudsync.io', '555-0103', 'Head of Operations', 'ACC003', 'Operations', 'Existing Customer', '2024-10-05', '2025-08-15', '2025-08-12'),
('003TC004', 'David', 'Park', 'dpark@analytics-plus.com', '555-0104', 'Chief Data Officer', 'ACC004', 'Data', 'Inbound', '2024-09-28', '2025-08-13', '2025-08-11'),
('003TC005', 'Jennifer', 'Williams', 'jwilliams@smartdata.co', '555-0105', 'Director of IT', 'ACC005', 'IT', 'Trade Show', '2024-11-10', '2025-08-16', '2025-08-14'),
('003TC006', 'Robert', 'Taylor', 'rtaylor@processauto.com', '555-0106', 'Operations Manager', 'ACC006', 'Operations', 'Cold Call', '2024-11-25', '2025-08-17', '2025-08-15'),
('003TC007', 'Amanda', 'Brown', 'abrown@premium-support.net', '555-0107', 'Customer Success Manager', 'ACC007', 'Customer Success', 'Customer Success', '2025-01-02', '2025-08-18', '2025-08-16'),
('003TC008', 'James', 'Wilson', 'jwilson@global-enterprise.com', '555-0108', 'SVP Technology', 'ACC008', 'Technology', 'Partner Referral', '2025-01-10', '2025-08-18', '2025-08-17');

-- Salesforce Leads
CREATE TABLE IF NOT EXISTS analytics_company_1001.salesforce_lead (
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
    company_id BIGINT DEFAULT 1001
);

INSERT INTO analytics_company_1001.salesforce_lead (id, firstname, lastname, email, phone, title, company, industry, status, rating, leadsource, created_date, last_modified_date, converted_date) VALUES
('00QTC001', 'Mark', 'Anderson', 'manderson@techstartup.io', '555-0201', 'Founder', 'TechStartup Inc', 'Technology', 'Qualified', 'Hot', 'Website', '2025-08-01', '2025-08-15', NULL),
('00QTC002', 'Emily', 'Davis', 'edavis@manufacturing-co.com', '555-0202', 'IT Director', 'Manufacturing Co', 'Manufacturing', 'Working', 'Warm', 'Trade Show', '2025-08-05', '2025-08-16', NULL),
('00QTC003', 'Carlos', 'Martinez', 'cmartinez@retailchain.com', '555-0203', 'Head of Analytics', 'RetailChain LLC', 'Retail', 'Qualified', 'Hot', 'Referral', '2025-08-08', '2025-08-17', NULL),
('00QTC004', 'Rachel', 'Kim', 'rkim@healthtech.org', '555-0204', 'CIO', 'HealthTech Solutions', 'Healthcare', 'Nurturing', 'Warm', 'Social Media', '2025-08-10', '2025-08-18', NULL),
('00QTC005', 'Thomas', 'White', 'twhite@financial-services.com', '555-0205', 'VP Technology', 'Financial Services Corp', 'Financial Services', 'Working', 'Hot', 'Cold Call', '2025-08-12', '2025-08-18', NULL);

-- =============================================================================
-- HUBSPOT DATA
-- =============================================================================

-- HubSpot Deals (Marketing Qualified Pipeline)
CREATE TABLE IF NOT EXISTS analytics_company_1001.hubspot_deal (
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
    company_id BIGINT DEFAULT 1001
);

INSERT INTO analytics_company_1001.hubspot_deal (id, dealname, amount, dealstage, closedate, probability, pipeline, dealtype, leadsource, created_date, last_modified_date) VALUES
-- Marketing Generated Deals (Closed Won)
('HSTC001', 'Inbound SaaS Migration', 67000, 'closedwon', '2024-12-08', 100, 'sales', 'newbusiness', 'Content Marketing', '2024-10-15', '2024-12-08'),
('HSTC002', 'Email Campaign Conversion', 34000, 'closedwon', '2025-01-22', 100, 'sales', 'newbusiness', 'Email Marketing', '2024-11-30', '2025-01-22'),
('HSTC003', 'Webinar Lead Conversion', 89000, 'closedwon', '2025-02-14', 100, 'sales', 'newbusiness', 'Webinar', '2024-12-10', '2025-02-14'),

-- Current Marketing Pipeline
('HSTC004', 'Content Lead Opportunity', 112000, 'qualified', '2025-10-20', 65, 'sales', 'newbusiness', 'Blog/Content', '2025-05-15', '2025-08-16'),
('HSTC005', 'Social Media Generated', 78000, 'presentation', '2025-09-25', 45, 'sales', 'newbusiness', 'Social Media', '2025-06-01', '2025-08-14'),
('HSTC006', 'SEO Organic Lead', 95000, 'qualified', '2025-11-10', 55, 'sales', 'newbusiness', 'Organic Search', '2025-06-20', '2025-08-17'),
('HSTC007', 'PPC Campaign Lead', 134000, 'negotiation', '2025-09-15', 70, 'sales', 'newbusiness', 'Paid Search', '2025-07-01', '2025-08-18'),

-- Marketing Qualified but Not Yet Sales Ready
('HSTC008', 'Newsletter Subscriber', 23000, 'marketingqualified', '2025-12-01', 20, 'marketing', 'newbusiness', 'Email Marketing', '2025-08-01', '2025-08-16'),
('HSTC009', 'Event Attendee Lead', 45000, 'marketingqualified', '2025-11-30', 25, 'marketing', 'newbusiness', 'Event', '2025-08-05', '2025-08-17');

-- HubSpot Contacts (Marketing Database)
CREATE TABLE IF NOT EXISTS analytics_company_1001.hubspot_contact (
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
    company_id BIGINT DEFAULT 1001
);

INSERT INTO analytics_company_1001.hubspot_contact (id, firstname, lastname, email, phone, jobtitle, company, industry, lifecycle_stage, lead_status, original_source, created_date, last_modified_date, last_activity_date, email_opens, email_clicks, form_submissions) VALUES
-- High-Engagement Marketing Contacts
('HCTC001', 'Alex', 'Thompson', 'athompson@saas-migration.com', '555-0301', 'Technical Lead', 'SaaS Migration Co', 'Technology', 'customer', 'closed', 'Content Marketing', '2024-09-20', '2025-08-15', '2025-08-12', 45, 12, 8),
('HCTC002', 'Maria', 'Garcia', 'mgarcia@email-campaign.org', '555-0302', 'Marketing Director', 'Email Campaign Org', 'Marketing', 'customer', 'closed', 'Email Marketing', '2024-11-15', '2025-08-14', '2025-08-10', 67, 18, 5),
('HCTC003', 'Kevin', 'Lee', 'klee@webinar-leads.com', '555-0303', 'Head of Growth', 'Webinar Leads Inc', 'Education', 'customer', 'closed', 'Webinar', '2024-12-01', '2025-08-16', '2025-08-13', 34, 9, 12),

-- Sales Qualified Leads
('HCTC004', 'Sophie', 'Miller', 'smiller@content-opportunity.co', '555-0304', 'VP Marketing', 'Content Opportunity Co', 'Technology', 'salesqualifiedlead', 'new', 'Blog/Content', '2025-05-10', '2025-08-17', '2025-08-15', 28, 7, 4),
('HCTC005', 'Daniel', 'Young', 'dyoung@social-media-gen.com', '555-0305', 'Social Media Manager', 'Social Media Gen', 'Media', 'salesqualifiedlead', 'inprogress', 'Social Media', '2025-05-25', '2025-08-18', '2025-08-16', 19, 5, 6),

-- Marketing Qualified Leads  
('HCTC006', 'Isabella', 'Lopez', 'ilopez@seo-organic.net', '555-0306', 'SEO Specialist', 'SEO Organic Net', 'Marketing', 'marketingqualifiedlead', 'new', 'Organic Search', '2025-06-15', '2025-08-16', '2025-08-14', 15, 4, 3),
('HCTC007', 'Ryan', 'Hall', 'rhall@ppc-campaign.io', '555-0307', 'Digital Marketing Lead', 'PPC Campaign IO', 'Advertising', 'marketingqualifiedlead', 'qualified', 'Paid Search', '2025-06-28', '2025-08-17', '2025-08-15', 22, 6, 2),

-- Newsletter Subscribers & Event Attendees
('HCTC008', 'Grace', 'Wright', 'gwright@newsletter-sub.com', '555-0308', 'Content Manager', 'Newsletter Sub Com', 'Publishing', 'lead', 'new', 'Email Marketing', '2025-07-25', '2025-08-15', '2025-08-13', 8, 2, 1),
('HCTC009', 'Nathan', 'Green', 'ngreen@event-attendee.org', '555-0309', 'Event Coordinator', 'Event Attendee Org', 'Events', 'lead', 'new', 'Event', '2025-08-02', '2025-08-16', '2025-08-14', 12, 3, 2);

-- HubSpot Companies (Target Accounts)
CREATE TABLE IF NOT EXISTS analytics_company_1001.hubspot_company (
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
    company_id BIGINT DEFAULT 1001
);

INSERT INTO analytics_company_1001.hubspot_company (id, name, domain, industry, employees, annual_revenue, city, state, country, lifecycle_stage, lead_status, created_date, last_modified_date, last_activity_date) VALUES
('HCOTC001', 'SaaS Migration Co', 'saas-migration.com', 'Technology', 150, 15000000, 'San Francisco', 'CA', 'USA', 'customer', 'closed', '2024-09-20', '2025-08-15', '2025-08-12'),
('HCOTC002', 'Email Campaign Org', 'email-campaign.org', 'Marketing', 75, 8000000, 'Austin', 'TX', 'USA', 'customer', 'closed', '2024-11-15', '2025-08-14', '2025-08-10'),
('HCOTC003', 'Content Opportunity Co', 'content-opportunity.co', 'Technology', 200, 25000000, 'Seattle', 'WA', 'USA', 'salesqualifiedlead', 'new', '2025-05-10', '2025-08-17', '2025-08-15'),
('HCOTC004', 'Social Media Gen', 'social-media-gen.com', 'Media', 45, 5000000, 'Los Angeles', 'CA', 'USA', 'salesqualifiedlead', 'inprogress', '2025-05-25', '2025-08-18', '2025-08-16'),
('HCOTC005', 'SEO Organic Net', 'seo-organic.net', 'Marketing', 30, 3000000, 'Denver', 'CO', 'USA', 'marketingqualifiedlead', 'new', '2025-06-15', '2025-08-16', '2025-08-14');

-- =============================================================================
-- QUICKBOOKS DATA
-- =============================================================================

-- QuickBooks Invoices (Actual Revenue)
CREATE TABLE IF NOT EXISTS analytics_company_1001.quickbooks_invoice (
    id TEXT PRIMARY KEY,
    invoice_number TEXT,
    customer_id TEXT,
    customer_name TEXT,
    total NUMERIC,
    subtotal NUMERIC,
    tax_amount NUMERIC,
    status TEXT,
    due_date DATE,
    invoice_date DATE,
    paid_date DATE,
    terms TEXT,
    memo TEXT,
    created_date TIMESTAMP,
    last_modified_date TIMESTAMP,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_system TEXT DEFAULT 'quickbooks',
    company_id BIGINT DEFAULT 1001
);

INSERT INTO analytics_company_1001.quickbooks_invoice (id, invoice_number, customer_id, customer_name, total, subtotal, tax_amount, status, due_date, invoice_date, paid_date, terms, memo, created_date, last_modified_date) VALUES
-- Q4 2024 Revenue (matches Salesforce closed deals)
('QITC001', 'INV-2024-001', 'CUST001', 'Enterprise Corp', 125000, 119048, 5952, 'paid', '2025-01-15', '2024-12-15', '2024-12-28', 'Net 30', 'TechCorp Enterprise License - Annual', '2024-12-15', '2024-12-28'),
('QITC002', 'INV-2024-002', 'CUST002', 'DataFlow Systems', 95000, 90476, 4524, 'paid', '2024-12-28', '2024-11-28', '2024-12-15', 'Net 30', 'DataFlow Implementation - Project', '2024-11-28', '2024-12-15'),
('QITC003', 'INV-2024-003', 'CUST003', 'CloudSync Solutions', 78000, 74286, 3714, 'paid', '2025-01-10', '2024-12-10', '2024-12-20', 'Net 30', 'CloudSync Renewal - Annual License', '2024-12-10', '2024-12-20'),
('QITC004', 'INV-2024-004', 'CUST004', 'Analytics Plus Inc', 156000, 148571, 7429, 'paid', '2025-01-20', '2024-12-20', '2025-01-05', 'Net 30', 'Analytics Plus Package - Enterprise', '2024-12-20', '2025-01-05'),

-- Q1 2025 Revenue
('QITC005', 'INV-2025-001', 'CUST005', 'SmartData Corp', 88000, 83810, 4190, 'paid', '2025-02-15', '2025-01-15', '2025-01-28', 'Net 30', 'SmartData Integration - Implementation', '2025-01-15', '2025-01-28'),
('QITC006', 'INV-2025-002', 'CUST006', 'Process Auto LLC', 112000, 106667, 5333, 'paid', '2025-03-08', '2025-02-08', '2025-02-22', 'Net 30', 'Process Automation Suite - Annual', '2025-02-08', '2025-02-22'),
('QITC007', 'INV-2025-003', 'CUST007', 'Premium Support Co', 45000, 42857, 2143, 'paid', '2025-04-12', '2025-03-12', '2025-03-25', 'Net 30', 'Premium Support Upgrade - Annual', '2025-03-12', '2025-03-25'),

-- Additional HubSpot-sourced revenue 
('QITC008', 'INV-2024-005', 'CUST008', 'SaaS Migration Co', 67000, 63810, 3190, 'paid', '2025-01-08', '2024-12-08', '2024-12-20', 'Net 30', 'Inbound SaaS Migration - Project', '2024-12-08', '2024-12-20'),
('QITC009', 'INV-2025-004', 'CUST009', 'Email Campaign Org', 34000, 32381, 1619, 'paid', '2025-02-22', '2025-01-22', '2025-02-05', 'Net 30', 'Email Campaign Conversion - License', '2025-01-22', '2025-02-05'),
('QITC010', 'INV-2025-005', 'CUST010', 'Webinar Leads Inc', 89000, 84762, 4238, 'paid', '2025-03-14', '2025-02-14', '2025-02-28', 'Net 30', 'Webinar Lead Conversion - Enterprise', '2025-02-14', '2025-02-28'),

-- Outstanding Invoices
('QITC011', 'INV-2025-006', 'CUST011', 'Manufacturing Co', 98000, 93333, 4667, 'open', '2025-09-15', '2025-08-15', NULL, 'Net 30', 'Manufacturing Integration - Phase 1', '2025-08-15', '2025-08-15'),
('QITC012', 'INV-2025-007', 'CUST012', 'RetailChain LLC', 145000, 138095, 6905, 'open', '2025-09-18', '2025-08-18', NULL, 'Net 30', 'Retail Analytics Platform - Annual', '2025-08-18', '2025-08-18');

-- QuickBooks Expenses (Operating Costs)
CREATE TABLE IF NOT EXISTS analytics_company_1001.quickbooks_expense (
    id TEXT PRIMARY KEY,
    expense_number TEXT,
    vendor_name TEXT,
    account_name TEXT,
    category TEXT,
    amount NUMERIC,
    expense_date DATE,
    payment_method TEXT,
    memo TEXT,
    billable BOOLEAN,
    created_date TIMESTAMP,
    last_modified_date TIMESTAMP,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_system TEXT DEFAULT 'quickbooks',
    company_id BIGINT DEFAULT 1001
);

INSERT INTO analytics_company_1001.quickbooks_expense (id, expense_number, vendor_name, account_name, category, amount, expense_date, payment_method, memo, billable, created_date, last_modified_date) VALUES
-- Monthly Recurring Expenses
('QETC001', 'EXP-2025-001', 'Office Lease Co', 'Rent Expense', 'Facilities', 15000, '2025-01-01', 'Bank Transfer', 'Monthly office rent - January', false, '2025-01-01', '2025-01-01'),
('QETC002', 'EXP-2025-002', 'Office Lease Co', 'Rent Expense', 'Facilities', 15000, '2025-02-01', 'Bank Transfer', 'Monthly office rent - February', false, '2025-02-01', '2025-02-01'),
('QETC003', 'EXP-2025-003', 'Office Lease Co', 'Rent Expense', 'Facilities', 15000, '2025-03-01', 'Bank Transfer', 'Monthly office rent - March', false, '2025-03-01', '2025-03-01'),

-- Technology & Software
('QETC004', 'EXP-2025-004', 'AWS Cloud Services', 'Technology', 'Infrastructure', 8500, '2025-01-15', 'Credit Card', 'Cloud hosting - Q1', false, '2025-01-15', '2025-01-15'),
('QETC005', 'EXP-2025-005', 'Salesforce Inc', 'Technology', 'Software', 12000, '2025-02-01', 'Bank Transfer', 'CRM licenses - Annual', false, '2025-02-01', '2025-02-01'),
('QETC006', 'EXP-2025-006', 'HubSpot Inc', 'Technology', 'Software', 8000, '2025-02-15', 'Credit Card', 'Marketing automation - Annual', false, '2025-02-15', '2025-02-15'),

-- Sales & Marketing
('QETC007', 'EXP-2025-007', 'Google Ads', 'Marketing', 'Advertising', 5000, '2025-01-31', 'Credit Card', 'PPC campaigns - January', false, '2025-01-31', '2025-01-31'),
('QETC008', 'EXP-2025-008', 'Trade Show Events', 'Marketing', 'Events', 18000, '2025-03-15', 'Bank Transfer', 'Industry conference - Q1', false, '2025-03-15', '2025-03-15'),
('QETC009', 'EXP-2025-009', 'Content Agency', 'Marketing', 'Content', 6000, '2025-02-28', 'Credit Card', 'Content creation - February', false, '2025-02-28', '2025-02-28'),

-- Payroll & Benefits (approximated)
('QETC010', 'EXP-2025-010', 'Payroll Services Inc', 'Payroll', 'Salaries', 75000, '2025-01-31', 'Bank Transfer', 'Employee salaries - January', false, '2025-01-31', '2025-01-31'),
('QETC011', 'EXP-2025-011', 'Benefits Provider', 'Payroll', 'Benefits', 12000, '2025-02-01', 'Bank Transfer', 'Health insurance - February', false, '2025-02-01', '2025-02-01');

-- QuickBooks Customers 
CREATE TABLE IF NOT EXISTS analytics_company_1001.quickbooks_customer (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    company_name TEXT,
    email TEXT,
    phone TEXT,
    billing_address TEXT,
    city TEXT,
    state TEXT,
    country TEXT,
    customer_type TEXT,
    payment_terms TEXT,
    credit_limit NUMERIC,
    current_balance NUMERIC,
    total_revenue NUMERIC,
    created_date TIMESTAMP,
    last_modified_date TIMESTAMP,
    last_transaction_date DATE,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_system TEXT DEFAULT 'quickbooks',
    company_id BIGINT DEFAULT 1001
);

INSERT INTO analytics_company_1001.quickbooks_customer (id, customer_name, company_name, email, phone, billing_address, city, state, country, customer_type, payment_terms, credit_limit, current_balance, total_revenue, created_date, last_modified_date, last_transaction_date) VALUES
-- Paying Customers (matches invoices)
('CUST001', 'Enterprise Corp', 'Enterprise Corp', 'billing@enterprise-corp.com', '555-1001', '123 Business Ave', 'New York', 'NY', 'USA', 'Enterprise', 'Net 30', 500000, 0, 125000, '2024-09-01', '2024-12-28', '2024-12-28'),
('CUST002', 'DataFlow Systems', 'DataFlow Systems', 'accounts@dataflow-systems.com', '555-1002', '456 Tech Street', 'Boston', 'MA', 'USA', 'Enterprise', 'Net 30', 300000, 0, 95000, '2024-08-15', '2024-12-15', '2024-12-15'),
('CUST003', 'CloudSync Solutions', 'CloudSync Solutions', 'finance@cloudsync.io', '555-1003', '789 Cloud Way', 'San Francisco', 'CA', 'USA', 'Enterprise', 'Net 30', 200000, 0, 78000, '2024-10-01', '2024-12-20', '2024-12-20'),
('CUST004', 'Analytics Plus Inc', 'Analytics Plus Inc', 'billing@analytics-plus.com', '555-1004', '321 Data Drive', 'Chicago', 'IL', 'USA', 'Enterprise', 'Net 30', 400000, 0, 156000, '2024-09-20', '2025-01-05', '2025-01-05'),
('CUST005', 'SmartData Corp', 'SmartData Corp', 'ap@smartdata.co', '555-1005', '654 Smart Boulevard', 'Austin', 'TX', 'USA', 'Mid-Market', 'Net 30', 150000, 0, 88000, '2024-11-05', '2025-01-28', '2025-01-28'),
('CUST006', 'Process Auto LLC', 'Process Auto LLC', 'payments@processauto.com', '555-1006', '987 Automation Lane', 'Denver', 'CO', 'USA', 'Mid-Market', 'Net 30', 200000, 0, 112000, '2024-11-20', '2025-02-22', '2025-02-22'),
('CUST007', 'Premium Support Co', 'Premium Support Co', 'billing@premium-support.net', '555-1007', '147 Support Street', 'Portland', 'OR', 'USA', 'Small Business', 'Net 30', 100000, 0, 45000, '2024-12-15', '2025-03-25', '2025-03-25'),
('CUST008', 'SaaS Migration Co', 'SaaS Migration Co', 'finance@saas-migration.com', '555-1008', '258 Migration Road', 'Seattle', 'WA', 'USA', 'Mid-Market', 'Net 30', 150000, 0, 67000, '2024-09-10', '2024-12-20', '2024-12-20'),
('CUST009', 'Email Campaign Org', 'Email Campaign Org', 'accounting@email-campaign.org', '555-1009', '369 Campaign Circle', 'Austin', 'TX', 'USA', 'Small Business', 'Net 30', 75000, 0, 34000, '2024-11-10', '2025-02-05', '2025-02-05'),
('CUST010', 'Webinar Leads Inc', 'Webinar Leads Inc', 'finance@webinar-leads.com', '555-1010', '741 Webinar Way', 'Los Angeles', 'CA', 'USA', 'Mid-Market', 'Net 30', 120000, 0, 89000, '2024-12-01', '2025-02-28', '2025-02-28'),

-- Outstanding Balance Customers
('CUST011', 'Manufacturing Co', 'Manufacturing Co', 'ap@manufacturing-co.com', '555-1011', '852 Industrial Blvd', 'Detroit', 'MI', 'USA', 'Enterprise', 'Net 30', 250000, 98000, 98000, '2025-07-01', '2025-08-15', '2025-08-15'),
('CUST012', 'RetailChain LLC', 'RetailChain LLC', 'billing@retailchain.com', '555-1012', '963 Retail Plaza', 'Miami', 'FL', 'USA', 'Enterprise', 'Net 30', 300000, 145000, 145000, '2025-07-15', '2025-08-18', '2025-08-18');