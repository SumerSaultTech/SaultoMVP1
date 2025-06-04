-- Staging table for QuickBooks transaction data
-- This model cleans and standardizes raw QuickBooks financial transaction data

SELECT 
    -- Primary identifiers
    CAST(id AS STRING) AS transaction_id,
    txn_date AS transaction_date,
    
    -- Transaction details
    doc_number AS document_number,
    UPPER(txn_type) AS transaction_type,
    
    -- Amounts and currency
    CAST(total_amt AS NUMERIC) AS total_amount,
    currency_ref_value AS currency_code,
    
    -- Line item details (for multi-line transactions)
    line_num AS line_number,
    CAST(line_amount AS NUMERIC) AS line_amount,
    line_description_value AS line_description,
    
    -- Account information
    account_ref_value AS account_id,
    account_ref_name AS account_name,
    
    -- Customer/Vendor information
    customer_ref_value AS customer_id,
    customer_ref_name AS customer_name,
    vendor_ref_value AS vendor_id,
    vendor_ref_name AS vendor_name,
    
    -- Item information
    item_ref_value AS item_id,
    item_ref_name AS item_name,
    quantity,
    unit_price,
    
    -- Tax information
    tax_code_ref_value AS tax_code,
    CAST(sales_tax_amt AS NUMERIC) AS sales_tax_amount,
    
    -- Payment and billing
    due_date,
    payment_method_ref_value AS payment_method,
    
    -- Status and classification
    CASE 
        WHEN txn_status = 'Paid' THEN 'paid'
        WHEN txn_status = 'Pending' THEN 'pending'
        WHEN txn_status = 'Voided' THEN 'voided'
        ELSE LOWER(txn_status)
    END AS transaction_status,
    
    -- Timestamps
    create_time AS created_at,
    last_updated_time AS updated_at,
    
    -- Data quality and categorization
    CASE 
        WHEN txn_type IN ('Invoice', 'SalesReceipt', 'CreditMemo') THEN 'revenue'
        WHEN txn_type IN ('Bill', 'Expense', 'Check') THEN 'expense'
        WHEN txn_type IN ('Payment', 'Deposit') THEN 'payment'
        WHEN txn_type IN ('Transfer', 'JournalEntry') THEN 'adjustment'
        ELSE 'other'
    END AS transaction_category,
    
    -- Revenue recognition
    CASE 
        WHEN txn_type IN ('Invoice', 'SalesReceipt') AND total_amt > 0 THEN total_amt
        WHEN txn_type = 'CreditMemo' AND total_amt > 0 THEN -total_amt
        ELSE 0
    END AS recognized_revenue,
    
    -- Expense recognition  
    CASE 
        WHEN txn_type IN ('Bill', 'Expense', 'Check') AND total_amt > 0 THEN total_amt
        ELSE 0
    END AS recognized_expense,
    
    -- Cash flow classification
    CASE 
        WHEN txn_type IN ('Payment', 'Deposit', 'SalesReceipt') AND total_amt > 0 THEN 'cash_in'
        WHEN txn_type IN ('Bill', 'Expense', 'Check') AND total_amt > 0 THEN 'cash_out'
        ELSE 'non_cash'
    END AS cash_flow_type,
    
    -- Data quality flags
    CASE 
        WHEN total_amt IS NOT NULL AND total_amt != 0 THEN true
        ELSE false
    END AS has_valid_amount,
    
    CASE 
        WHEN customer_ref_value IS NOT NULL OR vendor_ref_value IS NOT NULL THEN true
        ELSE false
    END AS has_counterparty,
    
    -- Fiscal period classification
    EXTRACT(YEAR FROM txn_date) AS fiscal_year,
    EXTRACT(QUARTER FROM txn_date) AS fiscal_quarter,
    EXTRACT(MONTH FROM txn_date) AS fiscal_month,
    
    -- Days calculations
    DATE_DIFF(CURRENT_DATE(), txn_date, DAY) AS days_since_transaction,
    CASE 
        WHEN due_date IS NOT NULL 
        THEN DATE_DIFF(due_date, txn_date, DAY)
        ELSE NULL
    END AS payment_terms_days

FROM raw_fivetran.quickbooks.transaction
WHERE txn_date IS NOT NULL
    AND total_amt IS NOT NULL
    AND txn_type IS NOT NULL
    -- Exclude voided transactions unless specifically needed
    AND COALESCE(txn_status, '') != 'Voided'
