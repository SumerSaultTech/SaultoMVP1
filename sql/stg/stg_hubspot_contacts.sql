-- Staging table for HubSpot Contacts data
-- This model cleans and standardizes raw HubSpot contact data

SELECT 
    -- Primary identifiers
    CAST(vid AS STRING) AS contact_id,
    
    -- Personal information
    COALESCE(
        properties_firstname_value, 
        SPLIT(properties_name_value, ' ')[OFFSET(0)]
    ) AS first_name,
    
    COALESCE(
        properties_lastname_value,
        CASE 
            WHEN ARRAY_LENGTH(SPLIT(properties_name_value, ' ')) > 1 
            THEN SPLIT(properties_name_value, ' ')[OFFSET(1)]
            ELSE NULL
        END
    ) AS last_name,
    
    properties_email_value AS email,
    properties_phone_value AS phone,
    
    -- Company information
    properties_company_value AS company_name,
    properties_jobtitle_value AS job_title,
    
    -- Lead information
    properties_hs_lead_status_value AS lead_status,
    properties_lifecyclestage_value AS lifecycle_stage,
    
    -- Contact source and attribution
    properties_hs_analytics_source_value AS original_source,
    properties_hs_analytics_source_data_1_value AS original_source_data_1,
    properties_hs_analytics_source_data_2_value AS original_source_data_2,
    
    -- Engagement metrics
    CAST(properties_hubspotscore_value AS INT64) AS hubspot_score,
    CAST(properties_hs_email_open_value AS INT64) AS email_opens,
    CAST(properties_hs_email_click_value AS INT64) AS email_clicks,
    
    -- Address information
    properties_address_value AS street_address,
    properties_city_value AS city,
    properties_state_value AS state,
    properties_zip_value AS postal_code,
    properties_country_value AS country,
    
    -- Timestamps
    DATETIME(TIMESTAMP_MILLIS(CAST(properties_createdate_value AS INT64))) AS created_at,
    DATETIME(TIMESTAMP_MILLIS(CAST(properties_lastmodifieddate_value AS INT64))) AS updated_at,
    DATETIME(TIMESTAMP_MILLIS(CAST(properties_hs_marketable_until_renewal_value AS INT64))) AS marketable_until,
    
    -- Data quality flags
    CASE 
        WHEN properties_email_value IS NOT NULL 
             AND REGEXP_CONTAINS(properties_email_value, r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
        THEN true
        ELSE false
    END AS has_valid_email,
    
    CASE 
        WHEN properties_firstname_value IS NOT NULL 
             AND properties_lastname_value IS NOT NULL
        THEN true
        ELSE false
    END AS has_full_name,
    
    CASE 
        WHEN properties_company_value IS NOT NULL 
             AND TRIM(properties_company_value) != ''
        THEN true
        ELSE false
    END AS has_company,
    
    -- Calculated engagement score
    COALESCE(
        CAST(properties_hubspotscore_value AS INT64), 
        0
    ) + 
    COALESCE(CAST(properties_hs_email_open_value AS INT64), 0) * 2 +
    COALESCE(CAST(properties_hs_email_click_value AS INT64), 0) * 5 AS engagement_score,
    
    -- Lead quality classification
    CASE 
        WHEN properties_lifecyclestage_value IN ('customer', 'evangelist') THEN 'customer'
        WHEN properties_lifecyclestage_value IN ('opportunity', 'sqlead') THEN 'qualified_lead'
        WHEN properties_lifecyclestage_value IN ('lead', 'mql') THEN 'marketing_qualified'
        WHEN properties_lifecyclestage_value = 'subscriber' THEN 'subscriber'
        ELSE 'unqualified'
    END AS lead_category

FROM raw_fivetran.hubspot.contact
WHERE properties_email_value IS NOT NULL
    AND REGEXP_CONTAINS(properties_email_value, r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    AND properties_createdate_value IS NOT NULL
