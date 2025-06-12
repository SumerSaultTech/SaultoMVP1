
import snowflake.connector
import json
import sys
import os
from decimal import Decimal
from datetime import date, datetime

try:
    # Connect to Snowflake
    account_id = os.getenv("SNOWFLAKE_ACCOUNT", "")
    account_format = account_id.replace(".snowflakecomputing.com", "") if ".snowflakecomputing.com" in account_id else account_id
    
    conn = snowflake.connector.connect(
        account=account_format,
        user=os.getenv("SNOWFLAKE_USERNAME"),
        password=os.getenv("SNOWFLAKE_PASSWORD"),
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_LEARNING_WH"),
        database='MIAS_DATA_DB',
        schema='CORE',
        timeout=30
    )
    
    cursor = conn.cursor()
    
    # Execute the query
    cursor.execute("""SELECT * FROM MIAS_DATA_DB.CORE.CORE_HUBSPOT_CALLS LIMIT 100""")
    
    # Fetch results
    results = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    
    # Convert to list of dictionaries with proper JSON serialization
    data = []
    for row in results:
        row_dict = {}
        for i, value in enumerate(row):
            # Handle different data types for JSON serialization
            if isinstance(value, Decimal):
                row_dict[columns[i]] = float(value)
            elif isinstance(value, (date, datetime)):
                row_dict[columns[i]] = value.isoformat()
            elif value is None:
                row_dict[columns[i]] = None
            else:
                row_dict[columns[i]] = str(value)
        data.append(row_dict)
    
    # Return success result
    print(json.dumps({
        "success": True,
        "data": data
    }))
    
except Exception as e:
    print(json.dumps({
        "success": False,
        "error": str(e)
    }))
finally:
    if 'conn' in locals():
        conn.close()
