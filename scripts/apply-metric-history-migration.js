/**
 * Script to apply the metric_history migration that replaces the old ETL function
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config();

async function applyMigration() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log('🔄 Applying metric_history migration...');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/026-replace-etl-with-metric-history.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');

    console.log('📋 Migration content:');
    console.log(migrationContent.substring(0, 200) + '...');

    // Apply migration
    await client.unsafe(migrationContent);
    console.log('✅ Migration applied successfully!');

    console.log('\n🧪 Testing the new function...');

    // Test the function by calling it for a company
    const testResult = await client`
      SELECT populate_company_metrics_time_series(
        1757967976336::bigint,
        'daily'::text,
        CURRENT_DATE::date,
        CURRENT_DATE::date
      ) as result
    `;

    console.log('✅ Function test result:', testResult[0]?.result);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
applyMigration().catch(console.error);