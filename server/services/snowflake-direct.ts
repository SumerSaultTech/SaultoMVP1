import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

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

      // Create temporary Python script with proper escaping
      const pythonScript = `
import snowflake.connector
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

try:
    conn = snowflake.connector.connect(
        account="${account}",
        user="${user}",
        password="${password}",
        warehouse="${warehouse}",
        database="${database}",
        schema="CORE",
        timeout=30
    )
    
    cursor = conn.cursor()
    cursor.execute("""${sql}""")
    
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

      const tempScript = join(process.cwd(), `temp_snowflake_${Date.now()}.py`);
      writeFileSync(tempScript, pythonScript);
      
      return new Promise((resolve) => {
        const python = spawn('python3', [tempScript], {
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
            console.warn('Failed to clean up temp script:', e);
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