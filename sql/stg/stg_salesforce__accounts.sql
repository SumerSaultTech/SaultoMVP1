-- Staging view for Salesforce accounts
-- Standardizes field names and performs basic cleaning

SELECT
    Id as account_id,
    Name as account_name,
    Type as account_type,
    Industry as industry,
    AnnualRevenue as annual_revenue,
    NumberOfEmployees as employee_count,
    BillingStreet as billing_street,
    BillingCity as billing_city,
    BillingState as billing_state,
    BillingPostalCode as billing_postal_code,
    BillingCountry as billing_country,
    Phone as phone,
    Website as website,
    OwnerId as owner_id,
    CreatedDate as created_at,
    LastModifiedDate as modified_at,
    IsDeleted as is_deleted
FROM {{ source('salesforce', 'account') }}
WHERE IsDeleted = FALSE
