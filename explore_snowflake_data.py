import snowflake.connector
import os
import json

def explore_snowflake():
    account = os.getenv("SNOWFLAKE_ACCOUNT", "").replace(".snowflakecomputing.com", "")
    username = os.getenv("SNOWFLAKE_USER", "")
    password = os.getenv("SNOWFLAKE_PASSWORD", "")
    warehouse = os.getenv("SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_LEARNING_WH")
    
    try:
        conn = snowflake.connector.connect(
            account=account,
            user=username,
            password=password,
            warehouse=warehouse,
            timeout=30
        )
        
        cursor = conn.cursor()
        
        print("=== SNOWFLAKE ACCOUNT EXPLORATION ===")
        print(f"Connected to account: {account}")
        print(f"Using warehouse: {warehouse}")
        
        # Show all databases
        print("\n=== AVAILABLE DATABASES ===")
        cursor.execute("SHOW DATABASES")
        databases = cursor.fetchall()
        
        for db in databases:
            db_name = db[1]  # Database name is in column 1
            print(f"Database: {db_name}")
        
        # Check each database for schemas and tables
        for db in databases:
            db_name = db[1]
            print(f"\n=== EXPLORING DATABASE: {db_name} ===")
            
            try:
                cursor.execute(f"USE DATABASE {db_name}")
                cursor.execute("SHOW SCHEMAS")
                schemas = cursor.fetchall()
                
                for schema in schemas:
                    schema_name = schema[1]  # Schema name is in column 1
                    print(f"  Schema: {db_name}.{schema_name}")
                    
                    try:
                        cursor.execute(f"USE SCHEMA {db_name}.{schema_name}")
                        cursor.execute("SHOW TABLES")
                        tables = cursor.fetchall()
                        
                        if tables:
                            print(f"    Tables in {db_name}.{schema_name}:")
                            for table in tables:
                                table_name = table[1]  # Table name is in column 1
                                
                                # Get row count
                                try:
                                    cursor.execute(f"SELECT COUNT(*) FROM {db_name}.{schema_name}.{table_name}")
                                    row_count = cursor.fetchone()[0]
                                    print(f"      - {table_name} ({row_count:,} rows)")
                                except Exception as e:
                                    print(f"      - {table_name} (count error: {str(e)[:50]})")
                        else:
                            print(f"    No tables in {db_name}.{schema_name}")
                            
                    except Exception as e:
                        print(f"    Error accessing schema {schema_name}: {str(e)[:100]}")
                        
            except Exception as e:
                print(f"  Error accessing database {db_name}: {str(e)[:100]}")
        
        # Look for HubSpot or QuickBooks related data
        print("\n=== SEARCHING FOR HUBSPOT/QUICKBOOKS DATA ===")
        search_terms = ['HUBSPOT', 'QUICKBOOKS', 'DEALS', 'CONTACTS', 'REVENUE', 'EXPENSES', 'MIAS']
        
        for db in databases:
            db_name = db[1]
            try:
                cursor.execute(f"USE DATABASE {db_name}")
                cursor.execute("SHOW SCHEMAS")
                schemas = cursor.fetchall()
                
                for schema in schemas:
                    schema_name = schema[1]
                    try:
                        cursor.execute(f"USE SCHEMA {db_name}.{schema_name}")
                        cursor.execute("SHOW TABLES")
                        tables = cursor.fetchall()
                        
                        for table in tables:
                            table_name = table[1]
                            for term in search_terms:
                                if term.lower() in table_name.lower():
                                    cursor.execute(f"SELECT COUNT(*) FROM {db_name}.{schema_name}.{table_name}")
                                    row_count = cursor.fetchone()[0]
                                    print(f"FOUND: {db_name}.{schema_name}.{table_name} ({row_count:,} rows)")
                                    break
                    except:
                        continue
            except:
                continue
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Connection failed: {str(e)}")

if __name__ == "__main__":
    explore_snowflake()