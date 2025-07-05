
#!/usr/bin/env python3
import os
import snowflake.connector
import json

def check_snowflake_access():
    try:
        # Get connection parameters from environment
        account = os.getenv("SNOWFLAKE_ACCOUNT", "").replace(".snowflakecomputing.com", "")
        username = os.getenv("SNOWFLAKE_USER", "")
        token = os.getenv("SNOWFLAKE_ACCESS_TOKEN", "")
        warehouse = os.getenv("SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_LEARNING_WH")
        
        if not token:
            print("❌ SNOWFLAKE_ACCESS_TOKEN environment variable not set")
            return
            
        print(f"🔍 Connecting to Snowflake account: {account}")
        print(f"👤 User: {username}")
        print(f"🏢 Warehouse: {warehouse}")
        
        # Connect to Snowflake
        conn = snowflake.connector.connect(
            account=account,
            user=username,
            password=token,  # Using token as password
            warehouse=warehouse,
            timeout=30
        )
        
        cursor = conn.cursor()
        
        print("\n✅ Connection successful!")
        
        # Check current context
        cursor.execute("SELECT CURRENT_DATABASE(), CURRENT_SCHEMA(), CURRENT_WAREHOUSE()")
        result = cursor.fetchone()
        print(f"📍 Current context: Database={result[0]}, Schema={result[1]}, Warehouse={result[2]}")
        
        # List all databases you have access to
        print("\n📚 Available databases:")
        cursor.execute("SHOW DATABASES")
        databases = cursor.fetchall()
        for db in databases:
            print(f"  - {db[1]}")  # Database name is typically in column 1
        
        # Check if MIAS_DATA_DB exists
        cursor.execute("USE DATABASE MIAS_DATA_DB")
        print("\n✅ Successfully switched to MIAS_DATA_DB")
        
        # List schemas in MIAS_DATA_DB
        print("\n📁 Available schemas in MIAS_DATA_DB:")
        cursor.execute("SHOW SCHEMAS")
        schemas = cursor.fetchall()
        for schema in schemas:
            print(f"  - {schema[1]}")
            
        # Check CORE schema specifically
        cursor.execute("USE SCHEMA CORE")
        print("\n✅ Successfully switched to CORE schema")
        
        # List all tables in CORE schema
        print("\n📋 Available tables in MIAS_DATA_DB.CORE:")
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        
        if not tables:
            print("  ❌ No tables found in CORE schema")
        else:
            for table in tables:
                table_name = table[1]  # Table name is typically in column 1
                print(f"  - {table_name}")
                
                # Try to get row count for each table
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                    count = cursor.fetchone()[0]
                    print(f"    📊 Rows: {count}")
                except Exception as e:
                    print(f"    ❌ Cannot access: {str(e)}")
        
        # Test specific tables that the app is looking for
        required_tables = [
            'CORE_QUICKBOOKS_REVENUE',
            'CORE_HUBSPOT_DEALS', 
            'CORE_QUICKBOOKS_EXPENSES'
        ]
        
        print(f"\n🎯 Testing access to required tables:")
        for table in required_tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table} LIMIT 1")
                result = cursor.fetchone()
                print(f"  ✅ {table}: Accessible ({result[0]} rows)")
            except Exception as e:
                print(f"  ❌ {table}: {str(e)}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")

if __name__ == "__main__":
    check_snowflake_access()
