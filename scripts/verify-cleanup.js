/**
 * Script to verify metric_registry cleanup was successful
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config();

async function verifyCleanup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log('🔍 Verifying metric_registry cleanup...\n');

    // Get all companies
    const companies = await client`
      SELECT id, name
      FROM companies
      WHERE is_active = true
      ORDER BY id
    `;

    console.log(`📋 Checking ${companies.length} companies for simplified architecture\n`);

    let totalTablesFound = {
      metrics: 0,
      metric_history: 0,
      metric_registry: 0
    };

    for (const company of companies) {
      const companyId = company.id;
      const schemaName = `analytics_company_${companyId}`;

      console.log(`🏢 Company ${companyId} (${company.name}):`);

      try {
        // Check what tables exist in this schema
        const tables = await client`
          SELECT table_name
          FROM information_schema.tables
          WHERE table_schema = ${schemaName}
            AND table_name IN ('metrics', 'metric_history', 'metric_registry')
          ORDER BY table_name
        `;

        const foundTables = tables.map(t => t.table_name);

        if (foundTables.includes('metrics')) {
          totalTablesFound.metrics++;
          console.log(`   ✅ metrics table exists`);
        } else {
          console.log(`   ❌ metrics table missing`);
        }

        if (foundTables.includes('metric_history')) {
          totalTablesFound.metric_history++;
          console.log(`   ✅ metric_history table exists`);
        } else {
          console.log(`   ❌ metric_history table missing`);
        }

        if (foundTables.includes('metric_registry')) {
          totalTablesFound.metric_registry++;
          console.log(`   ❌ metric_registry table still exists (should be removed!)`);
        } else {
          console.log(`   ✅ metric_registry table removed`);
        }

        // Check data counts
        if (foundTables.includes('metrics')) {
          const metricsCount = await client`
            SELECT COUNT(*) as count FROM ${client(schemaName)}.metrics
          `;
          console.log(`   📊 metrics: ${metricsCount[0].count} rows`);
        }

        if (foundTables.includes('metric_history')) {
          const historyCount = await client`
            SELECT COUNT(*) as count FROM ${client(schemaName)}.metric_history
          `;
          console.log(`   📊 metric_history: ${historyCount[0].count} rows`);
        }

      } catch (error) {
        console.log(`   ❌ Error checking company ${companyId}: ${error.message}`);
      }

      console.log();
    }

    // Summary
    console.log('📊 CLEANUP VERIFICATION SUMMARY:');
    console.log('================================');
    console.log(`✅ Companies with metrics table: ${totalTablesFound.metrics}/${companies.length}`);
    console.log(`✅ Companies with metric_history table: ${totalTablesFound.metric_history}/${companies.length}`);

    if (totalTablesFound.metric_registry === 0) {
      console.log(`✅ metric_registry tables removed: 0 remaining (perfect!)`);
      console.log('🎉 Architecture successfully simplified to: metrics + metric_history only');
    } else {
      console.log(`❌ metric_registry tables still exist: ${totalTablesFound.metric_registry} found`);
      console.log('⚠️ Additional cleanup needed');
    }

  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await client.end();
  }
}

// Run if called directly
verifyCleanup().catch(console.error);