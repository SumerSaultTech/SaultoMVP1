/**
 * Script to update metric_history table for a single company
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

async function updateCompanySchema(companyId) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log(`🔄 Updating metric_history schema for company ${companyId}...`);

    const schemaName = `analytics_company_${companyId}`;

    // Read the metric_history migration
    const migrationPath = path.join(__dirname, '../migrations/023-update-metric-history-daily-goals.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');

    // Replace placeholders
    const companyMigration = migrationContent
      .replace(/{COMPANY_SCHEMA}/g, schemaName)
      .replace(/{COMPANY_ID}/g, companyId);

    console.log('📋 Applying metric_history table migration...');

    await client.unsafe(companyMigration);
    console.log('✅ Migration applied successfully!');

    // Check the new structure
    const columns = await client`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = ${schemaName}
        AND table_name = 'metric_history'
      ORDER BY ordinal_position
    `;

    console.log('📊 New table structure:');
    columns.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type}`);
    });

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
const companyId = process.argv[2] || '1757970334411';
updateCompanySchema(companyId).catch(console.error);