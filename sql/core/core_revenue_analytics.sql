-- Core revenue analytics for executive dashboard
-- Calculates ARR, MRR, churn, and growth metrics

WITH monthly_cohorts AS (
    SELECT
        DATE_TRUNC('month', first_purchase_date) as cohort_month,
        customer_identifier,
        total_revenue,
        customer_status
    FROM {{ ref('core_customer_metrics') }}
),

revenue_by_month AS (
    SELECT
        DATE_TRUNC('month', event_date) as revenue_month,
        COUNT(DISTINCT customer_identifier) as active_customers,
        SUM(CASE WHEN event_type IN ('subscription_started', 'payment_received') THEN amount ELSE 0 END) as monthly_revenue,
        COUNT(CASE WHEN event_type = 'subscription_started' THEN 1 END) as new_subscriptions,
        COUNT(CASE WHEN event_type = 'subscription_lost' THEN 1 END) as churned_subscriptions
    FROM {{ ref('int_subscription_events') }}
    WHERE event_date >= CURRENT_DATE - INTERVAL '24 months'
    GROUP BY DATE_TRUNC('month', event_date)
),

churn_analysis AS (
    SELECT
        cohort_month,
        COUNT(DISTINCT customer_identifier) as cohort_size,
        COUNT(DISTINCT CASE WHEN customer_status = 'churned' THEN customer_identifier END) as churned_customers,
        COALESCE(
            COUNT(DISTINCT CASE WHEN customer_status = 'churned' THEN customer_identifier END) * 1.0 
            / NULLIF(COUNT(DISTINCT customer_identifier), 0),
            0
        ) as churn_rate
    FROM monthly_cohorts
    WHERE cohort_month >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY cohort_month
),

current_metrics AS (
    SELECT
        -- Current month metrics
        SUM(monthly_revenue) as current_mrr,
        SUM(monthly_revenue) * 12 as current_arr,
        SUM(active_customers) as current_active_customers,
        
        -- Growth calculations
        LAG(SUM(monthly_revenue), 1) OVER (ORDER BY revenue_month) as previous_mrr,
        (SUM(monthly_revenue) - LAG(SUM(monthly_revenue), 1) OVER (ORDER BY revenue_month)) 
        / NULLIF(LAG(SUM(monthly_revenue), 1) OVER (ORDER BY revenue_month), 0) as mrr_growth_rate
    FROM revenue_by_month
    WHERE revenue_month = DATE_TRUNC('month', CURRENT_DATE)
)

SELECT
    -- Key Revenue Metrics
    current_mrr,
    current_arr,
    current_active_customers,
    mrr_growth_rate,
    
    -- Average Revenue Per User
    current_mrr / NULLIF(current_active_customers, 0) as arpu,
    
    -- Churn Metrics
    (SELECT AVG(churn_rate) FROM churn_analysis) as avg_monthly_churn_rate,
    
    -- Customer Lifetime Value (simplified)
    (current_mrr / NULLIF(current_active_customers, 0)) 
    / NULLIF((SELECT AVG(churn_rate) FROM churn_analysis), 0) as avg_customer_ltv,
    
    -- Net Revenue Retention (mock calculation)
    1.15 as net_revenue_retention,
    
    CURRENT_TIMESTAMP as calculated_at
FROM current_metrics
LIMIT 1
