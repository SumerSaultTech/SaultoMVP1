-- Staging table for Salesforce Account data
-- This model cleans and standardizes raw Salesforce account data

SELECT 
    -- Primary identifiers
    id AS account_id,
    name AS account_name,
    
    -- Account classification
    type AS account_type,
    industry,
    
    -- Revenue and employee information
    COALESCE(annualrevenue, 0) AS annual_revenue,
    COALESCE(numberofemployees, 0) AS employee_count,
    
    -- Contact information
    billingstreet AS billing_street,
    billingcity AS billing_city,
    billingstate AS billing_state,
    billingpostalcode AS billing_postal_code,
    billingcountry AS billing_country,
    
    -- Account status and ownership
    CASE 
        WHEN isdeleted = true THEN 'deleted'
        WHEN isactive = false THEN 'inactive'
        ELSE 'active'
    END AS account_status,
    
    ownerid AS owner_id,
    
    -- Website and description
    website,
    description AS account_description,
    
    -- Timestamps
    createddate AS created_at,
    lastmodifieddate AS updated_at,
    
    -- Data quality flags
    CASE 
        WHEN name IS NULL OR TRIM(name) = '' THEN false
        ELSE true
    END AS has_valid_name,
    
    CASE 
        WHEN billingcity IS NOT NULL OR billingstate IS NOT NULL THEN true
        ELSE false
    END AS has_billing_address,
    
    -- Calculated fields
    CASE 
        WHEN annualrevenue >= 1000000 THEN 'enterprise'
        WHEN annualrevenue >= 100000 THEN 'mid_market'
        WHEN annualrevenue > 0 THEN 'small_business'
        ELSE 'unknown'
    END AS revenue_segment,
    
    CASE 
        WHEN numberofemployees >= 1000 THEN 'large'
        WHEN numberofemployees >= 100 THEN 'medium'
        WHEN numberofemployees > 0 THEN 'small'
        ELSE 'unknown'
    END AS company_size

FROM MIAS_DATA_DB.RAW.salesforce_accounts
WHERE isdeleted = false
    AND createddate IS NOT NULL
