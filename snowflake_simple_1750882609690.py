import snowflake.connector
import json
import sys
from decimal import Decimal
from datetime import date, datetime

def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    elif isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")

# Read SQL from command line argument
sql_query = sys.argv[1] if len(sys.argv) > 1 else "SELECT 1"

try:
    conn = snowflake.connector.connect(
        account="LFQSQQP-VBC22871",
        user="mpatrikios",
        password="Kefalonia2004!",
        warehouse="SNOWFLAKE_LEARNING_WH",
        database="MIAS_DATA_DB",
        schema="CORE",
        timeout=30
    )
    
    cursor = conn.cursor()
    cursor.execute(sql_query)
    
    columns = [desc[0] for desc in cursor.description]
    rows = cursor.fetchall()
    
    data = []
    for row in rows:
        row_dict = {}
        for i, value in enumerate(row):
            row_dict[columns[i]] = value
        data.append(row_dict)
    
    result = {
        "success": True,
        "data": data,
        "columns": columns,
        "row_count": len(data)
    }
    
    print(json.dumps(result, default=json_serial))
    
except Exception as e:
    error_result = {
        "success": False,
        "error": str(e)
    }
    print(json.dumps(error_result))
    
finally:
    if 'conn' in locals():
        conn.close()
