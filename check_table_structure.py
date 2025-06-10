#!/usr/bin/env python3
import os
import snowflake.connector
import json

def check_table_structure():
    try:
        account_id = os.getenv("SNOWFLAKE_ACCOUNT", "")
        if ".snowflakecomputing.com" in account_id:
            account_id = account_id.replace(".snowflakecomputing.com", "")
        
        conn = snowflake.connector.connect(
            account=account_id,
            user=os.getenv("SNOWFLAKE_USERNAME"),
            password=os.getenv("SNOWFLAKE_PASSWORD"),
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
            database='MIAS_DATA_DB',
            schema='CORE',
            role='ACCOUNTADMIN'
        )
        
        cursor = conn.cursor()
        
        tables = ['CORE_QUICKBOOKS_REVENUE', 'CORE_QUICKBOOKS_EXPENSES', 'CORE_HUBSPOT_DEALS']
        
        for table in tables:
            print(f"\n=== {table} ===")
            try:
                # Get column info
                cursor.execute(f"DESCRIBE TABLE {table}")
                columns = cursor.fetchall()
                print("Columns:")
                for col in columns:
                    print(f"  {col[0]}: {col[1]}")
                
                # Get sample data
                cursor.execute(f"SELECT * FROM {table} LIMIT 3")
                sample_data = cursor.fetchall()
                print(f"\nSample data ({len(sample_data)} rows):")
                for i, row in enumerate(sample_data):
                    print(f"  Row {i+1}: {row}")
                    
            except Exception as table_error:
                print(f"Error accessing {table}: {table_error}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Connection error: {e}")

if __name__ == "__main__":
    check_table_structure()