
import { snowflakeSimpleService } from './snowflake-simple';

interface TableInfo {
  tableName: string;
  schemaName: string;
  columns: ColumnInfo[];
}

interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: string;
}

export class SnowflakeSchemaService {
  private schemaCache: TableInfo[] = [];
  private lastCacheUpdate: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  async getAvailableTables(): Promise<TableInfo[]> {
    // Return cached results if still valid
    if (this.schemaCache.length > 0 && Date.now() - this.lastCacheUpdate < this.CACHE_DURATION) {
      return this.schemaCache;
    }

    try {
      console.log('🔍 Discovering Snowflake schema...');
      
      // Get all tables in the current database and schema
      const tablesResult = await snowflakeSimpleService.executeQuery(`
        SELECT 
          table_name,
          table_schema,
          table_type
        FROM information_schema.tables 
        WHERE table_schema = 'CORE'
        ORDER BY table_name
      `);

      if (!tablesResult.success || !tablesResult.data) {
        console.error('Failed to get tables:', tablesResult.error);
        return [];
      }

      const tables: TableInfo[] = [];

      // For each table, get its columns
      for (const table of tablesResult.data) {
        const columnsResult = await snowflakeSimpleService.executeQuery(`
          SELECT 
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns 
          WHERE table_schema = 'CORE' 
            AND table_name = '${table.TABLE_NAME}'
          ORDER BY ordinal_position
        `);

        if (columnsResult.success && columnsResult.data) {
          tables.push({
            tableName: table.TABLE_NAME,
            schemaName: table.TABLE_SCHEMA,
            columns: columnsResult.data.map((col: any) => ({
              columnName: col.COLUMN_NAME,
              dataType: col.DATA_TYPE,
              isNullable: col.IS_NULLABLE
            }))
          });
        }
      }

      this.schemaCache = tables;
      this.lastCacheUpdate = Date.now();
      
      console.log(`✅ Discovered ${tables.length} tables in Snowflake`);
      return tables;

    } catch (error) {
      console.error('Error discovering schema:', error);
      return [];
    }
  }

  async findTablesForMetric(metricName: string, metricDescription: string): Promise<TableInfo[]> {
    const allTables = await this.getAvailableTables();
    
    // Simple keyword matching to find relevant tables
    const keywords = this.extractKeywords(metricName, metricDescription);
    const relevantTables: TableInfo[] = [];

    for (const table of allTables) {
      const tableScore = this.calculateRelevanceScore(table, keywords);
      if (tableScore > 0) {
        relevantTables.push(table);
      }
    }

    return relevantTables.sort((a, b) => 
      this.calculateRelevanceScore(b, keywords) - this.calculateRelevanceScore(a, keywords)
    );
  }

  private extractKeywords(metricName: string, metricDescription: string): string[] {
    const text = `${metricName} ${metricDescription}`.toLowerCase();
    const keywords: string[] = [];

    // Common business metric keywords
    const businessKeywords = [
      'revenue', 'sales', 'deal', 'customer', 'contact', 'account',
      'expense', 'cost', 'invoice', 'payment', 'transaction', 'order',
      'user', 'subscription', 'contract', 'opportunity', 'lead',
      'product', 'service', 'item', 'line_item'
    ];

    for (const keyword of businessKeywords) {
      if (text.includes(keyword)) {
        keywords.push(keyword);
      }
    }

    // Add words from the metric name/description
    const words = text.split(/\s+/).filter(word => word.length > 3);
    keywords.push(...words);

    return [...new Set(keywords)]; // Remove duplicates
  }

  private calculateRelevanceScore(table: TableInfo, keywords: string[]): number {
    let score = 0;
    const tableName = table.tableName.toLowerCase();

    // Score based on table name matches
    for (const keyword of keywords) {
      if (tableName.includes(keyword)) {
        score += 10;
      }
    }

    // Score based on column name matches
    for (const column of table.columns) {
      const columnName = column.columnName.toLowerCase();
      for (const keyword of keywords) {
        if (columnName.includes(keyword)) {
          score += 5;
        }
      }

      // Bonus for common metric columns
      if (columnName.includes('amount') || columnName.includes('value') || 
          columnName.includes('total') || columnName.includes('sum')) {
        score += 3;
      }

      if (columnName.includes('date') || columnName.includes('time') || 
          columnName.includes('created') || columnName.includes('updated')) {
        score += 2;
      }
    }

    return score;
  }

  async generateSQLForMetric(metricName: string, metricDescription: string, timePeriod: string = 'monthly'): Promise<string | null> {
    const relevantTables = await this.findTablesForMetric(metricName, metricDescription);
    
    if (relevantTables.length === 0) {
      console.log(`No relevant tables found for metric: ${metricName}`);
      return null;
    }

    const primaryTable = relevantTables[0];
    console.log(`Generating SQL for metric "${metricName}" using table: ${primaryTable.tableName}`);

    // Find value/amount column
    const valueColumn = this.findValueColumn(primaryTable);
    const dateColumn = this.findDateColumn(primaryTable);

    if (!valueColumn) {
      console.log(`No value column found in ${primaryTable.tableName}`);
      return null;
    }

    // Generate SQL based on metric type and time period
    let sql = `SELECT `;
    
    if (metricName.toLowerCase().includes('count') || metricName.toLowerCase().includes('number')) {
      sql += `COUNT(*) as value`;
    } else {
      sql += `SUM(${valueColumn}) as value`;
    }

    sql += `\nFROM ${primaryTable.tableName}`;

    // Add time filter if date column exists
    if (dateColumn) {
      sql += `\nWHERE `;
      
      switch (timePeriod.toLowerCase()) {
        case 'monthly':
          sql += `date_trunc('month', ${dateColumn}) = date_trunc('month', current_date())`;
          break;
        case 'yearly':
          sql += `date_trunc('year', ${dateColumn}) = date_trunc('year', current_date())`;
          break;
        case 'weekly':
          sql += `date_trunc('week', ${dateColumn}) = date_trunc('week', current_date())`;
          break;
        default:
          sql += `${dateColumn} >= current_date() - INTERVAL '30 days'`;
      }
    }

    return sql;
  }

  private findValueColumn(table: TableInfo): string | null {
    // Look for common value column names
    const valueColumns = ['amount', 'value', 'total', 'sum', 'price', 'cost', 'revenue'];
    
    for (const col of table.columns) {
      const colName = col.columnName.toLowerCase();
      for (const valueCol of valueColumns) {
        if (colName.includes(valueCol)) {
          return col.columnName;
        }
      }
    }

    // Look for numeric columns
    for (const col of table.columns) {
      if (col.dataType.includes('NUMBER') || col.dataType.includes('DECIMAL') || 
          col.dataType.includes('FLOAT') || col.dataType.includes('INTEGER')) {
        return col.columnName;
      }
    }

    return null;
  }

  private findDateColumn(table: TableInfo): string | null {
    // Look for common date column names
    const dateColumns = ['date', 'created_at', 'updated_at', 'timestamp', 'time'];
    
    for (const col of table.columns) {
      const colName = col.columnName.toLowerCase();
      for (const dateCol of dateColumns) {
        if (colName.includes(dateCol)) {
          return col.columnName;
        }
      }
    }

    // Look for date/timestamp types
    for (const col of table.columns) {
      if (col.dataType.includes('DATE') || col.dataType.includes('TIMESTAMP')) {
        return col.columnName;
      }
    }

    return null;
  }
}

export const snowflakeSchemaService = new SnowflakeSchemaService();
