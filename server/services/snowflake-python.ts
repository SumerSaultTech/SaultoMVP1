
import { spawn } from 'child_process';

export interface SnowflakeResult {
  success: boolean;
  data?: any[];
  columns?: string[];
  row_count?: number;
  error?: string;
}

export class SnowflakePythonService {
  async executeQuery(sqlQuery: string): Promise<SnowflakeResult> {
    try {
      console.log('🔄 Executing Snowflake query:', sqlQuery.substring(0, 100) + '...');
      
      const result = await this.executePythonQuery(sqlQuery);
      
      if (result.success) {
        console.log(`✅ Query executed successfully, returned ${result.row_count} rows`);
      } else {
        console.error('❌ Query failed:', result.error);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Python query execution failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async testConnection(): Promise<SnowflakeResult> {
    return this.executeQuery('SELECT CURRENT_TIMESTAMP() as timestamp, CURRENT_DATABASE() as database, CURRENT_SCHEMA() as schema');
  }

  private async executePythonQuery(sqlQuery: string): Promise<SnowflakeResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Query execution timeout'));
      }, 30000); // 30 second timeout

      // Use the same connection pattern as test_quick_schema.py
      const pythonScript = `
import snowflake.connector
import os
import json
import sys
from datetime import datetime, date
from decimal import Decimal

def json_serial(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    elif isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Type {type(obj)} not serializable")

def execute_query():
    try:
        account = os.getenv("SNOWFLAKE_ACCOUNT", "").replace(".snowflakecomputing.com", "")
        username = os.getenv("SNOWFLAKE_USER", "")
        password = os.getenv("SNOWFLAKE_PASSWORD", "")
        warehouse = os.getenv("SNOWFLAKE_WAREHOUSE", "SNOWFLAKE_LEARNING_WH")
        database = "MIAS_DATA_DB"
        schema = "CORE"
        
        conn = snowflake.connector.connect(
            account=account,
            user=username,
            password=password,
            warehouse=warehouse,
            database=database,
            schema=schema,
            timeout=30
        )
        
        cursor = conn.cursor()
        cursor.execute("""${sqlQuery.replace(/"/g, '\\"')}""")
        
        columns = [desc[0] for desc in cursor.description] if cursor.description else []
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
        
        cursor.close()
        conn.close()
        
        print(json.dumps(result, default=json_serial))
        
    except Exception as e:
        error_result = {
            "success": False,
            "error": str(e)
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    execute_query()
`;

      const child = spawn('python3', ['-c', pythonScript], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0) {
          try {
            const result = JSON.parse(stdout.trim());
            resolve(result);
          } catch (parseError) {
            console.error('Failed to parse Python output:', stdout);
            resolve({
              success: false,
              error: `Failed to parse query output: ${parseError}`
            });
          }
        } else {
          resolve({
            success: false,
            error: `Python script failed with code ${code}: ${stderr}`
          });
        }
      });

      child.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          error: `Failed to spawn Python process: ${error.message}`
        });
      });
    });
  }
}

export const snowflakePythonService = new SnowflakePythonService();
