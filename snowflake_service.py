from flask import Flask, request, jsonify
import snowflake.connector
import os
import sys

app = Flask(__name__)

@app.route('/api/create-snowflake-db', methods=['POST'])
def create_snowflake_db():
    data = request.get_json()
    company_name = data.get('company_name', '')
    company_slug = data.get('company_slug', '')

    if not company_name or not company_slug:
        return jsonify({'success': False, 'error': 'Company name and slug are required'}), 400

    # Use the slug for database naming (already sanitized)
    db_name = f'{company_slug.upper()}_DB'
    schema_name = 'ANALYTICS'

    try:
        print(f"Creating Snowflake connection for {db_name}...")
        
        # Clean account identifier - remove .snowflakecomputing.com if present
        account_id = os.getenv("SNOWFLAKE_ACCOUNT", "")
        if ".snowflakecomputing.com" in account_id:
            account_id = account_id.replace(".snowflakecomputing.com", "")
        
        print(f"Connecting with account: {account_id}")
        print(f"User: {os.getenv('SNOWFLAKE_USERNAME')}")
        print(f"Warehouse: {os.getenv('SNOWFLAKE_WAREHOUSE')}")
        
        conn = snowflake.connector.connect(
            user=os.getenv("SNOWFLAKE_USERNAME"),
            password=os.getenv("SNOWFLAKE_PASSWORD"),
            account=account_id,
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
            role='SYSADMIN'
        )

        print(f"Connected to Snowflake, creating database {db_name}...")
        
        cs = conn.cursor()
        
        # Create database
        create_db_sql = f'CREATE DATABASE IF NOT EXISTS {db_name}'
        print(f"Executing: {create_db_sql}")
        cs.execute(create_db_sql)
        
        # Create standard data warehouse schemas for proper layered architecture
        schemas = ['RAW', 'STG', 'INT', 'CORE']
        for schema in schemas:
            create_schema_sql = f'CREATE SCHEMA IF NOT EXISTS {db_name}.{schema}'
            print(f"Executing: {create_schema_sql}")
            cs.execute(create_schema_sql)
        
        cs.close()
        conn.close()

        print(f"✅ Successfully created {db_name} with layered schemas: {', '.join(schemas)}")
        return jsonify({
            'success': True, 
            'message': f'Database {db_name} created with layered architecture (RAW → STG → INT → CORE)',
            'databaseName': db_name,
            'schemas': schemas
        })

    except Exception as e:
        print(f"❌ Error creating Snowflake database: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/test-snowflake-connection', methods=['GET'])
def test_snowflake_connection():
    try:
        # Clean account identifier - remove .snowflakecomputing.com if present
        account_id = os.getenv("SNOWFLAKE_ACCOUNT", "")
        if ".snowflakecomputing.com" in account_id:
            account_id = account_id.replace(".snowflakecomputing.com", "")
        
        conn = snowflake.connector.connect(
            user=os.getenv("SNOWFLAKE_USERNAME"),
            password=os.getenv("SNOWFLAKE_PASSWORD"),
            account=account_id,
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
            role='SYSADMIN'
        )
        
        cs = conn.cursor()
        cs.execute('SELECT CURRENT_VERSION()')
        result = cs.fetchone()
        cs.close()
        conn.close()
        
        return jsonify({'success': True, 'version': result[0]})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/execute-query', methods=['POST'])
def execute_query():
    try:
        data = request.get_json()
        sql = data.get('sql', '')
        database = data.get('database', 'MIAS_DATA_DB')
        
        if not sql:
            return jsonify({'success': False, 'error': 'SQL query is required'}), 400
        
        # Clean account identifier
        account_id = os.getenv("SNOWFLAKE_ACCOUNT", "")
        if ".snowflakecomputing.com" in account_id:
            account_id = account_id.replace(".snowflakecomputing.com", "")
        
        print(f"Executing query in {database}: {sql[:100]}...")
        
        conn = snowflake.connector.connect(
            user=os.getenv("SNOWFLAKE_USERNAME"),
            password=os.getenv("SNOWFLAKE_PASSWORD"),
            account=account_id,
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
            database=database,
            schema='PUBLIC',
            role='SYSADMIN'
        )
        
        cs = conn.cursor()
        cs.execute(sql)
        
        # Fetch results
        results = cs.fetchall()
        columns = [desc[0] for desc in cs.description] if cs.description else []
        
        # Convert to list of dictionaries
        data = []
        for row in results:
            row_dict = {}
            for i, value in enumerate(row):
                row_dict[columns[i]] = value
            data.append(row_dict)
        
        cs.close()
        conn.close()
        
        print(f"Query executed successfully, returned {len(data)} rows")
        return jsonify({'success': True, 'data': data})
        
    except Exception as e:
        print(f"Query execution error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)