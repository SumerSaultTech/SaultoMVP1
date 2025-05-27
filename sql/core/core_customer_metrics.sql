-- Core customer metrics combining lifecycle, revenue, and engagement data
-- This model provides a comprehensive view of customer performance and health

WITH customer_base AS (
    SELECT 
        customer_key,
        account_id,
        account_name,
        contact_id,
        email,
        first_name,
        last_name,
        job_title,
        annual_revenue,
        employee_count,
        revenue_segment,
        company_size,
        current_stage,
        engagement_score,
        revenue_potential_score,
        total_lead_score,
        lead_temperature,
        activity_status,
        first_touch_date,
        last_activity_date,
        days_since_first_touch,
        days_since_last_activity,
        record_type
    FROM {{ ref('int_customer_lifecycle') }}
),

customer_revenue AS (
    SELECT 
        customer_id,
        customer_name,
        cohort_month,
        first_purchase_date,
        total_lifetime_revenue,
        total_purchase_days,
        total_transactions,
        
        -- Calculate average purchase metrics
        SAFE_DIVIDE(total_lifetime_revenue, total_transactions) AS avg_order_value,
        SAFE_DIVIDE(total_purchase_days, 30.44) AS customer_lifetime_months,
        SAFE_DIVIDE(total_lifetime_revenue, total_purchase_days / 30.44) AS monthly_revenue_rate,
        
        -- Customer value classification
        NTILE(5) OVER (ORDER BY total_lifetime_revenue) AS revenue_quintile,
        NTILE(10) OVER (ORDER BY total_lifetime_revenue) AS revenue_decile
        
    FROM {{ ref('int_revenue_cohorts') }}
    WHERE period_number = 0  -- Only cohort acquisition data
),

-- Get latest cohort data for each customer
latest_cohort_data AS (
    SELECT 
        cohort_month,
        MAX(period_number) AS latest_period,
        AVG(retention_rate) AS current_retention_rate,
        AVG(revenue_retention_rate) AS current_revenue_retention,
        cohort_maturity,
        retention_performance,
        revenue_performance
    FROM {{ ref('int_revenue_cohorts') }}
    GROUP BY cohort_month, cohort_maturity, retention_performance, revenue_performance
),

-- Match customers with their Salesforce account data
customer_matching AS (
    SELECT 
        cb.*,
        
        -- Revenue data (matched by customer name approximation)
        cr.cohort_month,
        cr.first_purchase_date,
        cr.total_lifetime_revenue,
        cr.total_purchase_days,
        cr.total_transactions,
        cr.avg_order_value,
        cr.customer_lifetime_months,
        cr.monthly_revenue_rate,
        cr.revenue_quintile,
        cr.revenue_decile,
        
        -- Cohort performance
        lcd.current_retention_rate,
        lcd.current_revenue_retention,
        lcd.cohort_maturity,
        lcd.retention_performance,
        lcd.revenue_performance,
        
        -- Determine customer status
        CASE 
            WHEN cr.customer_id IS NOT NULL THEN 'paying_customer'
            WHEN cb.current_stage = 'customer' THEN 'customer_unmatched'
            WHEN cb.current_stage IN ('sales_qualified', 'opportunity') THEN 'sales_qualified_lead'
            WHEN cb.current_stage = 'marketing_qualified' THEN 'marketing_qualified_lead'
            ELSE 'prospect'
        END AS customer_status
        
    FROM customer_base cb
    LEFT JOIN customer_revenue cr 
        ON LOWER(TRIM(cb.account_name)) = LOWER(TRIM(cr.customer_name))
    LEFT JOIN latest_cohort_data lcd 
        ON cr.cohort_month = lcd.cohort_month
)

