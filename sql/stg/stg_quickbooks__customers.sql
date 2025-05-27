-- Staging view for QuickBooks customers
-- Standardizes field names and performs basic cleaning

SELECT
    Id as customer_id,
    Name as customer_name,
    CompanyName as company_name,
    DisplayName as display_name,
    PrintOnCheckName as print_name,
    Active as is_active,
    Balance as current_balance,
    BillAddr_Line1 as billing_address_line1,
    BillAddr_City as billing_city,
    BillAddr_CountrySubDivisionCode as billing_state,
    BillAddr_PostalCode as billing_postal_code,
    BillAddr_Country as billing_country,
    PrimaryPhone_FreeFormNumber as phone,
    PrimaryEmailAddr_Address as email,
    CreateTime as created_at,
    LastUpdatedTime as modified_at,
    domain as tenant_domain
FROM {{ source('quickbooks', 'customer') }}
WHERE Active = TRUE
