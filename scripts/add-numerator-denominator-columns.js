/**
 * Script to add numerator and denominator columns to metric_history table
 * Enables tracking of percentage/ratio/average metric components
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

async function addNumeratorDenominatorColumns() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log('📊 Adding numerator and denominator columns to metric_history tables...\n');

    // Get all active companies
    const companies = await client`
      SELECT id, name, slug
      FROM companies
      WHERE is_active = true
      ORDER BY id
    `;

    console.log(`📋 Found ${companies.length} active companies to update`);

    // Read migration file
    const migrationPath = path.join(__dirname, '../migrations/028-add-numerator-denominator-to-metric-history.sql');
    const migrationContent = fs.readFileSync(migrationPath, 'utf8');

    let totalTablesUpdated = 0;

    for (const company of companies) {
      const companyId = company.id;
      const schemaName = `analytics_company_${companyId}`;

      console.log(`\n🏢 Updating company ${companyId} (${company.name})`);
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

        // Check if metric_history table exists
        const tableExists = await client`
          SELECT EXISTS(
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = ${schemaName}
              AND table_name = 'metric_history'
          )
        `;

        if (!tableExists[0].exists) {
          console.log(`   ⚠️ metric_history table does not exist, skipping...`);
          continue;
        }

        // Check if columns already exist
        const columnsExist = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = ${schemaName}
            AND table_name = 'metric_history'
            AND column_name IN ('numerator', 'denominator')
        `;

        if (columnsExist.length === 2) {
          console.log(`   ✅ numerator and denominator columns already exist`);
          continue;
        }

        // Apply migration to add columns
        const companyMigration = migrationContent
          .replace(/{COMPANY_SCHEMA}/g, schemaName);

        await client.unsafe(companyMigration);
        console.log(`   ✅ Added numerator and denominator columns to ${schemaName}.metric_history`);
        totalTablesUpdated++;

        // Verify columns were added
        const newColumnsExist = await client`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = ${schemaName}
            AND table_name = 'metric_history'
            AND column_name IN ('numerator', 'denominator')
        `;

        if (newColumnsExist.length === 2) {
          console.log(`   ✅ Verified: numerator and denominator columns successfully added`);
        } else {
          console.log(`   ❌ Warning: columns may not have been added correctly`);
        }

      } catch (error) {
        console.error(`   ❌ Failed to update company ${companyId}:`, error.message);
        // Continue with other companies
      }
    }

    console.log(`\n🎉 Column addition completed!`);
    console.log(`📊 Summary:`);
    console.log(`   - Companies processed: ${companies.length}`);
    console.log(`   - metric_history tables updated: ${totalTablesUpdated}`);
    console.log(`   - New columns: numerator (DECIMAL), denominator (DECIMAL)`);
    console.log(`   - Purpose: Track percentage/ratio/average metric components`);

  } catch (error) {
    console.error('❌ Column addition failed:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run if called directly
addNumeratorDenominatorColumns().catch(console.error);

export { addNumeratorDenominatorColumns };