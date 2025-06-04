import snowflake.connector
import os
import sys

def test_connection():
    try:
        print("Testing connection to MIAS_DATA_DB...")
        print(f"Account: LFQSQQP-VBC22871")
        print(f"User: {os.getenv('SNOWFLAKE_USERNAME')}")
        print(f"Warehouse: MIAS_DATA_DB")
        
        conn = snowflake.connector.connect(
            account='LFQSQQP-VBC22871',
            user=os.getenv('SNOWFLAKE_USERNAME'),
            password=os.getenv('SNOWFLAKE_PASSWORD'),
            warehouse='MIAS_DATA_DB',
            database='MIAS_DATA_DB',
            schema='PUBLIC',
            role='ACCOUNTADMIN'
        )
        
        print("✅ Successfully connected to Snowflake!")
        
        cursor = conn.cursor()
        
        # Test basic query
        cursor.execute('SELECT CURRENT_VERSION()')
        version = cursor.fetchone()
        print(f"Snowflake version: {version[0]}")
        
        # List tables in MIAS_DATA_DB
        cursor.execute('SHOW TABLES IN DATABASE MIAS_DATA_DB')
        tables = cursor.fetchall()
        print(f"\nTables in MIAS_DATA_DB: {len(tables)} found")
        
        if tables:
            print("\nAvailable tables:")
            for table in tables[:10]:  # Show first 10 tables
                print(f"  - {table[1]}")
        else:
            print("No tables found in MIAS_DATA_DB")
        
        # Test sample queries for HubSpot and QuickBooks data
        print("\nTesting sample data queries...")
        
        # Try to find HubSpot-related tables
        cursor.execute("SHOW TABLES IN DATABASE MIAS_DATA_DB LIKE '%HUBSPOT%'")
        hubspot_tables = cursor.fetchall()
        if hubspot_tables:
            print(f"Found {len(hubspot_tables)} HubSpot tables")
            for table in hubspot_tables:
                print(f"  - {table[1]}")
        
        # Try to find QuickBooks-related tables
        cursor.execute("SHOW TABLES IN DATABASE MIAS_DATA_DB LIKE '%QUICKBOOKS%'")
        qb_tables = cursor.fetchall()
        if qb_tables:
            print(f"Found {len(qb_tables)} QuickBooks tables")
            for table in qb_tables:
                print(f"  - {table[1]}")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_connection()
    sys.exit(0 if success else 1)