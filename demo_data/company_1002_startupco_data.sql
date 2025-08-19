-- Demo Data for Company 1002: StartupCo Inc  
-- Data Sources: Salesforce + Jira
-- Focus: Startup sales + development productivity

-- =============================================================================
-- SALESFORCE DATA (Startup Sales)
-- =============================================================================

-- Salesforce Opportunities (Early Stage Pipeline)
CREATE TABLE IF NOT EXISTS analytics_company_1002.salesforce_opportunity (
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
    company_id BIGINT DEFAULT 1002
);

INSERT INTO analytics_company_1002.salesforce_opportunity (id, name, amount, stagename, closedate, probability, accountid, ownerid, type, leadsource, created_date, last_modified_date) VALUES
-- Closed Won (Small deals typical for startups)
('006SC001', 'Early Customer License', 15000, 'Closed Won', '2024-12-20', 100, 'ACC201', 'USR201', 'New Business', 'Product Hunt', '2024-11-01', '2024-12-20'),
('006SC002', 'Beta Customer Conversion', 8000, 'Closed Won', '2025-01-15', 100, 'ACC202', 'USR201', 'New Business', 'Beta Program', '2024-12-01', '2025-01-15'),
('006SC003', 'Startup Package Deal', 12000, 'Closed Won', '2025-02-28', 100, 'ACC203', 'USR202', 'New Business', 'Referral', '2025-01-10', '2025-02-28'),
('006SC004', 'Growth Plan Upgrade', 25000, 'Closed Won', '2025-03-15', 100, 'ACC204', 'USR201', 'Upsell', 'Customer Success', '2025-02-01', '2025-03-15'),

-- Current Pipeline (Growth Stage)
('006SC005', 'Series A Funded Startup', 45000, 'Negotiation/Review', '2025-09-30', 80, 'ACC205', 'USR201', 'New Business', 'Investor Network', '2025-06-01', '2025-08-15'),
('006SC006', 'YC Batch Company', 35000, 'Proposal/Price Quote', '2025-10-15', 65, 'ACC206', 'USR202', 'New Business', 'Y Combinator', '2025-07-01', '2025-08-16'),
('006SC007', 'Tech Startup SMB', 18000, 'Value Proposition', '2025-11-01', 45, 'ACC207', 'USR201', 'New Business', 'Cold Outreach', '2025-07-15', '2025-08-17'),
('006SC008', 'Bootstrapped Company', 28000, 'Qualification', '2025-12-15', 30, 'ACC208', 'USR202', 'New Business', 'Website', '2025-08-01', '2025-08-18');

-- Salesforce Contacts (Startup Ecosystem)
CREATE TABLE IF NOT EXISTS analytics_company_1002.salesforce_contact (
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
    company_id BIGINT DEFAULT 1002
);

INSERT INTO analytics_company_1002.salesforce_contact (id, firstname, lastname, email, phone, title, accountid, department, leadsource, created_date, last_modified_date, last_activity_date) VALUES
('003SC001', 'Jake', 'Miller', 'jake@early-customer.io', '555-2001', 'Founder & CEO', 'ACC201', 'Executive', 'Product Hunt', '2024-10-15', '2025-08-16', '2025-08-14'),
('003SC002', 'Anna', 'Chen', 'anna@beta-customer.com', '555-2002', 'CTO', 'ACC202', 'Engineering', 'Beta Program', '2024-11-20', '2025-08-15', '2025-08-12'),
('003SC003', 'Tom', 'Wilson', 'tom@startup-package.co', '555-2003', 'Head of Product', 'ACC203', 'Product', 'Referral', '2025-01-05', '2025-08-17', '2025-08-15'),
('003SC004', 'Sarah', 'Davis', 'sarah@growth-plan.net', '555-2004', 'VP Growth', 'ACC204', 'Growth', 'Customer Success', '2025-01-25', '2025-08-18', '2025-08-16'),
('003SC005', 'Alex', 'Rodriguez', 'alex@seriesa-startup.io', '555-2005', 'Co-Founder', 'ACC205', 'Executive', 'Investor Network', '2025-05-20', '2025-08-18', '2025-08-17');

-- Salesforce Leads (Startup Prospects)
CREATE TABLE IF NOT EXISTS analytics_company_1002.salesforce_lead (
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
    company_id BIGINT DEFAULT 1002
);

