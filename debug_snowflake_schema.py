#!/usr/bin/env python3
import snowflake.connector
import os
import time

def test_schema_query():
    print("🔧 Testing Snowflake schema query directly...")
    
    account = os.getenv("SNOWFLAKE_ACCOUNT", "")
    username = os.getenv("SNOWFLAKE_USER", "")
    password = os.getenv("SNOWFLAKE_PASSWORD", "")
    warehouse = os.getenv("SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_LEARNING_WH")
    
    print(f"Account: {account}")
    print(f"Username: {username}")
    print(f"Warehouse: {warehouse}")
    
    try:
        start_time = time.time()
        print("🔄 Connecting to Snowflake...")
        
        conn = snowflake.connector.connect(
            account=account,
            user=username,
            password=password,
            warehouse=warehouse,
            database='MIAS_DATA_DB',
            schema='CORE'
        )
        
        connect_time = time.time() - start_time
        print(f"✅ Connected in {connect_time:.2f} seconds")
        
        cursor = conn.cursor()
        
        # Test basic query first
        print("🧪 Testing basic query...")
        basic_start = time.time()
        cursor.execute("SELECT CURRENT_DATABASE(), CURRENT_SCHEMA(), CURRENT_USER()")
        basic_result = cursor.fetchone()
        basic_time = time.time() - basic_start
        print(f"✅ Basic query result: {basic_result} (took {basic_time:.2f}s)")
        
        # Test table listing
        print("🔍 Testing SHOW TABLES...")
        tables_start = time.time()
        cursor.execute("SHOW TABLES IN SCHEMA MIAS_DATA_DB.CORE")
        tables = cursor.fetchall()
        tables_time = time.time() - tables_start
        print(f"✅ Found {len(tables)} tables in CORE schema (took {tables_time:.2f}s)")
        for table in tables[:5]:  # Show first 5 tables
            print(f"  - {table[1]}")  # table name is usually in index 1
        
        # Test information_schema query
        print("🔍 Testing information_schema query...")
        schema_start = time.time()
        cursor.execute("""
            SELECT table_name, column_name, data_type
            FROM MIAS_DATA_DB.information_schema.columns
            WHERE table_schema = 'CORE'
            ORDER BY table_name, ordinal_position
            LIMIT 10
        """)
        schema_result = cursor.fetchall()
        schema_time = time.time() - schema_start
        print(f"✅ Schema query returned {len(schema_result)} rows (took {schema_time:.2f}s)")
        for row in schema_result[:3]:  # Show first 3 rows
            print(f"  - {row}")
        
        cursor.close()
        conn.close()
        
        total_time = time.time() - start_time
        print(f"🎉 All tests completed successfully in {total_time:.2f} seconds total")
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        print(f"Error type: {type(e).__name__}")

if __name__ == "__main__":
    test_schema_query()