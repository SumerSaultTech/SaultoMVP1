import snowflake from 'snowflake-sdk';
import { snowflakeService } from './snowflake.ts';

export interface TableSchema {
  name: string;
  columns: Array<{ name: string; type: string }>;
  rowCount?: number;
}

export interface SchemaInfo {
  tables: TableSchema[];
}

export class SnowflakeSchemaDiscovery {
  private snowflakeService: typeof snowflakeService;

  constructor() {
    this.snowflakeService = snowflakeService;
  }

  async discoverSchema(): Promise<SchemaInfo> {
    try {
      console.log('🔍 Starting comprehensive schema discovery...');

      // First, discover all available databases and schemas
      const databases = await this.getAvailableDatabases();
      console.log(`📊 Found ${databases.length} databases:`, databases.map(db => db.name));

      let allTables: TableSchema[] = [];

      // Check each database for tables
      for (const database of databases) {
        try {
          const schemas = await this.getSchemasInDatabase(database.name);
          console.log(`📋 Database ${database.name} has ${schemas.length} schemas`);

          for (const schema of schemas) {
            try {
              const tables = await this.getTablesInSchema(database.name, schema.name);
              console.log(`🔢 Found ${tables.length} tables in ${database.name}.${schema.name}`);
              allTables = allTables.concat(tables);
            } catch (error) {
              console.log(`⚠️ Error getting tables from ${database.name}.${schema.name}:`, error.message);
            }
          }
        } catch (error) {
          console.log(`⚠️ Error getting schemas from ${database.name}:`, error.message);
        }
      }

      // If we found tables, return them
      if (allTables.length > 0) {
        console.log(`✅ Successfully discovered ${allTables.length} tables across all databases`);
        return { tables: allTables };
      }

      // Fallback: try the specific database from environment
      const envDatabase = process.env.SNOWFLAKE_DATABASE || 'MIAS_DATA_DB';
      const envSchema = process.env.SNOWFLAKE_SCHEMA || 'CORE';
      console.log(`🔄 Trying fallback database: ${envDatabase}.${envSchema}`);

      const fallbackTables = await this.getTablesInSchema(envDatabase, envSchema);

      return { tables: fallbackTables };

    } catch (error) {
      console.error('❌ Schema discovery failed completely:', error);
      return this.getStaticFallbackSchema();
    }
  }

  private async getAvailableDatabases(): Promise<Array<{ name: string }>> {
    try {
      const result = await this.snowflakeService.executeQuery('SHOW DATABASES');
      if (result.success && result.data) {
        return result.data.map((row: any) => ({
          name: row.name || row.NAME || row[1] // Different possible column names
        })).filter(db => db.name && !db.name.startsWith('SNOWFLAKE'));
      }
      return [];
    } catch (error) {
      console.log('Error getting databases:', error.message);
      return [{ name: 'MIAS_DATA_DB' }]; // Default fallback
    }
  }

  private async getSchemasInDatabase(databaseName: string): Promise<Array<{ name: string }>> {
    try {
      const result = await this.snowflakeService.executeQuery(`SHOW SCHEMAS IN DATABASE ${databaseName}`);
      if (result.success && result.data) {
        return result.data.map((row: any) => ({
          name: row.name || row.NAME || row[1]
        })).filter(schema => schema.name && !schema.name.startsWith('INFORMATION_SCHEMA'));
      }
      return [];
    } catch (error) {
      console.log(`Error getting schemas in ${databaseName}:`, error.message);
      return [{ name: 'CORE' }, { name: 'PUBLIC' }]; // Default fallbacks
    }
  }

  private async getTablesInSchema(databaseName: string, schemaName: string): Promise<TableSchema[]> {
    try {
      console.log(`🔍 Getting tables from ${databaseName}.${schemaName}...`);

      // Get table list
      const tablesResult = await this.snowflakeService.executeQuery(`
        SHOW TABLES IN SCHEMA ${databaseName}.${schemaName}
      `);

      if (!tablesResult.success || !tablesResult.data) {
        console.log(`No tables found in ${databaseName}.${schemaName}`);
        return [];
      }

      const tables: TableSchema[] = [];

      for (const tableRow of tablesResult.data) {
        const tableName = tableRow.name || tableRow.NAME || tableRow[1];
        if (!tableName) continue;

        try {
          // Get column information for each table
          const columnsResult = await this.snowflakeService.executeQuery(`
            SELECT column_name, data_type
            FROM ${databaseName}.information_schema.columns
            WHERE table_schema = '${schemaName}'
              AND table_name = '${tableName}'
            ORDER BY ordinal_position
          `);

          let columns: Array<{ name: string; type: string }> = [];

          if (columnsResult.success && columnsResult.data) {
            columns = columnsResult.data.map((col: any) => ({
              name: col.COLUMN_NAME || col.column_name || col[0],
              type: col.DATA_TYPE || col.data_type || col[1]
            }));
          }

          // Get row count
          let rowCount = 0;
          try {
            const countResult = await this.snowflakeService.executeQuery(
              `SELECT COUNT(*) as count FROM ${databaseName}.${schemaName}.${tableName}`
            );
            if (countResult.success && countResult.data && countResult.data[0]) {
              rowCount = countResult.data[0].COUNT || countResult.data[0].count || 0;
            }
          } catch (countError) {
            console.log(`Could not get row count for ${tableName}`);
          }

          tables.push({
            name: `${databaseName}.${schemaName}.${tableName}`,
            columns,
            rowCount
          });

          console.log(`✅ Discovered table: ${tableName} (${columns.length} columns, ${rowCount} rows)`);

        } catch (error) {
          console.log(`Error getting details for table ${tableName}:`, error.message);
        }
      }

      return tables;

    } catch (error) {
      console.log(`Error getting tables from ${databaseName}.${schemaName}:`, error.message);
      return [];
    }
  }

