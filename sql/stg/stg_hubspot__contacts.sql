-- Staging view for HubSpot contacts
-- Standardizes field names and performs basic cleaning

SELECT
    vid as contact_id,
    COALESCE(
        properties_email_value,
        properties_hs_email_value
    ) as email,
    properties_firstname_value as first_name,
    properties_lastname_value as last_name,
    properties_company_value as company_name,
    properties_jobtitle_value as job_title,
    properties_phone_value as phone,
    properties_lifecyclestage_value as lifecycle_stage,
    properties_hs_lead_status_value as lead_status,
    properties_createdate_value as created_at,
    properties_lastmodifieddate_value as modified_at,
    properties_hs_analytics_source_value as source,
    properties_hs_latest_source_value as latest_source
FROM {{ source('hubspot', 'contacts') }}
WHERE properties_email_value IS NOT NULL
   OR properties_hs_email_value IS NOT NULL
