-- Intermediate model for revenue cohort analysis
-- This model creates monthly revenue cohorts and tracks retention patterns

WITH quickbooks_revenue AS (
    SELECT 
        transaction_date,
        customer_id,
        customer_name,
        recognized_revenue,
        transaction_type,
        fiscal_year,
        fiscal_quarter,
        fiscal_month
    FROM {{ ref('stg_quickbooks_transactions') }}
    WHERE recognized_revenue > 0
        AND transaction_status NOT IN ('voided', 'deleted')
        AND customer_id IS NOT NULL
),

-- Calculate first purchase date for each customer
customer_first_purchase AS (
    SELECT 
        customer_id,
        customer_name,
        MIN(transaction_date) AS first_purchase_date,
        DATE_TRUNC(MIN(transaction_date), MONTH) AS cohort_month,
        SUM(recognized_revenue) AS total_lifetime_revenue,
        COUNT(DISTINCT transaction_date) AS total_purchase_days,
        COUNT(*) AS total_transactions
    FROM quickbooks_revenue
    GROUP BY customer_id, customer_name
),

-- Monthly revenue by customer
monthly_customer_revenue AS (
    SELECT 
        customer_id,
        customer_name,
        DATE_TRUNC(transaction_date, MONTH) AS revenue_month,
        SUM(recognized_revenue) AS monthly_revenue,
        COUNT(*) AS monthly_transactions,
        MAX(transaction_date) AS last_transaction_date
    FROM quickbooks_revenue
    GROUP BY customer_id, customer_name, DATE_TRUNC(transaction_date, MONTH)
),

-- Calculate period numbers (months since first purchase)
customer_monthly_periods AS (
    SELECT 
        mcr.customer_id,
        mcr.customer_name,
        cfp.cohort_month,
        cfp.first_purchase_date,
        mcr.revenue_month,
        mcr.monthly_revenue,
        mcr.monthly_transactions,
        
        -- Calculate period number (0 = acquisition month, 1 = first retention month, etc.)
        DATE_DIFF(mcr.revenue_month, cfp.cohort_month, MONTH) AS period_number,
        
        -- Customer lifetime metrics
        cfp.total_lifetime_revenue,
        cfp.total_purchase_days,
        cfp.total_transactions
        
    FROM monthly_customer_revenue mcr
    JOIN customer_first_purchase cfp 
        ON mcr.customer_id = cfp.customer_id
),

