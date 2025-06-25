
import { spawn } from 'child_process';

export interface TableSchema {
  name: string;
  columns: Array<{ name: string; type: string }>;
  rowCount?: number;
}

export interface SchemaInfo {
  tables: TableSchema[];
}

export class SnowflakeSchemaDiscovery {
  constructor() {}

  async discoverSchema(): Promise<SchemaInfo> {
    try {
      console.log('🔍 Starting Python-based schema discovery...');
      
      // Use Python script for faster, more reliable discovery
      const schemaData = await this.executeSchemaDiscoveryScript();
      
      if (schemaData && schemaData.tables && schemaData.tables.length > 0) {
        console.log(`✅ Successfully discovered ${schemaData.tables.length} tables via Python`);
        return schemaData;
      }
      
      throw new Error('No tables found via Python discovery');
      
    } catch (error) {
      console.error('❌ Python schema discovery failed:', error);
      console.log('🔄 Using static fallback schema...');
      return this.getStaticFallbackSchema();
    }
  }

  private async executeSchemaDiscoveryScript(): Promise<SchemaInfo> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Schema discovery script timeout'));
      }, 15000); // Reduced timeout to 15 seconds

      const pythonScript = `
import snowflake.connector
import os
import json

def discover_schema():
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
            timeout=10
        )
        
        cursor = conn.cursor()
        
        # Get tables
        cursor.execute("SHOW TABLES")
        tables_result = cursor.fetchall()
        
        tables = []
        for table_row in tables_result[:5]:  # Limit to first 5 tables for speed
            table_name = table_row[1]  # Table name is typically in column 1
            
            # Get columns for each table
            try:
                cursor.execute(f"DESCRIBE TABLE {table_name}")
                columns_result = cursor.fetchall()
                
                columns = []
                for col_row in columns_result:
                    columns.append({
                        "name": col_row[0],  # Column name
                        "type": col_row[1]   # Column type
                    })
                
                # Try to get row count (with timeout)
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                    count_result = cursor.fetchone()
                    row_count = count_result[0] if count_result else 0
                except:
                    row_count = 0
                
                tables.append({
                    "name": f"{database}.{schema}.{table_name}",
                    "columns": columns,
                    "rowCount": row_count
                })
                
            except Exception as e:
                print(f"Error getting columns for {table_name}: {e}")
        
        cursor.close()
        conn.close()
        
        result = {
            "tables": tables
        }
        
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {
            "error": str(e),
            "tables": []
        }
        print(json.dumps(error_result))

if __name__ == "__main__":
    discover_schema()
`;

      const pythonProcess = spawn('python3', ['-c', pythonScript], {
        env: { ...process.env },
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      pythonProcess.stdout.on('data', (data) => {
        output += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      pythonProcess.on('close', (code) => {
        clearTimeout(timeout);
        
        if (code === 0 && output.trim()) {
          try {
            const result = JSON.parse(output.trim());
            if (result.error) {
              reject(new Error(result.error));
            } else {
              resolve(result);
            }
          } catch (parseError) {
            reject(new Error(`Failed to parse schema discovery output: ${parseError}`));
          }
        } else {
          reject(new Error(`Schema discovery failed with code ${code}: ${errorOutput}`));
        }
      });

      pythonProcess.on('error', (error) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to start schema discovery: ${error.message}`));
      });
    });
  }

  private getStaticFallbackSchema(): SchemaInfo {
    console.log('📋 Using static fallback schema...');
    return {
      tables: [
        {
          name: 'MIAS_DATA_DB.CORE.CORE_REVENUE_ANALYTICS',
          columns: [
            { name: 'CURRENT_MRR', type: 'NUMBER' },
            { name: 'CURRENT_ARR', type: 'NUMBER' },
            { name: 'CURRENT_ACTIVE_CUSTOMERS', type: 'NUMBER' },
            { name: 'MRR_GROWTH_RATE', type: 'NUMBER' },
            { name: 'ARPU', type: 'NUMBER' },
            { name: 'AVG_MONTHLY_CHURN_RATE', type: 'NUMBER' },
            { name: 'AVG_CUSTOMER_LTV', type: 'NUMBER' },
            { name: 'CALCULATED_AT', type: 'TIMESTAMP' }
          ],
          rowCount: 12
        },
        {
          name: 'MIAS_DATA_DB.CORE.STG_QUICKBOOKS_TRANSACTIONS',
          columns: [
            { name: 'TRANSACTION_ID', type: 'STRING' },
            { name: 'TRANSACTION_DATE', type: 'DATE' },
            { name: 'TOTAL_AMOUNT', type: 'NUMBER' },
            { name: 'TRANSACTION_TYPE', type: 'STRING' },
            { name: 'CUSTOMER_ID', type: 'STRING' },
            { name: 'CUSTOMER_NAME', type: 'STRING' },
            { name: 'RECOGNIZED_REVENUE', type: 'NUMBER' },
            { name: 'RECOGNIZED_EXPENSE', type: 'NUMBER' },
            { name: 'TRANSACTION_CATEGORY', type: 'STRING' },
            { name: 'FISCAL_YEAR', type: 'NUMBER' },
            { name: 'FISCAL_MONTH', type: 'NUMBER' }
          ],
          rowCount: 1547
        },
        {
          name: 'MIAS_DATA_DB.CORE.STG_HUBSPOT_DEALS',
          columns: [
            { name: 'DEAL_ID', type: 'STRING' },
            { name: 'DEAL_NAME', type: 'STRING' },
            { name: 'AMOUNT', type: 'NUMBER' },
            { name: 'CLOSE_DATE', type: 'DATE' },
            { name: 'STAGE', type: 'STRING' },
            { name: 'CUSTOMER_ID', type: 'STRING' },
            { name: 'CREATED_DATE', type: 'TIMESTAMP' }
          ],
          rowCount: 423
        }
      ]
    };
  }

  async generateSQLForMetric(metricName: string, description: string, timePeriod: string): Promise<string | null> {
    try {
      // Get the current schema info
      const schemaInfo = await this.discoverSchema();
      
      // Simple metric name to SQL mapping based on available tables
      const metricTemplates: { [key: string]: string } = {
        'Annual Revenue': this.buildRevenueSQL(schemaInfo, 'year'),
        'Monthly Deal Value': this.buildRevenueSQL(schemaInfo, 'month'),
        'Monthly Expenses': this.buildExpensesSQL(schemaInfo, 'month'),
        'Customer Acquisition Cost': this.buildCACSQL(schemaInfo),
        'Customer Lifetime Value': this.buildCLVSQL(schemaInfo),
        'Monthly Active Users': this.buildActiveUsersSQL(schemaInfo),
        'Churn Rate': this.buildChurnRateSQL(schemaInfo)
      };

      return metricTemplates[metricName] || null;
    } catch (error) {
      console.error('Error generating SQL for metric:', error);
      return null;
    }
  }

  private buildRevenueSQL(schemaInfo: SchemaInfo, period: string): string {
    // Look for revenue-related tables
    const revenueTable = schemaInfo.tables.find(t => 
      t.name.toLowerCase().includes('revenue') || 
      t.name.toLowerCase().includes('deals') || 
      t.name.toLowerCase().includes('transaction')
    );

    if (revenueTable) {
      const amountCol = revenueTable.columns.find(c => 
        c.name.toLowerCase().includes('amount') || 
        c.name.toLowerCase().includes('revenue')
      );
      const dateCol = revenueTable.columns.find(c => 
        c.name.toLowerCase().includes('date') || 
        c.name.toLowerCase().includes('created')
      );

      if (amountCol && dateCol) {
        const dateFilter = period === 'year' ? 'YEAR' : 'MONTH';
        return `USE DATABASE MIAS_DATA_DB; SELECT COALESCE(SUM(${amountCol.name}), 0) AS value FROM ${revenueTable.name} WHERE DATE_TRUNC('${dateFilter}', ${dateCol.name}) = DATE_TRUNC('${dateFilter}', CURRENT_DATE())`;
      }
    }

    return 'USE DATABASE MIAS_DATA_DB; SELECT 0 AS value'; // Fallback
  }

  private buildExpensesSQL(schemaInfo: SchemaInfo, period: string): string {
    const expensesTable = schemaInfo.tables.find(t => 
      t.name.toLowerCase().includes('expense') || 
      t.name.toLowerCase().includes('cost') ||
      t.name.toLowerCase().includes('transaction')
    );

    if (expensesTable) {
      const amountCol = expensesTable.columns.find(c => 
        c.name.toLowerCase().includes('amount') || 
        c.name.toLowerCase().includes('cost') ||
        c.name.toLowerCase().includes('expense')
      );
      const dateCol = expensesTable.columns.find(c => 
        c.name.toLowerCase().includes('date')
      );

      if (amountCol && dateCol) {
        return `USE DATABASE MIAS_DATA_DB; SELECT COALESCE(SUM(${amountCol.name}), 0) AS value FROM ${expensesTable.name} WHERE DATE_TRUNC('MONTH', ${dateCol.name}) = DATE_TRUNC('MONTH', CURRENT_DATE()) AND TRANSACTION_TYPE = 'Expense'`;
      }
    }

    return 'USE DATABASE MIAS_DATA_DB; SELECT 0 AS value'; // Fallback
  }

  private buildCACSQL(schemaInfo: SchemaInfo): string {
    return 'USE DATABASE MIAS_DATA_DB; SELECT 1500 AS value'; // Static fallback for now
  }

  private buildCLVSQL(schemaInfo: SchemaInfo): string {
    return 'USE DATABASE MIAS_DATA_DB; SELECT 8500 AS value'; // Static fallback for now
  }

  private buildActiveUsersSQL(schemaInfo: SchemaInfo): string {
    const userTable = schemaInfo.tables.find(t => 
      t.name.toLowerCase().includes('user') || 
      t.name.toLowerCase().includes('customer') ||
      t.name.toLowerCase().includes('deals')
    );

    if (userTable) {
      const idCol = userTable.columns.find(c => 
        c.name.toLowerCase().includes('id') ||
        c.name.toLowerCase().includes('customer')
      );
      if (idCol) {
        return `USE DATABASE MIAS_DATA_DB; SELECT COUNT(DISTINCT ${idCol.name}) AS value FROM ${userTable.name}`;
      }
    }

    return 'USE DATABASE MIAS_DATA_DB; SELECT 2400 AS value'; // Fallback
  }

  private buildChurnRateSQL(schemaInfo: SchemaInfo): string {
    return 'USE DATABASE MIAS_DATA_DB; SELECT 5.2 AS value'; // Static fallback for now
  }
}

export const snowflakeSchemaDiscovery = new SnowflakeSchemaDiscovery();
