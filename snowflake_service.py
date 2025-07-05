#!/usr/bin/env python3
import os
import sys
import json
import logging
import snowflake.connector
from decimal import Decimal
from datetime import datetime, date
from flask import Flask, request, jsonify

# Set up logging
logging.basicConfig(level=logging.INFO)

class SnowflakeService:
    """Service to handle all Snowflake database operations"""

    def __init__(self):
        self.connection = None
        self.cursor = None

    def get_connection(self):
        """Create and return Snowflake connection"""
        if not self.connection:
            try:
                # Check for access token first
                token = os.environ.get('SNOWFLAKE_ACCESS_TOKEN')

                connection_params = {
                    'account': os.environ.get('SNOWFLAKE_ACCOUNT'),
                    'user': os.environ.get('SNOWFLAKE_USER'),
                    'warehouse': os.environ.get('SNOWFLAKE_WAREHOUSE'),
                    'database': os.environ.get('SNOWFLAKE_DATABASE'),
                    'schema': os.environ.get('SNOWFLAKE_SCHEMA', 'PUBLIC')
                }

                if token:
                    # Use token authentication only
                    connection_params['token'] = token
                    logging.info("Using token authentication for Snowflake")
                else:
                    raise ValueError("SNOWFLAKE_ACCESS_TOKEN is required - password authentication disabled to avoid MFA issues")

                self.connection = snowflake.connector.connect(**connection_params)
                self.cursor = self.connection.cursor()
                logging.info("Connected to Snowflake successfully")
            except Exception as e:
                logging.error(f"Failed to connect to Snowflake: {e}")
                raise e

        return self.connection

    def execute_query(self, sql_query):
        """Execute a SQL query and return results"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()

            cursor.execute(sql_query)
            results = cursor.fetchall()
            columns = [desc[0] for desc in cursor.description] if cursor.description else []

            # Convert to JSON-serializable format
            data = []
            for row in results:
                row_dict = {}
                for i, value in enumerate(row):
                    if isinstance(value, (datetime, date)):
                        row_dict[columns[i]] = value.isoformat()
                    elif isinstance(value, Decimal):
                        row_dict[columns[i]] = float(value)
                    else:
                        row_dict[columns[i]] = value
                data.append(row_dict)

            return {
                "success": True,
                "data": data,
                "columns": columns,
                "row_count": len(data)
            }

        except Exception as e:
            logging.error(f"Query execution failed: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    def test_connection(self):
        """Test the Snowflake connection"""
        try:
            result = self.execute_query("SELECT CURRENT_TIMESTAMP() as timestamp")
            return result
        except Exception as e:
            return {
                "success": False,
                "error": f"Connection test failed: {str(e)}"
            }

# Create Flask app for the service
app = Flask(__name__)
service = SnowflakeService()

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({"status": "healthy", "service": "snowflake"})

@app.route('/test', methods=['GET'])
def test_connection():
    """Test Snowflake connection"""
    result = service.test_connection()
    return jsonify(result)

@app.route('/query', methods=['POST'])
def execute_query():
    """Execute a SQL query"""
    try:
        data = request.get_json()
        sql_query = data.get('sql')

        if not sql_query:
            return jsonify({"success": False, "error": "SQL query is required"}), 400

        result = service.execute_query(sql_query)
        return jsonify(result)

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 5001))
    app.run(host='0.0.0.0', port=port, debug=True)