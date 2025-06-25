
#!/usr/bin/env python3
import os
import snowflake.connector
import time

def test_actual_schema():
    print("🔍 Testing actual schema discovery...")
    
    account = os.getenv("SNOWFLAKE_ACCOUNT", "").replace(".snowflakecomputing.com", "")
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
            timeout=30
        )
        
        connect_time = time.time() - start_time
        print(f"✅ Connected in {connect_time:.2f} seconds")
        
        cursor = conn.cursor()
        
        # Discover all databases
        print("\n🗂️ DISCOVERING DATABASES...")
        cursor.execute("SHOW DATABASES")
        databases = cursor.fetchall()
        
        print(f"Found {len(databases)} databases:")
        real_databases = []
        for db in databases:
            db_name = db[1]  # Database name is typically in column 1
            if not db_name.startswith('SNOWFLAKE'):  # Skip system databases
                real_databases.append(db_name)
                print(f"  📁 {db_name}")
        
        # For each database, find schemas and tables
        all_tables = []
        for db_name in real_databases[:3]:  # Limit to first 3 databases
            print(f"\n🔍 EXPLORING DATABASE: {db_name}")
            
            try:
                cursor.execute(f"USE DATABASE {db_name}")
                cursor.execute("SHOW SCHEMAS")
                schemas = cursor.fetchall()
                
                for schema in schemas:
                    schema_name = schema[1]
                    if schema_name.startswith('INFORMATION_SCHEMA'):
                        continue
                        
                    print(f"  📋 Schema: {schema_name}")
                    
                    try:
                        cursor.execute(f"USE SCHEMA {db_name}.{schema_name}")
                        cursor.execute("SHOW TABLES")
                        tables = cursor.fetchall()
                        
                        for table in tables:
                            table_name = table[1]
                            full_table_name = f"{db_name}.{schema_name}.{table_name}"
                            
                            # Get row count
                            try:
                                cursor.execute(f"SELECT COUNT(*) FROM {full_table_name}")
                                row_count = cursor.fetchone()[0]
                                print(f"    🔢 {table_name} ({row_count:,} rows)")
                                all_tables.append({
                                    'name': full_table_name,
                                    'rows': row_count
                                })
                            except Exception as e:
                                print(f"    ⚠️ {table_name} (count error: {str(e)[:50]})")
                                all_tables.append({
                                    'name': full_table_name,
                                    'rows': 0
                                })
                        
                        if not tables:
                            print(f"    📭 No tables in {schema_name}")
                            
                    except Exception as e:
                        print(f"    ❌ Error accessing schema {schema_name}: {str(e)[:100]}")
                        
            except Exception as e:
                print(f"  ❌ Error accessing database {db_name}: {str(e)[:100]}")
        
        print(f"\n🎉 SUMMARY: Found {len(all_tables)} total tables")
        
        # Show tables with data
        tables_with_data = [t for t in all_tables if t['rows'] > 0]
        if tables_with_data:
            print(f"\n📊 TABLES WITH DATA ({len(tables_with_data)}):")
            for table in sorted(tables_with_data, key=lambda x: x['rows'], reverse=True)[:10]:
                print(f"  🔢 {table['name']} ({table['rows']:,} rows)")
        
        cursor.close()
        conn.close()
        
        total_time = time.time() - start_time
        print(f"\n⏱️ Total discovery time: {total_time:.2f} seconds")
        
        return all_tables
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        return []

if __name__ == "__main__":
    tables = test_actual_schema()
    if tables:
        print(f"\n✅ Schema discovery successful! Found {len(tables)} tables.")
    else:
        print("\n❌ Schema discovery failed.")