SELECT 
    -- Customer identification
    customer_key,
    account_id,
    account_name,
    contact_id,
    email,
    CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, '')) AS full_name,
    job_title,
    customer_status,
    
    -- Company firmographics
    annual_revenue,
    employee_count,
    revenue_segment,
    company_size,
    
    -- Customer journey and engagement
    current_stage,
    engagement_score,
    revenue_potential_score,
    total_lead_score,
    lead_temperature,
    activity_status,
    
    -- Revenue metrics
    COALESCE(total_lifetime_revenue, 0) AS lifetime_value,
    COALESCE(avg_order_value, 0) AS average_order_value,
    COALESCE(total_transactions, 0) AS total_orders,
    COALESCE(monthly_revenue_rate, 0) AS monthly_revenue_rate,
    COALESCE(customer_lifetime_months, 0) AS customer_age_months,
    
    -- Customer value classification
    CASE 
        WHEN total_lifetime_revenue >= 50000 THEN 'high_value'
        WHEN total_lifetime_revenue >= 10000 THEN 'medium_value'
        WHEN total_lifetime_revenue > 0 THEN 'low_value'
        ELSE 'no_revenue'
    END AS value_segment,
    
    COALESCE(revenue_quintile, 0) AS revenue_quintile,
    COALESCE(revenue_decile, 0) AS revenue_decile,
    
    -- Timeline metrics
    first_touch_date,
    last_activity_date,
    first_purchase_date,
    cohort_month,
    days_since_first_touch,
    days_since_last_activity,
    
    -- Customer health and risk indicators
    CASE 
        WHEN customer_status = 'paying_customer' AND days_since_last_activity > 90 THEN 'at_risk'
        WHEN customer_status = 'paying_customer' AND monthly_revenue_rate > 0 THEN 'healthy'
        WHEN customer_status LIKE '%qualified%' AND days_since_last_activity <= 30 THEN 'engaged_prospect'
        WHEN customer_status LIKE '%qualified%' AND days_since_last_activity > 60 THEN 'stale_lead'
        ELSE 'monitoring'
    END AS health_status,
    
    -- Cohort performance indicators
    COALESCE(current_retention_rate, 0) AS cohort_retention_rate,
    COALESCE(current_revenue_retention, 0) AS cohort_revenue_retention,
    COALESCE(cohort_maturity, 'unknown') AS cohort_maturity,
    COALESCE(retention_performance, 'unknown') AS retention_performance,
    COALESCE(revenue_performance, 'unknown') AS revenue_performance,
    
    -- Calculated KPIs
    CASE 
        WHEN customer_lifetime_months > 0 
        THEN total_lifetime_revenue / customer_lifetime_months
        ELSE 0
    END AS calculated_monthly_value,
    
    CASE 
        WHEN total_transactions > 0 
        THEN customer_lifetime_months / total_transactions
        ELSE 0
    END AS avg_months_between_purchases,
    
    -- Lead scoring for non-customers
    CASE 
        WHEN customer_status = 'paying_customer' THEN 1000  -- Highest priority
        WHEN total_lead_score >= 150 THEN 900
        WHEN total_lead_score >= 100 THEN 800
        WHEN current_stage IN ('sales_qualified', 'opportunity') THEN 700
        WHEN current_stage = 'marketing_qualified' THEN 600
        ELSE 500
    END AS priority_score,
    
    -- Recommended actions
    CASE 
        WHEN customer_status = 'paying_customer' AND health_status = 'at_risk' 
        THEN 'retention_campaign'
        WHEN customer_status LIKE '%qualified%' AND days_since_last_activity <= 7 
        THEN 'immediate_follow_up'
        WHEN customer_status LIKE '%qualified%' AND days_since_last_activity <= 30 
        THEN 'nurture_sequence'
        WHEN lead_temperature = 'hot' 
        THEN 'sales_outreach'
        WHEN activity_status = 'dormant' 
        THEN 'reactivation_campaign'
        ELSE 'standard_nurture'
    END AS recommended_action,
    
    -- Data source attribution
    record_type,
    
    -- Flags for data quality
    CASE WHEN email IS NOT NULL THEN true ELSE false END AS has_email,
    CASE WHEN account_id IS NOT NULL THEN true ELSE false END AS has_salesforce_record,
    CASE WHEN total_lifetime_revenue > 0 THEN true ELSE false END AS has_revenue_data,
    CASE WHEN annual_revenue IS NOT NULL THEN true ELSE false END AS has_firmographic_data,
    
    CURRENT_TIMESTAMP() AS last_updated

FROM customer_matching
WHERE account_name IS NOT NULL  -- Exclude records without company names
ORDER BY priority_score DESC, total_lifetime_revenue DESC
