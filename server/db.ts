// Snowflake configuration - no PostgreSQL dependency
import * as schema from "@shared/schema";

// Check for Snowflake environment variables
const requiredSnowflakeVars = [
  'SNOWFLAKE_ACCOUNT',
  'SNOWFLAKE_USER',
  'SNOWFLAKE_WAREHOUSE',
  'SNOWFLAKE_DATABASE'
];

// Check if we have either password or token authentication
const hasPassword = !!process.env.SNOWFLAKE_PASSWORD;
const hasToken = !!process.env.SNOWFLAKE_ACCESS_TOKEN;

const missingVars = requiredSnowflakeVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0 || (!hasPassword && !hasToken)) {
  console.warn(`Snowflake credentials not fully configured. Missing: ${missingVars.join(', ')}`);
  if (!hasPassword && !hasToken) {
    console.warn('Missing authentication: need either SNOWFLAKE_PASSWORD or SNOWFLAKE_ACCESS_TOKEN');
  }
  console.warn('Using in-memory storage for development');
} else {
  const authMethod = hasToken ? 'access token' : 'password';
  console.log(`Snowflake credentials configured successfully using ${authMethod}`);
}

// Export a simple connection status for the application
export const snowflakeConfig = {
  account: process.env.SNOWFLAKE_ACCOUNT,
  user: process.env.SNOWFLAKE_USER,
  password: process.env.SNOWFLAKE_PASSWORD,
  token: process.env.SNOWFLAKE_ACCESS_TOKEN,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE,
  database: process.env.SNOWFLAKE_DATABASE,
  schema: process.env.SNOWFLAKE_SCHEMA || 'PUBLIC',
  isConfigured: missingVars.length === 0 && (hasPassword || hasToken),
  authMethod: hasToken ? 'token' : 'password'
};
