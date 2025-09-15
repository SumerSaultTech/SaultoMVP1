/**
 * Script to update metric_history tables for all existing companies
 * This applies the new table structure and ETL function to all company schemas
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

async function updateMetricHistoryTables() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);
  const db = drizzle(client);

  try {
    console.log('🔄 Starting metric_history table updates...');

    // Get all active companies
    const companies = await client`
      SELECT id, name, slug
      FROM companies
      WHERE is_active = true
      ORDER BY id
    `;

    console.log(`📋 Found ${companies.length} active companies to update`);

    // Read migration files
    const migration1Path = path.join(__dirname, '../migrations/023-update-metric-history-daily-goals.sql');
    const migration2Path = path.join(__dirname, '../migrations/024-create-simple-daily-etl.sql');

    const migration1Content = fs.readFileSync(migration1Path, 'utf8');
    const migration2Content = fs.readFileSync(migration2Path, 'utf8');

    // Apply table structure updates for each company
    for (const company of companies) {
      const companyId = company.id;
      const companySchema = `analytics_company_${companyId}`;

      console.log(`\n🏢 Updating company ${companyId} (${company.name})`);
      console.log(`   Schema: ${companySchema}`);

      try {
        // Check if company schema exists
        const schemaExists = await client`
          SELECT EXISTS(
            SELECT 1 FROM information_schema.schemata
            WHERE schema_name = ${companySchema}
          )
        `;

        if (!schemaExists[0].exists) {
          console.log(`   ⚠️ Schema ${companySchema} does not exist, skipping...`);
          continue;
        }

        // Apply migration 1: Update metric_history table structure
        const migration1SQL = migration1Content
          .replace(/{COMPANY_SCHEMA}/g, companySchema)
          .replace(/{COMPANY_ID}/g, companyId);

        await client.unsafe(migration1SQL);
        console.log(`   ✅ Updated metric_history table structure`);

        // Check if company has any metrics
        const metricsCount = await client`
          SELECT COUNT(*) as count
          FROM ${client(companySchema)}.metrics
          WHERE is_active = true
        `;

        console.log(`   📊 Found ${metricsCount[0].count} active metrics`);

      } catch (error) {
        console.error(`   ❌ Failed to update company ${companyId}:`, error.message);
        // Continue with other companies
      }
    }

    // Apply migration 2: Create the new ETL function (global)
    console.log(`\n🔧 Creating new daily ETL function...`);
    await client.unsafe(migration2Content);
    console.log(`✅ Daily ETL function created`);

    console.log(`\n🎉 All updates completed successfully!`);
    console.log(`\nNext steps:`);
    console.log(`1. Create a new metric to test immediate population`);
    console.log(`2. Check metric_history table for populated data`);
    console.log(`3. Verify 15-minute sync continues to work`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
updateMetricHistoryTables().catch(console.error);

export { updateMetricHistoryTables };