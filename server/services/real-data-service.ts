import { spawn } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';

interface MetricResult {
  success: boolean;
  value?: number;
  error?: string;
}

export class RealDataService {
  
  async calculateMetric(metricName: string): Promise<MetricResult> {
    const sqlQuery = this.getQueryForMetric(metricName);
    if (!sqlQuery) {
      return { success: false, error: `No query defined for metric: ${metricName}` };
    }

    return this.executeSnowflakeQuery(sqlQuery);
  }

  private getQueryForMetric(metricName: string): string | null {
    const queries: Record<string, string> = {
      'annual-revenue': `
        SELECT SUM(AMOUNT) as value 
        FROM MIAS_DATA_DB.PUBLIC.CORE_QUICKBOOKS_REVENUE 
        WHERE YEAR(TRANSACTION_DATE) = YEAR(CURRENT_DATE())
      `,
      'annual-profit': `
        SELECT 
          COALESCE(revenue.total, 0) - COALESCE(expenses.total, 0) as value
        FROM 
          (SELECT SUM(AMOUNT) as total FROM MIAS_DATA_DB.PUBLIC.CORE_QUICKBOOKS_REVENUE WHERE YEAR(TRANSACTION_DATE) = YEAR(CURRENT_DATE())) revenue
        CROSS JOIN
          (SELECT SUM(AMOUNT) as total FROM MIAS_DATA_DB.PUBLIC.CORE_QUICKBOOKS_EXPENSES WHERE YEAR(TRANSACTION_DATE) = YEAR(CURRENT_DATE())) expenses
      `,
      'monthly-revenue': `
        SELECT SUM(AMOUNT) as value 
        FROM MIAS_DATA_DB.PUBLIC.CORE_QUICKBOOKS_REVENUE 
        WHERE YEAR(TRANSACTION_DATE) = YEAR(CURRENT_DATE()) 
        AND MONTH(TRANSACTION_DATE) = MONTH(CURRENT_DATE())
      `,
      'total-calls': `
        SELECT COUNT(*) as value 
        FROM MIAS_DATA_DB.PUBLIC.CORE_HUBSPOT_CALLS 
        WHERE YEAR(CALL_DATE) = YEAR(CURRENT_DATE())
      `,
      'total-deals': `
        SELECT COUNT(*) as value 
        FROM MIAS_DATA_DB.PUBLIC.CORE_HUBSPOT_DEALS 
        WHERE YEAR(DEAL_CREATE_DATE) = YEAR(CURRENT_DATE())
      `,
      'closed-deals': `
        SELECT COUNT(*) as value 
        FROM MIAS_DATA_DB.PUBLIC.CORE_HUBSPOT_DEALS 
        WHERE DEAL_STAGE = 'closedwon' 
        AND YEAR(DEAL_CLOSE_DATE) = YEAR(CURRENT_DATE())
      `,
      'conversion-rate': `
        SELECT 
          CASE WHEN COUNT(*) > 0 
          THEN (COUNT(CASE WHEN DEAL_STAGE = 'closedwon' THEN 1 END) * 100.0 / COUNT(*))
          ELSE 0 END as value
        FROM MIAS_DATA_DB.PUBLIC.CORE_HUBSPOT_DEALS 
        WHERE YEAR(DEAL_CREATE_DATE) = YEAR(CURRENT_DATE())
      `
    };

    const normalizedName = metricName.toLowerCase().replace(/\s+/g, '-');
    return queries[normalizedName] || null;
  }

  private async executeSnowflakeQuery(sql: string): Promise<MetricResult> {
    return new Promise((resolve) => {
      const scriptContent = `
import snowflake.connector
import json
import sys
import os

try:
    conn = snowflake.connector.connect(
        account='LFQSQQP-VBC22871',
        user=os.getenv('SNOWFLAKE_USERNAME'),
        password=os.getenv('SNOWFLAKE_PASSWORD'),
        warehouse='MIAS_DATA_DB',
        database='MIAS_DATA_DB',
        schema='PUBLIC',
        role='ACCOUNTADMIN'
    )
    
    cursor = conn.cursor()
    cursor.execute("""${sql.replace(/"/g, '\\"')}""")
    
    result = cursor.fetchone()
    value = result[0] if result and result[0] is not None else 0
    
    cursor.close()
    conn.close()
    
    print(json.dumps({
        "success": True,
        "value": float(value) if value else 0
    }))
    
except Exception as e:
    print(json.dumps({
        "success": False,
        "error": str(e)
    }))
`;

      const scriptPath = join(process.cwd(), 'temp_metric_query.py');
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
        try {
          unlinkSync(scriptPath);
        } catch (e) {
          console.warn('Failed to clean up temp file:', e);
        }

        if (code !== 0) {
          resolve({
            success: false,
            error: `Query failed: ${errorOutput}`
          });
          return;
        }

        try {
          const result = JSON.parse(output.trim());
          resolve(result);
        } catch (e) {
          resolve({
            success: false,
            error: `Failed to parse result: ${output}`
          });
        }
      });
    });
  }
}

export const realDataService = new RealDataService();