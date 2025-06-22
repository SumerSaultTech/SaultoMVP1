#!/usr/bin/env python3
"""
Test Snowflake connection with pure Python mode
"""

import os
from dotenv import load_dotenv

# Enable pure Python mode (avoids native OpenSSL/libcrypto)
os.environ["SNOWFLAKE_CONNECTOR_PREFER_PYTHON_SSL"] = "true"

import snowflake.connector

# Load environment variables
load_dotenv()

def test_snowflake_connection():
    """Test Snowflake connection with pure Python mode"""
    try:
        print("🔍 Testing Snowflake connection with pure Python mode...")
        print(f"Account: {os.getenv('SNOWFLAKE_ACCOUNT')}")
        print(f"User: {os.getenv('SNOWFLAKE_USER')}")
        print(f"Warehouse: {os.getenv('SNOWFLAKE_WAREHOUSE')}")
        print(f"Pure Python SSL: {os.environ.get('SNOWFLAKE_CONNECTOR_PREFER_PYTHON_SSL')}")
        
        # Establish connection
        conn = snowflake.connector.connect(
            user=os.getenv("SNOWFLAKE_USER"),
            password=os.getenv("SNOWFLAKE_PASSWORD"),
            account=os.getenv("SNOWFLAKE_ACCOUNT"),
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
            database="MIAS_DATA_DB",
            schema="CORE"
        )
        
        print("✅ Successfully connected to Snowflake!")
        
        # Test query
        cursor = conn.cursor()
        cursor.execute("SELECT CURRENT_TIMESTAMP()")
        result = cursor.fetchone()
        print(f"✅ Test query successful: {result[0]}")
        
        # Test table creation
        test_sql = """
        CREATE TABLE IF NOT EXISTS MIAS_DATA_DB.CORE.CONNECTION_TEST (
            id NUMBER,
            test_message VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
        cursor.execute(test_sql)
        print("✅ Table creation test successful!")
        
        # Test insert
        insert_sql = """
        INSERT INTO MIAS_DATA_DB.CORE.CONNECTION_TEST (id, test_message)
        VALUES (1, 'Pure Python connection works!')
        """
        cursor.execute(insert_sql)
        print("✅ Insert test successful!")
        
        cursor.close()
        conn.close()
        
        print("🎉 All Snowflake tests passed! Ready for data loading.")
        return True
        
    except Exception as e:
        print(f"❌ Snowflake connection failed: {e}")
        return False

if __name__ == "__main__":
    test_snowflake_connection()