INSERT INTO analytics_company_1002.salesforce_lead (id, firstname, lastname, email, phone, title, company, industry, status, rating, leadsource, created_date, last_modified_date, converted_date) VALUES
('00QSC001', 'Emma', 'Taylor', 'emma@fintech-startup.co', '555-2101', 'Founder', 'FinTech Startup', 'Financial Technology', 'Working', 'Hot', 'AngelList', '2025-08-01', '2025-08-16', NULL),
('00QSC002', 'Ryan', 'Kim', 'ryan@healthtech-co.com', '555-2102', 'CTO', 'HealthTech Co', 'Healthcare', 'Qualified', 'Warm', 'TechCrunch', '2025-08-05', '2025-08-17', NULL),
('00QSC003', 'Maya', 'Patel', 'maya@edtech-solution.io', '555-2103', 'CEO', 'EdTech Solution', 'Education', 'Nurturing', 'Warm', 'Hacker News', '2025-08-08', '2025-08-18', NULL),
('00QSC004', 'Chris', 'Brown', 'chris@devtools-inc.com', '555-2104', 'Founder', 'DevTools Inc', 'Developer Tools', 'Working', 'Hot', 'GitHub', '2025-08-10', '2025-08-18', NULL);

-- =============================================================================
-- JIRA DATA (Development Productivity)
-- =============================================================================

-- Jira Projects (Product Development)
CREATE TABLE IF NOT EXISTS analytics_company_1002.jira_project (
    id TEXT PRIMARY KEY,
    key TEXT,
    name TEXT,
    description TEXT,
    lead TEXT,
    project_type TEXT,
    created_date TIMESTAMP,
    last_modified_date TIMESTAMP,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_system TEXT DEFAULT 'jira',
    company_id BIGINT DEFAULT 1002
);

INSERT INTO analytics_company_1002.jira_project (id, key, name, description, lead, project_type, created_date, last_modified_date) VALUES
('10001', 'CORE', 'Core Platform', 'Main product development project', 'alex.dev@startupco.com', 'software', '2024-01-15', '2025-08-18'),
('10002', 'MOBILE', 'Mobile App', 'iOS and Android mobile applications', 'sarah.mobile@startupco.com', 'software', '2024-03-01', '2025-08-17'),
('10003', 'API', 'API Development', 'REST API and integrations', 'mike.backend@startupco.com', 'software', '2024-02-01', '2025-08-16');

-- Jira Issues (Development Tasks)
CREATE TABLE IF NOT EXISTS analytics_company_1002.jira_issue (
    id TEXT PRIMARY KEY,
    key TEXT,
    project_id TEXT,
    summary TEXT,
    description TEXT,
    issue_type TEXT,
    status TEXT,
    priority TEXT,
    assignee TEXT,
    reporter TEXT,
    created_date TIMESTAMP,
    updated_date TIMESTAMP,
    resolved_date TIMESTAMP,
    story_points INTEGER,
    sprint TEXT,
    labels TEXT[],
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_system TEXT DEFAULT 'jira',
    company_id BIGINT DEFAULT 1002
);

INSERT INTO analytics_company_1002.jira_issue (id, key, project_id, summary, description, issue_type, status, priority, assignee, reporter, created_date, updated_date, resolved_date, story_points, sprint, labels) VALUES
-- Completed Stories (High Velocity)
('1001', 'CORE-1', '10001', 'User Authentication System', 'Implement OAuth 2.0 login system', 'Story', 'Done', 'High', 'alex.dev@startupco.com', 'product@startupco.com', '2025-07-01', '2025-07-15', '2025-07-15', 8, 'Sprint 15', ARRAY['authentication', 'security']),
('1002', 'CORE-2', '10001', 'Dashboard UI Components', 'Create reusable dashboard components', 'Story', 'Done', 'Medium', 'jenny.frontend@startupco.com', 'design@startupco.com', '2025-07-01', '2025-07-12', '2025-07-12', 5, 'Sprint 15', ARRAY['frontend', 'ui']),
('1003', 'CORE-3', '10001', 'Database Optimization', 'Optimize query performance for user data', 'Story', 'Done', 'High', 'mike.backend@startupco.com', 'alex.dev@startupco.com', '2025-07-08', '2025-07-20', '2025-07-20', 13, 'Sprint 15', ARRAY['backend', 'performance']),
('1004', 'MOBILE-1', '10002', 'iOS App Store Submission', 'Prepare and submit iOS app to App Store', 'Task', 'Done', 'Critical', 'sarah.mobile@startupco.com', 'product@startupco.com', '2025-07-15', '2025-07-25', '2025-07-25', 3, 'Sprint 16', ARRAY['mobile', 'ios', 'release']),
('1005', 'API-1', '10003', 'Rate Limiting Implementation', 'Add rate limiting to API endpoints', 'Story', 'Done', 'Medium', 'mike.backend@startupco.com', 'alex.dev@startupco.com', '2025-07-10', '2025-07-18', '2025-07-18', 5, 'Sprint 15', ARRAY['api', 'security']),

