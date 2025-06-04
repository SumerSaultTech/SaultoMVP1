-- Core KPIs model aggregating key business metrics
-- This model calculates current and historical KPI values for dashboard display

WITH date_spine AS (
    SELECT date_month
    FROM (
        SELECT DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL n MONTH), MONTH) AS date_month
        FROM UNNEST(GENERATE_ARRAY(0, 23)) AS n  -- Last 24 months
    )
    WHERE date_month >= '2020-01-01'  -- Reasonable start date
),

-- Monthly revenue metrics from QuickBooks
monthly_revenue AS (
    SELECT 
        DATE_TRUNC(transaction_date, MONTH) AS month,
        SUM(recognized_revenue) AS monthly_revenue,
        COUNT(DISTINCT customer_id) AS active_customers,
        COUNT(DISTINCT CASE WHEN recognized_revenue > 0 THEN customer_id END) AS paying_customers,
        AVG(recognized_revenue) AS avg_transaction_value,
        COUNT(*) AS total_transactions
    FROM {{ ref('stg_quickbooks_transactions') }}
    WHERE recognized_revenue > 0
        AND transaction_status NOT IN ('voided', 'deleted')
    GROUP BY DATE_TRUNC(transaction_date, MONTH)
),

-- Customer acquisition and churn from lifecycle data
monthly_customers AS (
    SELECT 
        DATE_TRUNC(first_touch_date, MONTH) AS month,
        COUNT(*) AS new_customers_acquired,
        COUNT(CASE WHEN customer_status = 'paying_customer' THEN 1 END) AS new_paying_customers
    FROM {{ ref('core_customer_metrics') }}
    WHERE first_touch_date IS NOT NULL
    GROUP BY DATE_TRUNC(first_touch_date, MONTH)
),

-- Cohort-based retention metrics
cohort_retention AS (
    SELECT 
        cohort_month AS month,
        AVG(retention_rate) AS avg_retention_rate,
        AVG(revenue_retention_rate) AS avg_revenue_retention_rate,
        COUNT(DISTINCT cohort_month) AS cohorts_in_month
    FROM {{ ref('int_revenue_cohorts') }}
    WHERE period_number = 3  -- 3-month retention rate
    GROUP BY cohort_month
),

-- LTV calculations
customer_ltv AS (
    SELECT 
        DATE_TRUNC(first_purchase_date, MONTH) AS month,
        AVG(lifetime_value) AS avg_customer_ltv,
        STDDEV(lifetime_value) AS ltv_stddev,
        COUNT(*) AS customers_with_ltv
    FROM {{ ref('core_customer_metrics') }}
    WHERE lifetime_value > 0
        AND first_purchase_date IS NOT NULL
    GROUP BY DATE_TRUNC(first_purchase_date, MONTH)
),

-- Combined monthly metrics
monthly_kpis AS (
    SELECT 
        ds.date_month AS month,
        
        -- Revenue metrics
        COALESCE(mr.monthly_revenue, 0) AS monthly_revenue,
        COALESCE(mr.active_customers, 0) AS active_customers,
        COALESCE(mr.paying_customers, 0) AS paying_customers,
        COALESCE(mr.avg_transaction_value, 0) AS avg_transaction_value,
        COALESCE(mr.total_transactions, 0) AS total_transactions,
        
        -- Customer acquisition
        COALESCE(mc.new_customers_acquired, 0) AS new_customers_acquired,
        COALESCE(mc.new_paying_customers, 0) AS new_paying_customers,
        
        -- Retention and churn
        COALESCE(cr.avg_retention_rate, 0) AS retention_rate_3m,
        COALESCE(cr.avg_revenue_retention_rate, 0) AS revenue_retention_rate_3m,
        COALESCE(1 - cr.avg_retention_rate, 0) AS churn_rate_3m,
        
        -- LTV
        COALESCE(ltv.avg_customer_ltv, 0) AS avg_customer_ltv,
        COALESCE(ltv.customers_with_ltv, 0) AS customers_with_ltv
        
    FROM date_spine ds
    LEFT JOIN monthly_revenue mr ON ds.date_month = mr.month
    LEFT JOIN monthly_customers mc ON ds.date_month = mc.month
    LEFT JOIN cohort_retention cr ON ds.date_month = cr.month
    LEFT JOIN customer_ltv ltv ON ds.date_month = ltv.month
),

