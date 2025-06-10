#!/usr/bin/env python3
import os
import sys
import json
import snowflake.connector
from decimal import Decimal
from datetime import datetime, date

def get_real_metrics_data(time_view='Monthly View'):
    try:
        # Connect to Snowflake
        account_id = os.getenv("SNOWFLAKE_ACCOUNT", "")
        if ".snowflakecomputing.com" in account_id:
            account_id = account_id.replace(".snowflakecomputing.com", "")
        
        conn = snowflake.connector.connect(
            account=account_id,
            user=os.getenv("SNOWFLAKE_USERNAME"),
            password=os.getenv("SNOWFLAKE_PASSWORD"),
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_LEARNING_WH"),
            database='MIAS_DATA_DB',
            schema='CORE',
            timeout=30
        )
        
        cursor = conn.cursor()
        
        # Define date filters based on time view
        date_filter = {
            'Daily View': "DATE(TXNDATE) >= CURRENT_DATE - INTERVAL '30 DAYS'",
            'Weekly View': "DATE(TXNDATE) >= CURRENT_DATE - INTERVAL '12 WEEKS'", 
            'Monthly View': "DATE(TXNDATE) >= CURRENT_DATE - INTERVAL '12 MONTHS'",
            'Yearly View': "DATE(TXNDATE) >= CURRENT_DATE - INTERVAL '5 YEARS'"
        }.get(time_view, "DATE(TXNDATE) >= CURRENT_DATE - INTERVAL '12 MONTHS'")
        
        deal_date_filter = date_filter.replace('TXNDATE', 'CLOSEDATE')
        
        # Query real revenue from QuickBooks
        revenue_query = f"""
        SELECT 
            'revenue' as metric_type,
            COALESCE(SUM(AMOUNT), 0) as actual_value,
            80000 as goal_value
        FROM CORE_QUICKBOOKS_REVENUE
        WHERE {date_filter}
        """
        
        # Query real expenses from QuickBooks  
        expenses_query = f"""
        SELECT 
            'expenses' as metric_type,
            COALESCE(SUM(ABS(AMOUNT)), 0) as actual_value,
            50000 as goal_value
        FROM CORE_QUICKBOOKS_EXPENSES
        WHERE {date_filter}
        """
        
        # Query deals from HubSpot for ARR calculation
        arr_query = f"""
        SELECT 
            'arr' as metric_type,
            COALESCE(SUM(AMOUNT), 0) * 12 as actual_value,
            2400000 as goal_value
        FROM CORE_HUBSPOT_DEALS
        WHERE DEALSTAGE = 'closedwon' 
        AND {deal_date_filter}
        """
        
        # Query MRR from HubSpot deals
        mrr_query = f"""
        SELECT 
            'mrr' as metric_type,
            COALESCE(SUM(AMOUNT), 0) as actual_value,
            200000 as goal_value
        FROM CORE_HUBSPOT_DEALS
        WHERE DEALSTAGE = 'closedwon' 
        AND {deal_date_filter}
        """
        
        all_metrics = []
        
        # Execute all queries
        for query in [revenue_query, expenses_query, arr_query, mrr_query]:
            cursor.execute(query)
            result = cursor.fetchone()
            if result:
                all_metrics.append({
                    'metric_type': result[0],
                    'actual_value': float(result[1]) if result[1] else 0,
                    'goal_value': float(result[2]) if result[2] else 0
                })
        
        # Calculate profit from revenue - expenses
        revenue_actual = next((m['actual_value'] for m in all_metrics if m['metric_type'] == 'revenue'), 0)
        expenses_actual = next((m['actual_value'] for m in all_metrics if m['metric_type'] == 'expenses'), 0)
        
        all_metrics.append({
            'metric_type': 'profit',
            'actual_value': revenue_actual - expenses_actual,
            'goal_value': 30000
        })
        
        cursor.close()
        conn.close()
        
        # Convert to expected format
        metrics_dict = {
            'timeView': time_view
        }
        
        for metric in all_metrics:
            metrics_dict[metric['metric_type']] = {
                'actual': metric['actual_value'],
                'goal': metric['goal_value']
            }
        
        result = {
            "success": True,
            "data": metrics_dict
        }
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    time_view = sys.argv[1] if len(sys.argv) > 1 else 'Monthly View'
    get_real_metrics_data(time_view)