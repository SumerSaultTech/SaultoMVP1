// Snowflake configuration - no PostgreSQL dependency
import * as schema from "@shared/schema";

// Check for Snowflake environment variables
const requiredSnowflakeVars = [
  'SNOWFLAKE_ACCOUNT',
  'SNOWFLAKE_USER', 
  'SNOWFLAKE_PASSWORD',
  'SNOWFLAKE_WAREHOUSE',
  'SNOWFLAKE_DATABASE'
];

const missingVars = requiredSnowflakeVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.warn(`Snowflake credentials not fully configured. Missing: ${missingVars.join(', ')}`);
  console.warn('Using in-memory storage for development');
} else {
  console.log('Snowflake credentials configured successfully');
}

// Export a simple connection status for the application
export const snowflakeConfig = {
  account: process.env.SNOWFLAKE_ACCOUNT,
  user: process.env.SNOWFLAKE_USER,
  password: process.env.SNOWFLAKE_PASSWORD,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA || 'PUBLIC',
  isConfigured: missingVars.length === 0
};
