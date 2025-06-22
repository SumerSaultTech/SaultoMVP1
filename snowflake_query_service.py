#!/usr/bin/env python3
import os
import sys
import json
import snowflake.connector
from decimal import Decimal
from datetime import datetime, date

def execute_snowflake_query(sql_query):
    try:
        # Connect to Snowflake using environment variables with correct account format
        account_id = os.getenv("SNOWFLAKE_ACCOUNT", "")
        # Use the account format that works: remove .snowflakecomputing.com if present
        account_format = account_id.replace(".snowflakecomputing.com", "") if ".snowflakecomputing.com" in account_id else account_id
        
        conn = snowflake.connector.connect(
            account=account_format,
            user=os.getenv("SNOWFLAKE_USER"),
            password=os.getenv("SNOWFLAKE_PASSWORD"),
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_LEARNING_WH"),
            database='MIAS_DATA_DB',
            schema='CORE',
            timeout=30
        )
        
        # Execute the query
        cursor = conn.cursor()
        cursor.execute(sql_query)
        results = cursor.fetchall()
        columns = [desc[0] for desc in cursor.description]
        
        # Convert results to JSON format
        data = []
        for row in results:
            row_dict = {}
            for i, col in enumerate(columns):
                value = row[i]
                # Handle different data types
                if isinstance(value, (datetime, date)):
                    value = value.isoformat()
                elif isinstance(value, Decimal):
                    value = str(value)
                else:
                    value = str(value) if value is not None else None
                row_dict[col] = value
            data.append(row_dict)
        
        cursor.close()
        conn.close()
        
        # Return success result
        result = {
            "success": True,
            "data": data,
            "columns": columns
        }
        print(json.dumps(result))
        
    except Exception as e:
        # Return error result
        error_result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(json.dumps({"success": False, "error": "SQL query argument required"}))
        sys.exit(1)
    
    sql_query = sys.argv[1]
    execute_snowflake_query(sql_query)