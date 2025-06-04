import snowflake.connector
import os
import sys

def check_table_structure():
    try:
        conn = snowflake.connector.connect(
            account='LFQSQQP-VBC22871',
            user=os.getenv('SNOWFLAKE_USERNAME'),
            password=os.getenv('SNOWFLAKE_PASSWORD'),
            warehouse='MIAS_DATA_DB',
            database='MIAS_DATA_DB',
            schema='PUBLIC',
            role='ACCOUNTADMIN'
        )
        
        cursor = conn.cursor()
        
        # Check what we can access
        print("=== Checking Database Access ===")
        
        # First check if we can list tables
        try:
            cursor.execute("SHOW TABLES IN DATABASE MIAS_DATA_DB")
            all_tables = cursor.fetchall()
            print(f"Found {len(all_tables)} tables")
        except Exception as e:
            print(f"Cannot list tables: {e}")
            # Try to check if database exists
            cursor.execute("SHOW DATABASES")
            databases = cursor.fetchall()
            print("Available databases:")
            for db in databases:
                print(f"  {db[1]}")
            return
        
        if all_tables:
            for table in all_tables:
                table_name = table[1]
                print(f"\nTable: {table_name}")
                
                # Show table structure
                cursor.execute(f"DESCRIBE TABLE MIAS_DATA_DB.PUBLIC.{table_name}")
                columns = cursor.fetchall()
                for col in columns:
                    print(f"  {col[0]} ({col[1]})")
                
                # Show sample data
                print(f"Sample data:")
                cursor.execute(f"SELECT * FROM MIAS_DATA_DB.PUBLIC.{table_name} LIMIT 2")
                samples = cursor.fetchall()
                if samples:
                    for sample in samples:
                        print(f"  {sample}")
                else:
                    print("  No data found")
        else:
            print("No tables found. Creating data structure...")
            
            # Create the required tables for HubSpot and QuickBooks data
            create_tables = [
                """
                CREATE TABLE IF NOT EXISTS MIAS_DATA_DB.PUBLIC.CORE_QUICKBOOKS_REVENUE (
                    ID NUMBER AUTOINCREMENT,
                    TRANSACTION_DATE DATE,
                    AMOUNT NUMBER(15,2),
                    DESCRIPTION STRING,
                    CUSTOMER_ID STRING,
                    ACCOUNT STRING,
                    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS MIAS_DATA_DB.PUBLIC.CORE_QUICKBOOKS_EXPENSES (
                    ID NUMBER AUTOINCREMENT,
                    TRANSACTION_DATE DATE,
                    AMOUNT NUMBER(15,2),
                    DESCRIPTION STRING,
                    CATEGORY STRING,
                    VENDOR STRING,
                    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS MIAS_DATA_DB.PUBLIC.CORE_HUBSPOT_DEALS (
                    ID NUMBER AUTOINCREMENT,
                    DEAL_ID STRING,
                    DEAL_NAME STRING,
                    DEAL_STAGE STRING,
                    DEAL_AMOUNT NUMBER(15,2),
                    DEAL_CREATE_DATE DATE,
                    DEAL_CLOSE_DATE DATE,
                    CUSTOMER_ID STRING,
                    OWNER STRING,
                    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
                )
                """,
                """
                CREATE TABLE IF NOT EXISTS MIAS_DATA_DB.PUBLIC.CORE_HUBSPOT_CALLS (
                    ID NUMBER AUTOINCREMENT,
                    CALL_ID STRING,
                    CALL_DATE DATE,
                    CALL_DURATION NUMBER,
                    CALL_OUTCOME STRING,
                    CONTACT_ID STRING,
                    OWNER STRING,
                    NOTES STRING,
                    CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
                )
                """
            ]
            
            for create_sql in create_tables:
                print(f"Creating table...")
                cursor.execute(create_sql)
                print("Table created successfully")
            
            print("Data structure created. Tables are ready for your HubSpot and QuickBooks data.")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    check_table_structure()