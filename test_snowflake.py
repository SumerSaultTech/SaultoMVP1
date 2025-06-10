#!/usr/bin/env python3
import os
import snowflake.connector
import json

def test_snowflake_connection():
    try:
        # Clean account identifier
        account_id = os.getenv("SNOWFLAKE_ACCOUNT", "")
        if ".snowflakecomputing.com" in account_id:
            account_id = account_id.replace(".snowflakecomputing.com", "")
        
        print(f"Connecting to Snowflake...")
        print(f"Account: {account_id}")
        print(f"Username: {os.getenv('SNOWFLAKE_USERNAME')}")
        print(f"Warehouse: {os.getenv('SNOWFLAKE_WAREHOUSE')}")
        
        conn = snowflake.connector.connect(
            user=os.getenv("SNOWFLAKE_USERNAME"),
            password=os.getenv("SNOWFLAKE_PASSWORD"),
            account=account_id,
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
            role='ACCOUNTADMIN'
        )
        
        cs = conn.cursor()
        
        # Test basic connection
        cs.execute('SELECT CURRENT_VERSION()')
        version = cs.fetchone()
        print(f"✅ Connected to Snowflake version: {version[0]}")
        
        # Check if MIAS_DATA_DB exists
        cs.execute("SHOW DATABASES LIKE 'MIAS_DATA_DB'")
        databases = cs.fetchall()
        
        if databases:
            print("✅ MIAS_DATA_DB database found")
            
            # Check schemas in MIAS_DATA_DB
            cs.execute("USE DATABASE MIAS_DATA_DB")
            cs.execute("SHOW SCHEMAS")
            schemas = cs.fetchall()
            print(f"Available schemas: {[schema[1] for schema in schemas]}")
            
            # Check if CORE schema exists and has business_metrics table
            try:
                cs.execute("USE SCHEMA CORE")
                cs.execute("SHOW TABLES LIKE 'business_metrics'")
                tables = cs.fetchall()
                
                if tables:
                    print("✅ business_metrics table found in CORE schema")
                    
                    # Show table structure
                    cs.execute("DESCRIBE TABLE business_metrics")
                    columns = cs.fetchall()
                    print("Table structure:")
                    for col in columns:
                        print(f"  - {col[0]}: {col[1]}")
                        
                    # Sample data
                    cs.execute("SELECT * FROM business_metrics LIMIT 5")
                    sample_data = cs.fetchall()
                    print(f"Sample data ({len(sample_data)} rows):")
                    for row in sample_data:
                        print(f"  {row}")
                        
                else:
                    print("❌ business_metrics table not found in CORE schema")
                    print("Available tables in CORE:")
                    cs.execute("SHOW TABLES")
                    all_tables = cs.fetchall()
                    for table in all_tables:
                        print(f"  - {table[1]}")
                        
            except Exception as schema_error:
                print(f"❌ Error accessing CORE schema: {schema_error}")
                
        else:
            print("❌ MIAS_DATA_DB database not found")
            print("Available databases:")
            cs.execute("SHOW DATABASES")
            all_dbs = cs.fetchall()
            for db in all_dbs:
                print(f"  - {db[1]}")
        
        cs.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    test_snowflake_connection()