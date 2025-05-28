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
        
        conn = snowflake.connector.connect(
            user=os.getenv("SNOWFLAKE_USERNAME"),
            password=os.getenv("SNOWFLAKE_PASSWORD"),
            account=os.getenv("SNOWFLAKE_ACCOUNT"),
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
            role='SYSADMIN'
        )

        print(f"Connected to Snowflake, creating database {db_name}...")
        
        cs = conn.cursor()
        
        # Create database
        create_db_sql = f'CREATE DATABASE IF NOT EXISTS {db_name}'
        print(f"Executing: {create_db_sql}")
        cs.execute(create_db_sql)
        
        # Create schema
        create_schema_sql = f'CREATE SCHEMA IF NOT EXISTS {db_name}.{schema_name}'
        print(f"Executing: {create_schema_sql}")
        cs.execute(create_schema_sql)
        
        cs.close()
        conn.close()

        print(f"✅ Successfully created {db_name} with {schema_name} schema")
        return jsonify({
            'success': True, 
            'message': f'Database {db_name} and schema {schema_name} created successfully.',
            'databaseName': db_name
        })

    except Exception as e:
        print(f"❌ Error creating Snowflake database: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/test-snowflake-connection', methods=['GET'])
def test_snowflake_connection():
    try:
        conn = snowflake.connector.connect(
            user=os.getenv("SNOWFLAKE_USERNAME"),
            password=os.getenv("SNOWFLAKE_PASSWORD"),
            account=os.getenv("SNOWFLAKE_ACCOUNT"),
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)