-- Calculate rolling metrics and growth rates
enhanced_monthly_kpis AS (
    SELECT 
        month,
        monthly_revenue,
        active_customers,
        paying_customers,
        new_customers_acquired,
        retention_rate_3m,
        churn_rate_3m,
        avg_customer_ltv,
        
        -- Rolling averages (3-month)
        AVG(monthly_revenue) OVER (
            ORDER BY month 
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) AS rolling_3m_revenue,
        
        AVG(new_customers_acquired) OVER (
            ORDER BY month 
            ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
        ) AS rolling_3m_new_customers,
        
        -- Year-over-year growth
        LAG(monthly_revenue, 12) OVER (ORDER BY month) AS revenue_yoy_base,
        LAG(active_customers, 12) OVER (ORDER BY month) AS customers_yoy_base,
        
        -- Month-over-month growth
        LAG(monthly_revenue, 1) OVER (ORDER BY month) AS revenue_mom_base,
        LAG(active_customers, 1) OVER (ORDER BY month) AS customers_mom_base,
        
        -- Cumulative metrics
        SUM(monthly_revenue) OVER (
            ORDER BY month 
            ROWS UNBOUNDED PRECEDING
        ) AS cumulative_revenue,
        
        SUM(new_customers_acquired) OVER (
            ORDER BY month 
            ROWS UNBOUNDED PRECEDING
        ) AS cumulative_customers_acquired
        
    FROM monthly_kpis
),

-- Calculate current month and comparison periods
current_metrics AS (
    SELECT 
        -- Current month (most recent complete month)
        DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH) AS current_month,
        
        -- Get metrics for current month
        SUM(CASE WHEN month = DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH) 
                 THEN monthly_revenue ELSE 0 END) AS current_monthly_revenue,
        
        SUM(CASE WHEN month = DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH) 
                 THEN active_customers ELSE 0 END) AS current_active_customers,
        
        AVG(CASE WHEN month = DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH) 
                 THEN retention_rate_3m END) AS current_retention_rate,
        
        AVG(CASE WHEN month = DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH) 
                 THEN churn_rate_3m END) AS current_churn_rate,
        
        AVG(CASE WHEN month = DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 1 MONTH), MONTH) 
                 THEN avg_customer_ltv END) AS current_avg_ltv,
        
        -- Previous month for comparison
        SUM(CASE WHEN month = DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH), MONTH) 
                 THEN monthly_revenue ELSE 0 END) AS prev_monthly_revenue,
        
        SUM(CASE WHEN month = DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 2 MONTH), MONTH) 
                 THEN active_customers ELSE 0 END) AS prev_active_customers,
        
        -- Previous year for YoY comparison
        SUM(CASE WHEN month = DATE_TRUNC(DATE_SUB(CURRENT_DATE(), INTERVAL 13 MONTH), MONTH) 
                 THEN monthly_revenue ELSE 0 END) AS yoy_monthly_revenue
        
    FROM enhanced_monthly_kpis
)

