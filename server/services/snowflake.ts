interface SnowflakeConfig {
  account: string;
  username: string;
  password: string;
  warehouse: string;
  database: string;
  schema: string;
}

interface QueryResult {
  success: boolean;
  data?: any[];
  value?: string;
  error?: string;
}

class SnowflakeService {
  private config: SnowflakeConfig;

  constructor() {
    this.config = {
      account: process.env.SNOWFLAKE_ACCOUNT || "",
      username: process.env.SNOWFLAKE_USERNAME || "",
      password: process.env.SNOWFLAKE_PASSWORD || "",
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH",
      database: process.env.SNOWFLAKE_DATABASE || "DATASYNC_PRO",
      schema: process.env.SNOWFLAKE_SCHEMA || "PUBLIC",
    };
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.config.account || !this.config.username || !this.config.password) {
        throw new Error("Missing Snowflake credentials in environment variables");
      }

      console.log("Testing Snowflake connection...");
      
      // Test basic connection first
      const testQuery = 'SELECT CURRENT_VERSION()';
      const result = await this.executeQuery(testQuery);
      
      return result.success ? { success: true } : { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createCompanyDatabase(companySlug: string): Promise<{ success: boolean; databaseName?: string; error?: string }> {
    try {
      // Generate unique database name for the company
      const databaseName = `${companySlug.toUpperCase()}_DB`;
      const schemaName = "ANALYTICS";
      
      console.log(`Creating company database ${databaseName} with schema ${schemaName}...`);
      
      // Create database if it doesn't exist
      const createDbQuery = `CREATE DATABASE IF NOT EXISTS ${databaseName}`;
      const dbResult = await this.executeQuery(createDbQuery);
      
      if (!dbResult.success) {
        return { success: false, error: `Failed to create database: ${dbResult.error}` };
      }

      // Use the database
      const useDbQuery = `USE DATABASE ${databaseName}`;
      const useDbResult = await this.executeQuery(useDbQuery);
      
      if (!useDbResult.success) {
        return { success: false, error: `Failed to use database: ${useDbResult.error}` };
      }

      // Create schema if it doesn't exist
      const createSchemaQuery = `CREATE SCHEMA IF NOT EXISTS ${schemaName}`;
      const schemaResult = await this.executeQuery(createSchemaQuery);
      
      if (!schemaResult.success) {
        return { success: false, error: `Failed to create schema: ${schemaResult.error}` };
      }

      console.log(`Successfully created company database ${databaseName} with schema ${schemaName}`);
      return { success: true, databaseName };
        
    } catch (error) {
      return { success: false, error: `Database creation failed: ${error.message}` };
    }
  }

  async executeQuery(sql: string): Promise<QueryResult> {
    try {
      if (!this.config.account) {
        throw new Error("Snowflake not configured");
      }

      console.log(`Executing Snowflake query: ${sql.substring(0, 100)}...`);
      
      // In a real implementation, you would execute the actual SQL query
      // For now, we'll return mock data based on common KPI queries
      if (sql.toLowerCase().includes("arr") || sql.toLowerCase().includes("revenue")) {
        return { success: true, value: "$2.4M", data: [{ value: 2400000 }] };
      } else if (sql.toLowerCase().includes("churn")) {
        return { success: true, value: "3.2%", data: [{ value: 0.032 }] };
      } else if (sql.toLowerCase().includes("ltv") || sql.toLowerCase().includes("lifetime")) {
        return { success: true, value: "$18,750", data: [{ value: 18750 }] };
      }

      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      return { success: true, data: [], value: "0" };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async createView(name: string, sql: string): Promise<{ success: boolean; error?: string }> {
    try {
      const createViewSQL = `CREATE OR REPLACE VIEW ${this.config.database}.${this.config.schema}.${name} AS ${sql}`;
      const result = await this.executeQuery(createViewSQL);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to create view");
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async listTables(): Promise<{ success: boolean; tables?: string[]; error?: string }> {
    try {
      const sql = `SHOW TABLES IN ${this.config.database}.${this.config.schema}`;
      const result = await this.executeQuery(sql);
      
      if (!result.success) {
        throw new Error(result.error || "Failed to list tables");
      }

      // Mock table list
      const tables = [
        "salesforce_accounts",
        "salesforce_opportunities",
        "salesforce_contacts",
        "hubspot_companies",
        "hubspot_deals",
        "hubspot_contacts",
        "quickbooks_customers",
        "quickbooks_invoices",
        "quickbooks_payments",
      ];

      return { success: true, tables };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getConnectionInfo() {
    return {
      warehouse: this.config.warehouse,
      database: this.config.database,
      schema: this.config.schema,
    };
  }
}

export const snowflakeService = new SnowflakeService();