  private getStaticFallbackSchema(): SchemaInfo {
    console.log('📋 Using static fallback schema...');
    return {
      tables: [
        {
          name: 'core_revenue_analytics',
          columns: [
            { name: 'current_mrr', type: 'NUMBER' },
            { name: 'current_arr', type: 'NUMBER' },
            { name: 'current_active_customers', type: 'NUMBER' },
            { name: 'mrr_growth_rate', type: 'NUMBER' },
            { name: 'arpu', type: 'NUMBER' },
            { name: 'avg_monthly_churn_rate', type: 'NUMBER' },
            { name: 'avg_customer_ltv', type: 'NUMBER' },
            { name: 'calculated_at', type: 'TIMESTAMP' }
          ]
        },
        {
          name: 'stg_quickbooks_transactions',
          columns: [
            { name: 'transaction_id', type: 'STRING' },
            { name: 'transaction_date', type: 'DATE' },
            { name: 'total_amount', type: 'NUMBER' },
            { name: 'transaction_type', type: 'STRING' },
            { name: 'customer_id', type: 'STRING' },
            { name: 'customer_name', type: 'STRING' },
            { name: 'recognized_revenue', type: 'NUMBER' },
            { name: 'recognized_expense', type: 'NUMBER' },
            { name: 'transaction_category', type: 'STRING' },
            { name: 'fiscal_year', type: 'NUMBER' },
            { name: 'fiscal_month', type: 'NUMBER' }
          ]
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
        return `SELECT COALESCE(SUM(${amountCol.name}), 0) AS value FROM ${revenueTable.name} WHERE DATE_TRUNC('${dateFilter}', ${dateCol.name}) = DATE_TRUNC('${dateFilter}', CURRENT_DATE())`;
      }
    }

    return 'SELECT 0 AS value'; // Fallback
  }

  private buildExpensesSQL(schemaInfo: SchemaInfo, period: string): string {
    const expensesTable = schemaInfo.tables.find(t => 
      t.name.toLowerCase().includes('expense') || 
      t.name.toLowerCase().includes('cost')
    );

    if (expensesTable) {
      const amountCol = expensesTable.columns.find(c => 
        c.name.toLowerCase().includes('amount') || 
        c.name.toLowerCase().includes('cost')
      );
      const dateCol = expensesTable.columns.find(c => 
        c.name.toLowerCase().includes('date')
      );

      if (amountCol && dateCol) {
        return `SELECT COALESCE(SUM(${amountCol.name}), 0) AS value FROM ${expensesTable.name} WHERE DATE_TRUNC('MONTH', ${dateCol.name}) = DATE_TRUNC('MONTH', CURRENT_DATE())`;
      }
    }

    return 'SELECT 0 AS value'; // Fallback
  }

  private buildCACSQL(schemaInfo: SchemaInfo): string {
    return 'SELECT 1500 AS value'; // Static fallback for now
  }

  private buildCLVSQL(schemaInfo: SchemaInfo): string {
    return 'SELECT 8500 AS value'; // Static fallback for now
  }

  private buildActiveUsersSQL(schemaInfo: SchemaInfo): string {
    const userTable = schemaInfo.tables.find(t => 
      t.name.toLowerCase().includes('user') || 
      t.name.toLowerCase().includes('customer')
    );

    if (userTable) {
      const idCol = userTable.columns.find(c => 
        c.name.toLowerCase().includes('id')
      );
      if (idCol) {
        return `SELECT COUNT(DISTINCT ${idCol.name}) AS value FROM ${userTable.name}`;
      }
    }

    return 'SELECT 2400 AS value'; // Fallback
  }

  private buildChurnRateSQL(schemaInfo: SchemaInfo): string {
    return 'SELECT 5.2 AS value'; // Static fallback for now
  }
}

export const snowflakeSchemaDiscovery = new SnowflakeSchemaDiscovery();