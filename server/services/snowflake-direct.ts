import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface SnowflakeResult {
  success: boolean;
  data?: any[];
  error?: string;
}

export class SnowflakeDirectService {
  
  async executeQuery(sql: string): Promise<SnowflakeResult> {
    try {
      const account = process.env.SNOWFLAKE_ACCOUNT;
      const user = process.env.SNOWFLAKE_USER;
      const password = process.env.SNOWFLAKE_PASSWORD;
      const warehouse = process.env.SNOWFLAKE_WAREHOUSE;
      const database = process.env.SNOWFLAKE_DATABASE;

      if (!account || !user || !password || !warehouse || !database) {
        return {
          success: false,
          error: 'Missing Snowflake credentials'
        };
      }

      // Use environment variables directly in the Python command
      const pythonScript = `
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

try:
    conn = snowflake.connector.connect(
        account='${account.replace(/'/g, "\\'")}',
        user='${user.replace(/'/g, "\\'")}',
        password='${password.replace(/'/g, "\\'")}',
        warehouse='${warehouse.replace(/'/g, "\\'")}',
        database='${database.replace(/'/g, "\\'")}',
        schema='CORE',
        timeout=30
    )
    
    cursor = conn.cursor()
    cursor.execute("""${sql.replace(/"/g, '\\"').replace(/'/g, "\\'")}""")
    
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
`;

      const { stdout, stderr } = await execAsync(`python3 -c "${pythonScript}"`);
      
      if (stderr && stderr.trim()) {
        console.warn('Snowflake Python stderr:', stderr);
      }
      
      const result = JSON.parse(stdout.trim());
      return result;
      
    } catch (error) {
      console.error('Snowflake query error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  async testConnection(): Promise<SnowflakeResult> {
    return this.executeQuery('SELECT CURRENT_TIMESTAMP() as timestamp');
  }
}

export const snowflakeDirectService = new SnowflakeDirectService();