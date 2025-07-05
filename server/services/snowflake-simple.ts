import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

interface SnowflakeResult {
  success: boolean;
  data?: any[];
  error?: string;
}

export class SnowflakeSimpleService {
  
  async executeQuery(sql: string): Promise<SnowflakeResult> {
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

    // Create Python script that avoids shell escaping issues entirely
    const scriptContent = `import snowflake.connector
import json
import sys
import os
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
    token = os.getenv("SNOWFLAKE_ACCESS_TOKEN", "")
    if not token:
        raise ValueError("SNOWFLAKE_ACCESS_TOKEN is required - password authentication disabled to avoid MFA issues")
    
    conn = snowflake.connector.connect(
        account="${account}",
        user="${user}",
        token=token,
        warehouse="${warehouse}",
        database="${database}",
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
`;

    const tempScript = join(process.cwd(), `snowflake_simple_${Date.now()}.py`);
    writeFileSync(tempScript, scriptContent);
    
    return new Promise((resolve) => {
      const python = spawn('python3', [tempScript, sql], {
        env: process.env
      });
      
      let output = '';
      let errorOutput = '';
      
      python.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      python.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      python.on('close', (code) => {
        // Clean up temp file
        try {
          unlinkSync(tempScript);
        } catch (e) {
          // Ignore cleanup errors
        }
        
        if (code === 0 && output.trim()) {
          try {
            const result = JSON.parse(output.trim());
            resolve(result);
          } catch (e) {
            resolve({
              success: false,
              error: `Failed to parse result: ${e.message}`
            });
          }
        } else {
          resolve({
            success: false,
            error: errorOutput || `Python process exited with code ${code}`
          });
        }
      });
    });
  }
  
  async testConnection(): Promise<SnowflakeResult> {
    return this.executeQuery('SELECT CURRENT_TIMESTAMP() as timestamp');
  }
}

export const snowflakeSimpleService = new SnowflakeSimpleService();