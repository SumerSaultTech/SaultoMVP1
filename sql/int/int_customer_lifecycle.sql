-- Intermediate model combining customer lifecycle data from multiple sources
-- This model creates a unified view of customer journey across Salesforce and HubSpot

WITH salesforce_customers AS (
    SELECT 
        account_id,
        account_name,
        annual_revenue,
        employee_count,
        account_status,
        revenue_segment,
        company_size,
        created_at AS sf_created_at,
        updated_at AS sf_updated_at,
        'salesforce' AS source_system
    FROM {{ ref('stg_salesforce_accounts') }}
    WHERE account_status = 'active'
),

hubspot_contacts AS (
    SELECT 
        contact_id,
        first_name,
        last_name,
        email,
        company_name,
        job_title,
        lead_status,
        lifecycle_stage,
        lead_category,
        engagement_score,
        created_at AS hs_created_at,
        updated_at AS hs_updated_at,
        'hubspot' AS source_system
    FROM {{ ref('stg_hubspot_contacts') }}
    WHERE has_valid_email = true
),

-- Match HubSpot contacts to Salesforce accounts by company name
customer_matching AS (
    SELECT 
        sf.account_id,
        sf.account_name,
        hs.contact_id,
        hs.email,
        hs.first_name,
        hs.last_name,
        hs.job_title,
        
        -- Use Salesforce data as primary for company info
        sf.annual_revenue,
        sf.employee_count,
        sf.revenue_segment,
        sf.company_size,
        
        -- Use HubSpot data for lead/lifecycle info
        hs.lead_status,
        hs.lifecycle_stage,
        hs.lead_category,
        hs.engagement_score,
        
        -- Timeline information
        LEAST(sf.sf_created_at, hs.hs_created_at) AS first_touch_date,
        GREATEST(sf.sf_updated_at, hs.hs_updated_at) AS last_activity_date,
        
        -- Calculate lifecycle progression
        CASE 
            WHEN hs.lifecycle_stage IN ('customer', 'evangelist') THEN 'customer'
            WHEN hs.lifecycle_stage IN ('opportunity', 'sqlead') THEN 'sales_qualified'
            WHEN hs.lifecycle_stage IN ('lead', 'mql') THEN 'marketing_qualified'
            WHEN hs.lifecycle_stage = 'subscriber' THEN 'subscriber'
            ELSE 'prospect'
        END AS current_stage,
        
        -- Scoring and prioritization
        COALESCE(hs.engagement_score, 0) AS engagement_score,
        
        -- Revenue potential scoring
        CASE 
            WHEN sf.revenue_segment = 'enterprise' THEN 100
            WHEN sf.revenue_segment = 'mid_market' THEN 75
            WHEN sf.revenue_segment = 'small_business' THEN 50
            ELSE 25
        END AS revenue_potential_score,
        
        'matched' AS record_type
        
    FROM salesforce_customers sf
    LEFT JOIN hubspot_contacts hs 
        ON LOWER(TRIM(sf.account_name)) = LOWER(TRIM(hs.company_name))
),

-- Include unmatched HubSpot contacts as prospects
unmatched_hubspot AS (
    SELECT 
        NULL AS account_id,
        hs.company_name AS account_name,
        hs.contact_id,
        hs.email,
        hs.first_name,
        hs.last_name,
        hs.job_title,
        
        -- No Salesforce data available
        NULL AS annual_revenue,
        NULL AS employee_count,
        'unknown' AS revenue_segment,
        'unknown' AS company_size,
        
        -- HubSpot lead data
        hs.lead_status,
        hs.lifecycle_stage,
        hs.lead_category,
        hs.engagement_score,
        
        -- Timeline
        hs.hs_created_at AS first_touch_date,
        hs.hs_updated_at AS last_activity_date,
        
        -- Lifecycle stage
        CASE 
            WHEN hs.lifecycle_stage IN ('customer', 'evangelist') THEN 'customer'
            WHEN hs.lifecycle_stage IN ('opportunity', 'sqlead') THEN 'sales_qualified'
            WHEN hs.lifecycle_stage IN ('lead', 'mql') THEN 'marketing_qualified'
            WHEN hs.lifecycle_stage = 'subscriber' THEN 'subscriber'
            ELSE 'prospect'
        END AS current_stage,
        
        hs.engagement_score,
        25 AS revenue_potential_score, -- Default for unknown companies
        'hubspot_only' AS record_type
        
    FROM hubspot_contacts hs
    WHERE NOT EXISTS (
        SELECT 1 FROM salesforce_customers sf 
        WHERE LOWER(TRIM(sf.account_name)) = LOWER(TRIM(hs.company_name))
    )
),

