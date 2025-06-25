
#!/usr/bin/env python3
import snowflake.connector
import os
import json

def discover_schema():
    print("🔍 Discovering Snowflake Schema...")
    
    account = os.getenv("SNOWFLAKE_ACCOUNT", "")
    username = os.getenv("SNOWFLAKE_USER", "")
    password = os.getenv("SNOWFLAKE_PASSWORD", "")
    warehouse = os.getenv("SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_LEARNING_WH")
    database = os.getenv("SNOWFLAKE_DATABASE", "MIAS_DATA_DB")
    
    try:
        conn = snowflake.connector.connect(
            account=account,
            user=username,
            password=password,
            warehouse=warehouse,
            database=database,
            schema='CORE',
            timeout=30
        )
        
        cursor = conn.cursor()
        
        print(f"✅ Connected to {database}.CORE")
        
        # Get all tables
        print("\n=== AVAILABLE TABLES ===")
        cursor.execute("""
            SELECT 
                table_name,
                table_type,
                row_count
            FROM information_schema.tables 
            WHERE table_schema = 'CORE'
            ORDER BY table_name
        """)
        
        tables = cursor.fetchall()
        print(f"Found {len(tables)} tables:")
        
        table_info = {}
        
        for table in tables:
            table_name = table[0]
            table_type = table[1]
            row_count = table[2] if table[2] else 0
            
            print(f"\n📋 {table_name} ({table_type}) - {row_count:,} rows")
            
            # Get columns for each table
            cursor.execute(f"""
                SELECT 
                    column_name,
                    data_type,
                    is_nullable
                FROM information_schema.columns 
                WHERE table_schema = 'CORE' 
                  AND table_name = '{table_name}'
                ORDER BY ordinal_position
            """)
            
            columns = cursor.fetchall()
            print(f"  Columns ({len(columns)}):")
            
            table_columns = []
            for col in columns:
                col_name = col[0]
                data_type = col[1]
                nullable = col[2]
                print(f"    - {col_name} ({data_type}) {'NULL' if nullable == 'YES' else 'NOT NULL'}")
                table_columns.append({
                    'name': col_name,
                    'type': data_type,
                    'nullable': nullable == 'YES'
                })
            
            # Sample some data
            try:
                cursor.execute(f"SELECT * FROM {table_name} LIMIT 3")
                sample_data = cursor.fetchall()
                if sample_data:
                    print(f"  Sample data:")
                    for i, row in enumerate(sample_data[:2]):
                        print(f"    Row {i+1}: {dict(zip([col['name'] for col in table_columns], row))}")
            except Exception as e:
                print(f"  Could not sample data: {str(e)[:100]}")
            
            table_info[table_name] = {
                'type': table_type,
                'row_count': row_count,
                'columns': table_columns
            }
        
        # Generate suggestions for common metrics
        print("\n=== METRIC SUGGESTIONS ===")
        suggest_metrics_for_tables(table_info)
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def suggest_metrics_for_tables(table_info):
    suggestions = []
    
    for table_name, info in table_info.items():
        columns = [col['name'].lower() for col in info['columns']]
        
        # Revenue/Sales metrics
        if any(keyword in table_name.lower() for keyword in ['deal', 'sale', 'revenue', 'invoice', 'payment']):
            amount_cols = [col for col in columns if any(term in col for term in ['amount', 'value', 'total', 'price'])]
            if amount_cols:
                suggestions.append(f"📊 Revenue from {table_name}: SUM({amount_cols[0]})")
        
        # Customer metrics
        if any(keyword in table_name.lower() for keyword in ['customer', 'contact', 'account', 'user']):
            suggestions.append(f"👥 Customer Count from {table_name}: COUNT(*)")
        
        # Expense metrics
        if any(keyword in table_name.lower() for keyword in ['expense', 'cost', 'bill']):
            amount_cols = [col for col in columns if any(term in col for term in ['amount', 'value', 'total', 'cost'])]
            if amount_cols:
                suggestions.append(f"💰 Expenses from {table_name}: SUM({amount_cols[0]})")
        
        # Transaction metrics
        if 'transaction' in table_name.lower():
            suggestions.append(f"💳 Transaction Volume from {table_name}: COUNT(*)")
            amount_cols = [col for col in columns if any(term in col for term in ['amount', 'value', 'total'])]
            if amount_cols:
                suggestions.append(f"💳 Transaction Value from {table_name}: SUM({amount_cols[0]})")
    
    for suggestion in suggestions[:10]:  # Show top 10
        print(f"  {suggestion}")

if __name__ == "__main__":
    discover_schema()