-- Cohort size and revenue metrics
cohort_metrics AS (
    SELECT 
        cohort_month,
        period_number,
        
        -- Customer metrics
        COUNT(DISTINCT customer_id) AS customers_in_period,
        COUNT(DISTINCT CASE WHEN period_number = 0 THEN customer_id END) AS cohort_size,
        
        -- Revenue metrics
        SUM(monthly_revenue) AS period_revenue,
        AVG(monthly_revenue) AS avg_revenue_per_customer,
        
        -- Calculate retention rate
        SAFE_DIVIDE(
            COUNT(DISTINCT customer_id),
            FIRST_VALUE(COUNT(DISTINCT customer_id)) OVER (
                PARTITION BY cohort_month 
                ORDER BY period_number 
                ROWS UNBOUNDED PRECEDING
            )
        ) AS retention_rate,
        
        -- Calculate cumulative metrics
        SUM(SUM(monthly_revenue)) OVER (
            PARTITION BY cohort_month 
            ORDER BY period_number 
            ROWS UNBOUNDED PRECEDING
        ) AS cumulative_revenue,
        
        -- Revenue retention ($ retained vs cohort's initial revenue)
        SAFE_DIVIDE(
            SUM(monthly_revenue),
            FIRST_VALUE(SUM(monthly_revenue)) OVER (
                PARTITION BY cohort_month 
                ORDER BY period_number 
                ROWS UNBOUNDED PRECEDING
            )
        ) AS revenue_retention_rate
        
    FROM customer_monthly_periods
    GROUP BY cohort_month, period_number
),

-- Calculate LTV metrics by cohort
cohort_ltv AS (
    SELECT 
        cohort_month,
        
        -- Cohort characteristics
        COUNT(DISTINCT customer_id) AS cohort_size,
        MIN(first_purchase_date) AS cohort_start_date,
        MAX(revenue_month) AS cohort_last_activity,
        
        -- Revenue metrics
        SUM(total_lifetime_revenue) AS cohort_total_revenue,
        AVG(total_lifetime_revenue) AS avg_customer_ltv,
        STDDEV(total_lifetime_revenue) AS ltv_std_dev,
        
        -- Percentile LTV analysis
        APPROX_QUANTILES(total_lifetime_revenue, 10)[OFFSET(5)] AS median_ltv,
        APPROX_QUANTILES(total_lifetime_revenue, 10)[OFFSET(7)] AS p75_ltv,
        APPROX_QUANTILES(total_lifetime_revenue, 10)[OFFSET(9)] AS p90_ltv,
        
        -- Activity metrics
        AVG(total_purchase_days) AS avg_active_days,
        AVG(total_transactions) AS avg_transactions_per_customer,
        
        -- Calculate payback period (months to recover avg acquisition cost)
        -- Assuming average acquisition cost is 20% of first-period revenue
        SAFE_DIVIDE(
            AVG(total_lifetime_revenue) * 0.2,
            AVG(total_lifetime_revenue) / AVG(total_purchase_days / 30.44)
        ) AS estimated_payback_months
        
    FROM customer_monthly_periods
    WHERE period_number = 0  -- Only look at acquisition month data for LTV calc
    GROUP BY cohort_month
)

-- Final output combining cohort analysis with LTV metrics
SELECT 
    cm.cohort_month,
    cm.period_number,
    
    -- Cohort identification
    FORMAT_DATE('%Y-%m', cm.cohort_month) AS cohort_label,
    CASE 
        WHEN cm.period_number = 0 THEN 'M0 (Acquisition)'
        ELSE CONCAT('M', cm.period_number, ' (Retention)')
    END AS period_label,
    
    -- Customer metrics
    cm.customers_in_period,
    FIRST_VALUE(cm.customers_in_period) OVER (
        PARTITION BY cm.cohort_month 
        ORDER BY cm.period_number
        ROWS UNBOUNDED PRECEDING
    ) AS cohort_size,
    cm.retention_rate,
    
    -- Revenue metrics
    cm.period_revenue,
    cm.avg_revenue_per_customer,
    cm.cumulative_revenue,
    cm.revenue_retention_rate,
    
    -- LTV metrics (only for M0)
    CASE WHEN cm.period_number = 0 THEN ltv.avg_customer_ltv END AS cohort_avg_ltv,
    CASE WHEN cm.period_number = 0 THEN ltv.median_ltv END AS cohort_median_ltv,
    CASE WHEN cm.period_number = 0 THEN ltv.estimated_payback_months END AS estimated_payback_months,
    
    -- Performance indicators
    CASE 
        WHEN cm.retention_rate >= 0.8 THEN 'excellent'
        WHEN cm.retention_rate >= 0.6 THEN 'good'
        WHEN cm.retention_rate >= 0.4 THEN 'average'
        ELSE 'poor'
    END AS retention_performance,
    
    CASE 
        WHEN cm.revenue_retention_rate >= 1.0 THEN 'expansion'
        WHEN cm.revenue_retention_rate >= 0.8 THEN 'stable'
        WHEN cm.revenue_retention_rate >= 0.6 THEN 'declining'
        ELSE 'churning'
    END AS revenue_performance,
    
    -- Trends and insights
    LAG(cm.retention_rate) OVER (
        PARTITION BY cm.cohort_month 
        ORDER BY cm.period_number
    ) AS prev_retention_rate,
    
    cm.retention_rate - LAG(cm.retention_rate) OVER (
        PARTITION BY cm.cohort_month 
        ORDER BY cm.period_number
    ) AS retention_rate_change,
    
    -- Time-based classifications
    DATE_DIFF(CURRENT_DATE(), cm.cohort_month, MONTH) AS months_since_cohort_start,
    
    CASE 
        WHEN DATE_DIFF(CURRENT_DATE(), cm.cohort_month, MONTH) <= 3 THEN 'new_cohort'
        WHEN DATE_DIFF(CURRENT_DATE(), cm.cohort_month, MONTH) <= 12 THEN 'maturing_cohort'
        ELSE 'mature_cohort'
    END AS cohort_maturity,
    
    CURRENT_TIMESTAMP() AS processed_at

FROM cohort_metrics cm
LEFT JOIN cohort_ltv ltv 
    ON cm.cohort_month = ltv.cohort_month
WHERE cm.cohort_size >= 5  -- Only include cohorts with at least 5 customers
ORDER BY cm.cohort_month, cm.period_number