-- Current Sprint (In Progress)
('1006', 'CORE-4', '10001', 'Real-time Notifications', 'Implement WebSocket-based notifications', 'Story', 'In Progress', 'High', 'alex.dev@startupco.com', 'product@startupco.com', '2025-08-01', '2025-08-18', NULL, 8, 'Sprint 17', ARRAY['realtime', 'websockets']),
('1007', 'CORE-5', '10001', 'User Settings Page', 'Build comprehensive user settings interface', 'Story', 'In Progress', 'Medium', 'jenny.frontend@startupco.com', 'design@startupco.com', '2025-08-05', '2025-08-17', NULL, 5, 'Sprint 17', ARRAY['frontend', 'settings']),
('1008', 'MOBILE-2', '10002', 'Push Notifications', 'Implement push notifications for mobile', 'Story', 'In Progress', 'High', 'sarah.mobile@startupco.com', 'product@startupco.com', '2025-08-08', '2025-08-18', NULL, 8, 'Sprint 17', ARRAY['mobile', 'notifications']),
('1009', 'API-2', '10003', 'Webhook System', 'Build webhook delivery system', 'Story', 'Code Review', 'Medium', 'mike.backend@startupco.com', 'alex.dev@startupco.com', '2025-08-10', '2025-08-16', NULL, 13, 'Sprint 17', ARRAY['api', 'webhooks']),

-- Backlog Items
('1010', 'CORE-6', '10001', 'Advanced Analytics Dashboard', 'Create analytics and reporting dashboard', 'Epic', 'To Do', 'Low', 'unassigned', 'product@startupco.com', '2025-08-15', '2025-08-15', NULL, 21, 'Backlog', ARRAY['analytics', 'dashboard']),
('1011', 'MOBILE-3', '10002', 'Offline Mode Support', 'Add offline functionality to mobile app', 'Story', 'To Do', 'Medium', 'unassigned', 'product@startupco.com', '2025-08-16', '2025-08-16', NULL, 13, 'Backlog', ARRAY['mobile', 'offline']),
('1012', 'API-3', '10003', 'GraphQL Implementation', 'Migrate REST API to GraphQL', 'Epic', 'To Do', 'Low', 'unassigned', 'alex.dev@startupco.com', '2025-08-17', '2025-08-17', NULL, 34, 'Backlog', ARRAY['api', 'graphql']),

-- Bugs (Typical Startup Issues)
('1013', 'CORE-7', '10001', 'Login Session Timeout Bug', 'Users getting logged out too frequently', 'Bug', 'In Progress', 'Critical', 'alex.dev@startupco.com', 'support@startupco.com', '2025-08-12', '2025-08-18', NULL, 3, 'Sprint 17', ARRAY['bug', 'authentication']),
('1014', 'MOBILE-4', '10002', 'iOS Crash on Startup', 'App crashes on iPhone 12 during startup', 'Bug', 'To Do', 'High', 'sarah.mobile@startupco.com', 'qa@startupco.com', '2025-08-14', '2025-08-18', NULL, 5, 'Sprint 17', ARRAY['bug', 'ios', 'crash']);

-- Jira Users (Development Team)
CREATE TABLE IF NOT EXISTS analytics_company_1002.jira_user (
    id TEXT PRIMARY KEY,
    username TEXT,
    email TEXT,
    display_name TEXT,
    active BOOLEAN,
    account_type TEXT,
    created_date TIMESTAMP,
    last_login_date TIMESTAMP,
    loaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source_system TEXT DEFAULT 'jira',
    company_id BIGINT DEFAULT 1002
);

INSERT INTO analytics_company_1002.jira_user (id, username, email, display_name, active, account_type, created_date, last_login_date) VALUES
('usr001', 'alex.dev', 'alex.dev@startupco.com', 'Alex Johnson (Lead Developer)', true, 'atlassian', '2024-01-15', '2025-08-18'),
('usr002', 'sarah.mobile', 'sarah.mobile@startupco.com', 'Sarah Kim (Mobile Developer)', true, 'atlassian', '2024-03-01', '2025-08-17'),
('usr003', 'mike.backend', 'mike.backend@startupco.com', 'Mike Chen (Backend Developer)', true, 'atlassian', '2024-02-01', '2025-08-18'),
('usr004', 'jenny.frontend', 'jenny.frontend@startupco.com', 'Jenny Martinez (Frontend Developer)', true, 'atlassian', '2024-04-15', '2025-08-16'),
('usr005', 'product', 'product@startupco.com', 'Emma Wilson (Product Manager)', true, 'atlassian', '2024-01-15', '2025-08-17'),
('usr006', 'design', 'design@startupco.com', 'Ryan Taylor (UX Designer)', true, 'atlassian', '2024-02-15', '2025-08-15'),
('usr007', 'qa', 'qa@startupco.com', 'Lisa Patel (QA Engineer)', true, 'atlassian', '2024-05-01', '2025-08-16'),
('usr008', 'support', 'support@startupco.com', 'Tom Brown (Customer Support)', true, 'atlassian', '2024-06-01', '2025-08-14');