
#!/usr/bin/env python3
"""
Script to verify dashboard data accuracy by querying Snowflake directly
"""
import snowflake.connector
import os
from datetime import datetime
import pandas as pd

def verify_dashboard_accuracy():
    """Verify the accuracy of dashboard metrics against raw Snowflake data"""
    
    # Connection setup
    account = os.getenv("SNOWFLAKE_ACCOUNT", "").replace(".snowflakecomputing.com", "")
    username = os.getenv("SNOWFLAKE_USER", "")
    token = os.getenv("SNOWFLAKE_ACCESS_TOKEN", "")
    warehouse = os.getenv("SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_LEARNING_WH")
    
    if not token:
        print("❌ SNOWFLAKE_ACCESS_TOKEN environment variable not set")
        return
    
    try:
        conn = snowflake.connector.connect(
            account=account,
            user=username,
            password=token,
            warehouse=warehouse,
            database="MIAS_DATA_DB",
            schema="CORE"
        )
        
        cursor = conn.cursor()
        
        print("🔍 VERIFYING DASHBOARD DATA ACCURACY")
        print("=" * 50)
        
        # 1. Annual Revenue Verification
        print("\n📊 ANNUAL REVENUE VERIFICATION")
        cursor.execute("""
            SELECT 
                COUNT(*) as total_records,
                MIN(INVOICE_DATE) as earliest_date,
                MAX(INVOICE_DATE) as latest_date,
                SUM(INVOICE_AMOUNT) as total_revenue,
                AVG(INVOICE_AMOUNT) as avg_invoice,
                COUNT(DISTINCT CUSTOMER_ID) as unique_customers
            FROM CORE_QUICKBOOKS_REVENUE 
            WHERE INVOICE_DATE >= '2024-01-01' 
            AND INVOICE_AMOUNT > 0
        """)
        
        revenue_stats = cursor.fetchone()
        print(f"  Total Records: {revenue_stats[0]:,}")
        print(f"  Date Range: {revenue_stats[1]} to {revenue_stats[2]}")
        print(f"  Total Revenue: ${revenue_stats[3]:,.2f}")
        print(f"  Average Invoice: ${revenue_stats[4]:,.2f}")
        print(f"  Unique Customers: {revenue_stats[5]:,}")
        
        # 2. HubSpot Deals Verification
        print("\n🤝 HUBSPOT DEALS VERIFICATION")
        cursor.execute("""
            SELECT 
                COUNT(*) as total_deals,
                MIN(CLOSE_DATE) as earliest_close,
                MAX(CLOSE_DATE) as latest_close,
                SUM(AMOUNT) as total_deal_value,
                AVG(AMOUNT) as avg_deal_size,
                COUNT(DISTINCT STAGE) as unique_stages
            FROM CORE_HUBSPOT_DEALS 
            WHERE CLOSE_DATE >= '2024-01-01' 
            AND AMOUNT > 0 
            AND STAGE = 'Closed Won'
        """)
        
        deals_stats = cursor.fetchone()
        print(f"  Total Deals: {deals_stats[0]:,}")
        print(f"  Date Range: {deals_stats[1]} to {deals_stats[2]}")
        print(f"  Total Deal Value: ${deals_stats[3]:,.2f}")
        print(f"  Average Deal Size: ${deals_stats[4]:,.2f}")
        print(f"  Unique Stages: {deals_stats[5]:,}")
        
        # 3. Expenses Verification
        print("\n💰 EXPENSES VERIFICATION")
        cursor.execute("""
            SELECT 
                COUNT(*) as total_expenses,
                MIN(EXPENSE_DATE) as earliest_expense,
                MAX(EXPENSE_DATE) as latest_expense,
                SUM(AMOUNT) as total_expenses_amount,
                AVG(AMOUNT) as avg_expense,
                COUNT(DISTINCT VENDOR_NAME) as unique_vendors
            FROM CORE_QUICKBOOKS_EXPENSES 
            WHERE EXPENSE_DATE >= '2024-01-01' 
            AND AMOUNT > 0
        """)
        
        expense_stats = cursor.fetchone()
        print(f"  Total Expense Records: {expense_stats[0]:,}")
        print(f"  Date Range: {expense_stats[1]} to {expense_stats[2]}")
        print(f"  Total Expenses: ${expense_stats[3]:,.2f}")
        print(f"  Average Expense: ${expense_stats[4]:,.2f}")
        print(f"  Unique Vendors: {expense_stats[5]:,}")
        
        # 4. Data Quality Checks
        print("\n🔍 DATA QUALITY CHECKS")
        
        # Check for duplicates in revenue
        cursor.execute("""
            SELECT COUNT(*) as duplicate_invoices
            FROM (
                SELECT INVOICE_DATE, CUSTOMER_ID, INVOICE_AMOUNT, COUNT(*) as cnt
                FROM CORE_QUICKBOOKS_REVENUE 
                WHERE INVOICE_DATE >= '2024-01-01'
                GROUP BY INVOICE_DATE, CUSTOMER_ID, INVOICE_AMOUNT
                HAVING COUNT(*) > 1
            )
        """)
        duplicates = cursor.fetchone()[0]
        print(f"  Potential Duplicate Invoices: {duplicates}")
        
        # Check for negative amounts
        cursor.execute("""
            SELECT 
                COUNT(CASE WHEN INVOICE_AMOUNT < 0 THEN 1 END) as negative_revenue,
                COUNT(CASE WHEN INVOICE_AMOUNT = 0 THEN 1 END) as zero_revenue
            FROM CORE_QUICKBOOKS_REVENUE 
            WHERE INVOICE_DATE >= '2024-01-01'
        """)
        negative_stats = cursor.fetchone()
        print(f"  Negative Revenue Records: {negative_stats[0]}")
        print(f"  Zero Revenue Records: {negative_stats[1]}")
        
        # 5. Monthly Breakdown
        print("\n📅 MONTHLY BREAKDOWN (Last 6 Months)")
        cursor.execute("""
            SELECT 
                TO_CHAR(INVOICE_DATE, 'YYYY-MM') as month,
                COUNT(*) as invoice_count,
                SUM(INVOICE_AMOUNT) as monthly_revenue
            FROM CORE_QUICKBOOKS_REVENUE 
            WHERE INVOICE_DATE >= DATEADD('month', -6, CURRENT_DATE())
            AND INVOICE_AMOUNT > 0
            GROUP BY TO_CHAR(INVOICE_DATE, 'YYYY-MM')
            ORDER BY month DESC
            LIMIT 6
        """)
        
        monthly_data = cursor.fetchall()
        for month, count, revenue in monthly_data:
            print(f"  {month}: {count:,} invoices, ${revenue:,.2f}")
        
        print("\n✅ Data verification complete!")
        print("\nTo cross-check these numbers:")
        print("1. Compare with your QuickBooks/HubSpot reports")
        print("2. Check for any missing data imports")
        print("3. Verify date ranges match your expectations")
        print("4. Look for unusual spikes or drops in monthly data")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error verifying data: {e}")

if __name__ == "__main__":
    verify_dashboard_accuracy()