-- Include unmatched Salesforce accounts
unmatched_salesforce AS (
    SELECT 
        sf.account_id,
        sf.account_name,
        NULL AS contact_id,
        NULL AS email,
        NULL AS first_name,
        NULL AS last_name,
        NULL AS job_title,
        
        -- Salesforce company data
        sf.annual_revenue,
        sf.employee_count,
        sf.revenue_segment,
        sf.company_size,
        
        -- No HubSpot data
        NULL AS lead_status,
        NULL AS lifecycle_stage,
        'unknown' AS lead_category,
        0 AS engagement_score,
        
        -- Timeline
        sf.sf_created_at AS first_touch_date,
        sf.sf_updated_at AS last_activity_date,
        
        'prospect' AS current_stage, -- Default for accounts without HubSpot data
        
        0 AS engagement_score,
        CASE 
            WHEN sf.revenue_segment = 'enterprise' THEN 100
            WHEN sf.revenue_segment = 'mid_market' THEN 75
            WHEN sf.revenue_segment = 'small_business' THEN 50
            ELSE 25
        END AS revenue_potential_score,
        'salesforce_only' AS record_type
        
    FROM salesforce_customers sf
    WHERE NOT EXISTS (
        SELECT 1 FROM hubspot_contacts hs 
        WHERE LOWER(TRIM(sf.account_name)) = LOWER(TRIM(hs.company_name))
    )
)

-- Union all customer records
SELECT 
    -- Generate a unique customer key
    COALESCE(
        account_id,
        CONCAT('hs_', contact_id),
        CONCAT('company_', LOWER(REPLACE(account_name, ' ', '_')))
    ) AS customer_key,
    
    account_id,
    account_name,
    contact_id,
    email,
    first_name,
    last_name,
    job_title,
    annual_revenue,
    employee_count,
    revenue_segment,
    company_size,
    lead_status,
    lifecycle_stage,
    lead_category,
    current_stage,
    engagement_score,
    revenue_potential_score,
    first_touch_date,
    last_activity_date,
    record_type,
    
    -- Calculate days in current stage
    DATE_DIFF(CURRENT_DATE(), first_touch_date, DAY) AS days_since_first_touch,
    DATE_DIFF(CURRENT_DATE(), last_activity_date, DAY) AS days_since_last_activity,
    
    -- Lead scoring
    engagement_score + revenue_potential_score AS total_lead_score,
    
    -- Segmentation
    CASE 
        WHEN engagement_score + revenue_potential_score >= 150 THEN 'hot'
        WHEN engagement_score + revenue_potential_score >= 100 THEN 'warm'
        WHEN engagement_score + revenue_potential_score >= 50 THEN 'cold'
        ELSE 'unqualified'
    END AS lead_temperature,
    
    -- Activity flags
    CASE 
        WHEN DATE_DIFF(CURRENT_DATE(), last_activity_date, DAY) <= 30 THEN 'active'
        WHEN DATE_DIFF(CURRENT_DATE(), last_activity_date, DAY) <= 90 THEN 'inactive'
        ELSE 'dormant'
    END AS activity_status,
    
    CURRENT_TIMESTAMP() AS processed_at

FROM (
    SELECT * FROM customer_matching
    UNION ALL
    SELECT * FROM unmatched_hubspot
    UNION ALL
    SELECT * FROM unmatched_salesforce
)
