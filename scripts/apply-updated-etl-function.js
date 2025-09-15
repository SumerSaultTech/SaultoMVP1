/**
 * Script to apply updated ETL function that handles ratio metrics
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

async function applyUpdatedETLFunction() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log('🔄 Applying updated ETL function for ratio metrics...\n');

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/029-update-etl-handle-ratio-metrics.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');

    console.log('📝 Applying updated function definition...');
    await client.unsafe(migrationContent);
    console.log('✅ Updated ETL function applied successfully');

    console.log('\n🎉 ETL Function Update Completed!');
    console.log('📊 New Features:');
    console.log('   - actual_value = NULL for percentage/average metrics');
    console.log('   - numerator/denominator populated for ratio metrics');
    console.log('   - Simple metrics still use actual_value normally');

  } catch (error) {
    console.error('❌ ETL function update failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

applyUpdatedETLFunction().catch(console.error);