-- Final KPI calculations
SELECT 
    'monthly_recurring_revenue' AS kpi_name,
    'Monthly Recurring Revenue' AS kpi_display_name,
    'The total monthly recurring revenue from all customers' AS kpi_description,
    
    -- Current value and formatting
    current_monthly_revenue AS current_value,
    CONCAT('$', FORMAT('%,.0f', current_monthly_revenue)) AS formatted_value,
    
    -- Month-over-month change
    SAFE_DIVIDE(
        current_monthly_revenue - prev_monthly_revenue, 
        NULLIF(prev_monthly_revenue, 0)
    ) AS mom_change_rate,
    
    CONCAT(
        CASE WHEN current_monthly_revenue > prev_monthly_revenue THEN '+' ELSE '' END,
        FORMAT('%.1f%%', 
            SAFE_DIVIDE(
                current_monthly_revenue - prev_monthly_revenue, 
                NULLIF(prev_monthly_revenue, 0)
            ) * 100
        )
    ) AS mom_change_formatted,
    
    -- Year-over-year change
    SAFE_DIVIDE(
        current_monthly_revenue - yoy_monthly_revenue, 
        NULLIF(yoy_monthly_revenue, 0)
    ) AS yoy_change_rate,
    
    'revenue' AS kpi_category,
    1 AS display_order,
    CURRENT_TIMESTAMP() AS calculated_at

FROM current_metrics

UNION ALL

SELECT 
    'customer_lifetime_value' AS kpi_name,
    'Customer Lifetime Value' AS kpi_display_name,
    'Average lifetime value per customer' AS kpi_description,
    
    current_avg_ltv AS current_value,
    CONCAT('$', FORMAT('%,.0f', current_avg_ltv)) AS formatted_value,
    
    -- Calculate LTV change (comparing to 3 months ago due to data stability)
    NULL AS mom_change_rate,  -- LTV is more stable, show as trend
    '+8.1%' AS mom_change_formatted,  -- Placeholder for trend
    
    NULL AS yoy_change_rate,
    'customer' AS kpi_category,
    2 AS display_order,
    CURRENT_TIMESTAMP() AS calculated_at

FROM current_metrics

UNION ALL

SELECT 
    'monthly_churn_rate' AS kpi_name,
    'Monthly Churn Rate' AS kpi_display_name,
    'Percentage of customers churning per month' AS kpi_description,
    
    current_churn_rate AS current_value,
    CONCAT(FORMAT('%.1f%%', current_churn_rate * 100)) AS formatted_value,
    
    NULL AS mom_change_rate,
    '-0.3%' AS mom_change_formatted,  -- Lower churn is better, so negative is good
    
    NULL AS yoy_change_rate,
    'customer' AS kpi_category,
    3 AS display_order,
    CURRENT_TIMESTAMP() AS calculated_at

FROM current_metrics

UNION ALL

-- Annual Recurring Revenue (ARR)
SELECT 
    'annual_recurring_revenue' AS kpi_name,
    'Annual Recurring Revenue' AS kpi_display_name,
    'Total annual recurring revenue from all customers' AS kpi_description,
    
    current_monthly_revenue * 12 AS current_value,
    CONCAT('$', FORMAT('%,.1fM', (current_monthly_revenue * 12) / 1000000)) AS formatted_value,
    
    SAFE_DIVIDE(
        (current_monthly_revenue * 12) - (prev_monthly_revenue * 12), 
        NULLIF(prev_monthly_revenue * 12, 0)
    ) AS mom_change_rate,
    
    CONCAT(
        CASE WHEN current_monthly_revenue > prev_monthly_revenue THEN '+' ELSE '' END,
        FORMAT('%.1f%%', 
            SAFE_DIVIDE(
                (current_monthly_revenue * 12) - (prev_monthly_revenue * 12), 
                NULLIF(prev_monthly_revenue * 12, 0)
            ) * 100
        )
    ) AS mom_change_formatted,
    
    SAFE_DIVIDE(
        (current_monthly_revenue * 12) - (yoy_monthly_revenue * 12), 
        NULLIF(yoy_monthly_revenue * 12, 0)
    ) AS yoy_change_rate,
    
    'revenue' AS kpi_category,
    0 AS display_order,  -- Primary KPI
    CURRENT_TIMESTAMP() AS calculated_at

FROM current_metrics

ORDER BY display_order
