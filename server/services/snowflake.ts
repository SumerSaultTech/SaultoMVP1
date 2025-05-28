const snowflake = require('snowflake-sdk');

interface SnowflakeConfig {
  account: string;
  username: string;
  password: string;
  warehouse: string;
  database?: string;
  schema?: string;
}

interface QueryResult {
  success: boolean;
  data?: any[];
  value?: string;
  error?: string;
}

class SnowflakeService {
  private config: SnowflakeConfig;
  private connection: any = null;

  constructor() {
    this.config = {
      account: process.env.SNOWFLAKE_ACCOUNT || "",
      username: process.env.SNOWFLAKE_USERNAME || "",
      password: process.env.SNOWFLAKE_PASSWORD || "",
      warehouse: process.env.SNOWFLAKE_WAREHOUSE || "COMPUTE_WH",
      database: process.env.SNOWFLAKE_DATABASE,
      schema: process.env.SNOWFLAKE_SCHEMA,
    };
  }

  private async getConnection(): Promise<any> {
    if (this.connection) {
      return this.connection;
    }

    return new Promise((resolve, reject) => {
      console.log('Creating Snowflake connection with config:');
      console.log('- Account:', this.config.account);
      console.log('- Username:', this.config.username);
      console.log('- Warehouse:', this.config.warehouse);
      
      this.connection = snowflake.createConnection({
        account: this.config.account,
        username: this.config.username,
        password: this.config.password,
        warehouse: this.config.warehouse,
        database: this.config.database,
        schema: this.config.schema,
        // Add additional connection options for better debugging
        timeout: 60000,
        clientSessionKeepAlive: true,
        clientSessionKeepAliveHeartbeatFrequency: 3600
      });

      this.connection.connect((err: any, conn: any) => {
        if (err) {
          console.error('❌ Failed to connect to Snowflake:', err);
          console.error('Error code:', err.code);
          console.error('Error message:', err.message);
          console.error('Error response:', err.response);
          reject(err);
        } else {
          console.log('✅ Successfully connected to Snowflake');
          console.log('Connection ID:', conn.getId());
          resolve(conn);
        }
      });
    });
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
      console.log(`🔄 Executing Snowflake query: ${sql}...`);
      
      const connection = await this.getConnection();
      
      return new Promise((resolve) => {
        connection.execute({
          sqlText: sql,
          complete: (err: any, stmt: any, rows: any) => {
            if (err) {
              console.error("❌ Snowflake query failed:", err);
              console.error("Query that failed:", sql);
              console.error("Error details:", {
                code: err.code,
                message: err.message,
                sqlState: err.sqlState
              });
              resolve({
                success: false,
                error: `${err.code}: ${err.message}`
              });
            } else {
              console.log("✅ Snowflake query executed successfully");
              console.log("Query:", sql);
              console.log("Rows returned:", rows ? rows.length : 0);
              if (rows && rows.length > 0) {
                console.log("Sample result:", rows[0]);
              }
              resolve({
                success: true,
                data: rows,
                value: rows && rows.length > 0 ? rows[0] : null
              });
            }
          }
        });
      });
    } catch (error: any) {
      console.error("❌ Snowflake connection or query failed:", error);
      console.error("Error stack:", error.stack);
      return {
        success: false,
        error: `Connection error: ${error.message}`
      };
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
