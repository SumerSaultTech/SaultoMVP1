-- Intermediate view for subscription lifecycle events
-- Tracks customer subscription changes over time

WITH salesforce_opportunities AS (
    SELECT
        opp.Id as opportunity_id,
        opp.AccountId as account_id,
        opp.Name as opportunity_name,
        opp.StageName as stage_name,
        opp.Amount as amount,
        opp.CloseDate as close_date,
        opp.CreatedDate as created_at,
        opp.IsClosed as is_closed,
        opp.IsWon as is_won,
        CASE 
            WHEN opp.IsWon = TRUE THEN 'subscription_started'
            WHEN opp.IsClosed = TRUE AND opp.IsWon = FALSE THEN 'subscription_lost'
            ELSE 'subscription_pending'
        END as event_type
    FROM {{ source('salesforce', 'opportunity') }} opp
    WHERE opp.Type IN ('New Business', 'Renewal', 'Upsell')
),

quickbooks_payments AS (
    SELECT
        pay.Id as payment_id,
        pay.CustomerRef as customer_id,
        pay.TotalAmt as amount,
        pay.TxnDate as payment_date,
        pay.CreateTime as created_at,
        'payment_received' as event_type
    FROM {{ source('quickbooks', 'payment') }} pay
    WHERE pay.TotalAmt > 0
)

SELECT
    ROW_NUMBER() OVER (ORDER BY event_date) as event_id,
    customer_identifier,
    event_type,
    amount,
    event_date,
    created_at,
    source_system,
    metadata
FROM (
    -- Salesforce subscription events
    SELECT
        account_id as customer_identifier,
        event_type,
        amount,
        COALESCE(close_date, created_at) as event_date,
        created_at,
        'salesforce' as source_system,
        JSON_OBJECT(
            'opportunity_id', opportunity_id,
            'opportunity_name', opportunity_name,
            'stage_name', stage_name
        ) as metadata
    FROM salesforce_opportunities
    
    UNION ALL
    
    -- QuickBooks payment events
    SELECT
        customer_id as customer_identifier,
        event_type,
        amount,
        payment_date as event_date,
        created_at,
        'quickbooks' as source_system,
        JSON_OBJECT(
            'payment_id', payment_id
        ) as metadata
    FROM quickbooks_payments
)
ORDER BY event_date DESC
