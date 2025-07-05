// Snowflake configuration - no PostgreSQL dependency
import * as schema from "@shared/schema";

// Check for Snowflake environment variables
const requiredSnowflakeVars = [
  'SNOWFLAKE_ACCOUNT',
  'SNOWFLAKE_USER',
  'SNOWFLAKE_WAREHOUSE',
  'SNOWFLAKE_DATABASE'
];

// Check if we have token authentication (password authentication disabled to avoid MFA)
const hasToken = !!process.env.SNOWFLAKE_ACCESS_TOKEN;

const missingVars = requiredSnowflakeVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 || !hasToken) {
  console.warn(`Snowflake credentials not fully configured. Missing: ${missingVars.join(', ')}`);
  if (!hasToken) {
    console.warn('Missing authentication: SNOWFLAKE_ACCESS_TOKEN is required (password auth disabled to avoid MFA)');
  }
  console.warn('Using in-memory storage for development');
} else {
  console.log('Snowflake credentials configured successfully using access token');
}

// Export a simple connection status for the application
export const snowflakeConfig = {
  account: process.env.SNOWFLAKE_ACCOUNT,
  user: process.env.SNOWFLAKE_USER,
  token: process.env.SNOWFLAKE_ACCESS_TOKEN,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA || 'PUBLIC',
  isConfigured: missingVars.length === 0 && hasToken,
  authMethod: 'token'
};
