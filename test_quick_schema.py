
#!/usr/bin/env python3

import snowflake.connector
import os
import json
import time

def test_quick_schema():
    """Quick test of schema discovery"""
    print("🔍 Testing quick schema discovery...")
    
    try:
        start_time = time.time()
        
        account = os.getenv("SNOWFLAKE_ACCOUNT", "").replace(".snowflakecomputing.com", "")
        username = os.getenv("SNOWFLAKE_USER", "")
        password = os.getenv("SNOWFLAKE_PASSWORD", "")
        warehouse = os.getenv("SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_LEARNING_WH")
        
        print(f"Connecting to: {account}")
        print(f"User: {username}")
        print(f"Warehouse: {warehouse}")
        
        conn = snowflake.connector.connect(
            account=account,
            user=username,
            password=password,
            warehouse=warehouse,
            database="MIAS_DATA_DB",
            schema="CORE",
            timeout=10
        )
        
        connect_time = time.time() - start_time
        print(f"✅ Connected in {connect_time:.2f} seconds")
        
        cursor = conn.cursor()
        
        # Test basic query
        print("🧪 Testing basic query...")
        cursor.execute("SELECT CURRENT_DATABASE(), CURRENT_SCHEMA()")
        result = cursor.fetchone()
        print(f"Current context: {result}")
        
        # Get tables
        print("📋 Getting tables...")
        tables_start = time.time()
        cursor.execute("SHOW TABLES")
        tables = cursor.fetchall()
        tables_time = time.time() - tables_start
        
        print(f"Found {len(tables)} tables in {tables_time:.2f} seconds:")
        for table in tables[:3]:  # Show first 3 tables
            print(f"  📁 {table[1]}")
        
        # Test getting columns for first table
        if tables:
            first_table = tables[0][1]
            print(f"🔍 Getting columns for {first_table}...")
            cols_start = time.time()
            cursor.execute(f"DESCRIBE TABLE {first_table}")
            columns = cursor.fetchall()
            cols_time = time.time() - cols_start
            
            print(f"Found {len(columns)} columns in {cols_time:.2f} seconds:")
            for col in columns[:3]:  # Show first 3 columns
                print(f"    📊 {col[0]} ({col[1]})")
        
        cursor.close()
        conn.close()
        
        total_time = time.time() - start_time
        print(f"✅ Total test completed in {total_time:.2f} seconds")
        
    except Exception as e:
        print(f"❌ Schema test failed: {e}")

if __name__ == "__main__":
    test_quick_schema()
