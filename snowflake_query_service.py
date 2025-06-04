import snowflake.connector
import json
import sys
import os
from decimal import Decimal
from datetime import date, datetime

def execute_snowflake_query(sql_query):
    try:
        # Connect to Snowflake
        account = os.getenv("SNOWFLAKE_ACCOUNT", "").replace(".snowflakecomputing.com", "")
        
        conn = snowflake.connector.connect(
            account=account,
            user=os.getenv("SNOWFLAKE_USERNAME"),
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
                if value is None:
                    value = None
                elif hasattr(value, 'isoformat'):  # datetime/date objects
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