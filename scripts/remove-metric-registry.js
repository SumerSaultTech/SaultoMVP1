/**
 * Script to remove metric_registry table from all company schemas
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

async function removeMetricRegistry() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log('🗑️ Removing metric_registry tables from all company schemas...\n');

    // Get all active companies
    const companies = await client`
      SELECT id, name, slug
      FROM companies
      WHERE is_active = true
      ORDER BY id
    `;

    console.log(`📋 Found ${companies.length} active companies to clean up`);

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/027-remove-metric-registry-table.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');

    let totalTablesRemoved = 0;

    for (const company of companies) {
      const companyId = company.id;
      const schemaName = `analytics_company_${companyId}`;

      console.log(`\n🏢 Cleaning up company ${companyId} (${company.name})`);
      console.log(`   Schema: ${schemaName}`);

      try {
        // Check if schema exists
        const schemaExists = await client`
          SELECT EXISTS(
            SELECT 1 FROM information_schema.schemata
            WHERE schema_name = ${schemaName}
          )
        `;

        if (!schemaExists[0].exists) {
          console.log(`   ⚠️ Schema ${schemaName} does not exist, skipping...`);
          continue;
        }

        // Check if metric_registry table exists
        const tableExists = await client`
          SELECT EXISTS(
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = ${schemaName}
              AND table_name = 'metric_registry'
          )
        `;

        if (!tableExists[0].exists) {
          console.log(`   ✅ metric_registry table already removed or never existed`);
          continue;
        }

        // Check table data before removal
        const rowCount = await client`
          SELECT COUNT(*) as count FROM ${client(schemaName)}.metric_registry
        `;

        console.log(`   📊 metric_registry table has ${rowCount[0].count} rows`);

        // Apply migration to remove table
        const companyMigration = migrationContent
          .replace(/{COMPANY_SCHEMA}/g, schemaName);

        await client.unsafe(companyMigration);
        console.log(`   ✅ Removed metric_registry table from ${schemaName}`);
        totalTablesRemoved++;

        // Verify removal
        const tableStillExists = await client`
          SELECT EXISTS(
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = ${schemaName}
              AND table_name = 'metric_registry'
          )
        `;

        if (!tableStillExists[0].exists) {
          console.log(`   ✅ Verified: metric_registry table successfully removed`);
        } else {
          console.log(`   ❌ Warning: metric_registry table still exists after removal attempt`);
        }

      } catch (error) {
        console.error(`   ❌ Failed to clean up company ${companyId}:`, error.message);
        // Continue with other companies
      }
    }

    console.log(`\n🎉 Cleanup completed!`);
    console.log(`📊 Summary:`);
    console.log(`   - Companies processed: ${companies.length}`);
    console.log(`   - metric_registry tables removed: ${totalTablesRemoved}`);
    console.log(`   - Simplified architecture: metrics + metric_history only`);

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
removeMetricRegistry().catch(console.error);

export { removeMetricRegistry };