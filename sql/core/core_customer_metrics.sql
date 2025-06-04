-- Core customer metrics for business intelligence
-- Calculates key customer KPIs and health scores

WITH customer_base AS (
    SELECT DISTINCT
        customer_identifier,
        MIN(event_date) as first_purchase_date,
        MAX(event_date) as last_activity_date,
        COUNT(CASE WHEN event_type = 'subscription_started' THEN 1 END) as subscription_count,
        COUNT(CASE WHEN event_type = 'payment_received' THEN 1 END) as payment_count,
        SUM(CASE WHEN event_type IN ('subscription_started', 'payment_received') THEN amount ELSE 0 END) as total_revenue,
        AVG(CASE WHEN event_type IN ('subscription_started', 'payment_received') THEN amount ELSE 0 END) as avg_transaction_value
    FROM {{ ref('int_subscription_events') }}
    GROUP BY customer_identifier
),

customer_segments AS (
    SELECT
        customer_identifier,
        first_purchase_date,
        last_activity_date,
        subscription_count,
        payment_count,
        total_revenue,
        avg_transaction_value,
        DATEDIFF('day', first_purchase_date, CURRENT_DATE) as customer_age_days,
        DATEDIFF('day', last_activity_date, CURRENT_DATE) as days_since_last_activity,
        CASE
            WHEN total_revenue >= 10000 THEN 'enterprise'
            WHEN total_revenue >= 1000 THEN 'mid_market'
            WHEN total_revenue >= 100 THEN 'small_business'
            ELSE 'starter'
        END as customer_segment,
        CASE
            WHEN DATEDIFF('day', last_activity_date, CURRENT_DATE) <= 30 THEN 'active'
            WHEN DATEDIFF('day', last_activity_date, CURRENT_DATE) <= 90 THEN 'at_risk'
            ELSE 'churned'
        END as customer_status
    FROM customer_base
)

SELECT
    customer_identifier,
    first_purchase_date,
    last_activity_date,
    customer_age_days,
    days_since_last_activity,
    subscription_count,
    payment_count,
    total_revenue,
    avg_transaction_value,
    customer_segment,
    customer_status,
    CASE
        WHEN customer_status = 'active' AND total_revenue > avg_transaction_value * 1.5 THEN 95
        WHEN customer_status = 'active' THEN 85
        WHEN customer_status = 'at_risk' THEN 45
        ELSE 15
    END as health_score,
    total_revenue / NULLIF(customer_age_days, 0) * 365 as annualized_revenue,
    CURRENT_TIMESTAMP as calculated_at
FROM customer_segments
ORDER BY total_revenue DESC
