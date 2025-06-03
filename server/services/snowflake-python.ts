import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

interface SnowflakeResult {
  success: boolean;
  data?: any[];
  error?: string;
}

export class SnowflakePythonService {
  
  async executeQuery(sql: string): Promise<SnowflakeResult> {
    return new Promise((resolve) => {
      // Create temporary Python script with SQL query
      const scriptContent = `
import snowflake.connector
import json
import sys
import os

try:
    # Connect to Snowflake
    conn = snowflake.connector.connect(
        account='${process.env.SNOWFLAKE_ACCOUNT}',
        user='${process.env.SNOWFLAKE_USERNAME}',
        password='${process.env.SNOWFLAKE_PASSWORD}',
        warehouse='${process.env.SNOWFLAKE_WAREHOUSE}',
        database='MIAS_DATA_DB',
        schema='${process.env.SNOWFLAKE_SCHEMA || 'PUBLIC'}'
    )
    
    cursor = conn.cursor()
    
    # Execute the query
    cursor.execute("""${sql.replace(/"/g, '\\"')}""")
    
    # Fetch results
    results = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    
    # Convert to list of dictionaries
    data = []
    for row in results:
        row_dict = {}
        for i, value in enumerate(row):
            row_dict[columns[i]] = value
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
`;

      const scriptPath = join(process.cwd(), 'temp_snowflake_query.py');
      writeFileSync(scriptPath, scriptContent);

      const pythonProcess = spawn('python3', [scriptPath]);
      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        // Clean up temp file
        try {
          unlinkSync(scriptPath);
        } catch (e) {
          console.warn('Failed to clean up temp file:', e);
        }

        if (code !== 0) {
          resolve({
            success: false,
            error: `Python process failed: ${errorOutput}`
          });
          return;
        }

        try {
          const result = JSON.parse(output.trim());
          resolve(result);
        } catch (e) {
          resolve({
            success: false,
            error: `Failed to parse Python output: ${output}`
          });
        }
      });
    });
  }

  async testConnection(): Promise<SnowflakeResult> {
    return this.executeQuery('SELECT 1 as test_value');
  }

  // Execute specific metric calculation queries
  async calculateMetricValue(metricName: string, sqlQuery: string): Promise<number> {
    const result = await this.executeQuery(sqlQuery);
    
    if (!result.success || !result.data || result.data.length === 0) {
      console.warn(`No data returned for metric ${metricName}`);
      return 0;
    }

    // Get the first numeric value from the result
    const firstRow = result.data[0];
    const value = firstRow.value || firstRow.VALUE || Object.values(firstRow)[0];
    
    return typeof value === 'number' ? value : parseFloat(value) || 0;
  }
}

export const snowflakePythonService = new SnowflakePythonService();