-- Intermediate view unifying customer data across all sources
-- Creates a single customer view with source attribution

WITH salesforce_customers AS (
    SELECT
        account_id as source_id,
        'salesforce' as source_system,
        account_name as customer_name,
        industry,
        annual_revenue,
        employee_count,
        phone,
        website,
        billing_city,
        billing_state,
        billing_country,
        created_at,
        modified_at
    FROM {{ ref('stg_salesforce__accounts') }}
),

hubspot_customers AS (
    SELECT
        contact_id as source_id,
        'hubspot' as source_system,
        COALESCE(company_name, CONCAT(first_name, ' ', last_name)) as customer_name,
        NULL as industry,
        NULL as annual_revenue,
        NULL as employee_count,
        phone,
        NULL as website,
        NULL as billing_city,
        NULL as billing_state,
        NULL as billing_country,
        created_at,
        modified_at
    FROM {{ ref('stg_hubspot__contacts') }}
    WHERE lifecycle_stage IN ('customer', 'opportunity')
),

quickbooks_customers AS (
    SELECT
        customer_id as source_id,
        'quickbooks' as source_system,
        COALESCE(company_name, customer_name) as customer_name,
        NULL as industry,
        NULL as annual_revenue,
        NULL as employee_count,
        phone,
        NULL as website,
        billing_city,
        billing_state,
        billing_country,
        created_at,
        modified_at
    FROM {{ ref('stg_quickbooks__customers') }}
)

SELECT
    ROW_NUMBER() OVER (ORDER BY created_at) as unified_customer_id,
    source_id,
    source_system,
    customer_name,
    industry,
    annual_revenue,
    employee_count,
    phone,
    website,
    billing_city,
    billing_state,
    billing_country,
    created_at,
    modified_at,
    CURRENT_TIMESTAMP as unified_at
FROM (
    SELECT * FROM salesforce_customers
    UNION ALL
    SELECT * FROM hubspot_customers
    UNION ALL
    SELECT * FROM quickbooks_customers
)
ORDER BY created_at DESC
