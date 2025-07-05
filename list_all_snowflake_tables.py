
#!/usr/bin/env python3
import os
import snowflake.connector
import json

def list_all_tables_and_schemas():
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
        
        # Switch to MIAS_DATA_DB
        cursor.execute("USE DATABASE MIAS_DATA_DB")
        print("\n✅ Successfully switched to MIAS_DATA_DB")
        
        # Get all schemas in the database
        cursor.execute("SHOW SCHEMAS")
        schemas = cursor.fetchall()
        
        print(f"\n📁 Available schemas in MIAS_DATA_DB:")
        for schema in schemas:
            schema_name = schema[1]
            print(f"  - {schema_name}")
        
        # For each schema, list tables and their columns
        for schema in schemas:
            schema_name = schema[1]
            if schema_name in ['CORE', 'STG', 'INT', 'RAW', 'PUBLIC']:
                print(f"\n" + "="*60)
                print(f"📋 SCHEMA: {schema_name}")
                print("="*60)
                
                try:
                    cursor.execute(f"USE SCHEMA {schema_name}")
                    cursor.execute("SHOW TABLES")
                    tables = cursor.fetchall()
                    
                    if not tables:
                        print(f"  (No tables in {schema_name} schema)")
                        continue
                    
                    for table in tables:
                        table_name = table[1]
                        
                        # Get row count
                        try:
                            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                            row_count = cursor.fetchone()[0]
                        except:
                            row_count = "Unknown"
                        
                        print(f"\n📊 TABLE: {schema_name}.{table_name}")
                        print(f"   📈 Rows: {row_count}")
                        
                        # Get table structure
                        try:
                            cursor.execute(f"DESCRIBE TABLE {table_name}")
                            columns = cursor.fetchall()
                            
                            print("   📋 Columns:")
                            for col in columns:
                                col_name = col[0]
                                col_type = col[1]
                                nullable = col[2]
                                print(f"      • {col_name} ({col_type}) {'NULL' if nullable == 'Y' else 'NOT NULL'}")
                                
                        except Exception as e:
                            print(f"      ❌ Could not describe table: {e}")
                
                except Exception as e:
                    print(f"  ❌ Could not access schema {schema_name}: {e}")
        
        # Query the INFORMATION_SCHEMA for a comprehensive view
        print(f"\n" + "="*60)
        print("📊 INFORMATION_SCHEMA SUMMARY")
        print("="*60)
        
        try:
            cursor.execute("""
                SELECT 
                    TABLE_SCHEMA,
                    TABLE_NAME,
                    ROW_COUNT,
                    TABLE_TYPE
                FROM MIAS_DATA_DB.INFORMATION_SCHEMA.TABLES 
                WHERE TABLE_SCHEMA IN ('CORE', 'STG', 'INT', 'RAW', 'PUBLIC')
                ORDER BY TABLE_SCHEMA, TABLE_NAME
            """)
            
            info_tables = cursor.fetchall()
            
            current_schema = None
            for table_info in info_tables:
                schema_name = table_info[0]
                table_name = table_info[1]
                row_count = table_info[2] if table_info[2] is not None else "Unknown"
                table_type = table_info[3]
                
                if current_schema != schema_name:
                    print(f"\n📁 {schema_name}:")
                    current_schema = schema_name
                
                print(f"   • {table_name} ({table_type}) - {row_count} rows")
                
        except Exception as e:
            print(f"❌ Could not query INFORMATION_SCHEMA: {e}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Connection failed: {str(e)}")

if __name__ == "__main__":
    list_all_tables_and_schemas()
