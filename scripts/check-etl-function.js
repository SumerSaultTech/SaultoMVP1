/**
 * Script to check current ETL function definition
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config();

async function checkETLFunction() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log('🔍 Checking current ETL function definition...\n');

    const functionDef = await client`
      SELECT routine_definition
      FROM information_schema.routines
      WHERE routine_name = 'populate_company_metrics_time_series'
        AND routine_schema = 'public'
    `;

    if (functionDef.length > 0) {
      console.log('📋 Current ETL Function Definition:');
      console.log('==================================');
      console.log(functionDef[0].routine_definition);
    } else {
      console.log('❌ ETL function not found');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkETLFunction().catch(console.error);