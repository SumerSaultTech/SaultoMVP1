-- Staging view for Salesforce accounts
-- Standardizes field names and performs basic cleaning

-- Updated for PostgreSQL analytics schema

SELECT
    id as account_id,
    name as account_name,
    type as account_type,
    industry as industry,
    annualrevenue as annual_revenue,
    numberofemployees as employee_count,
    billingstreet as billing_street,
    billingcity as billing_city,
    billingstate as billing_state,
    billingpostalcode as billing_postal_code,
    billingcountry as billing_country,
    phone as phone,
    website as website,
    ownerid as owner_id,
    createddate as created_at,
    lastmodifieddate as modified_at,
    isdeleted as is_deleted,
    loaded_at,
    source_system,
    company_id
FROM analytics_company_{{ var('company_id') }}.salesforce_account
WHERE isdeleted = false OR isdeleted IS NULL
