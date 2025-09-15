/**
 * Script to analyze what's in metric_registry and how it's used
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config();

async function analyzeMetricRegistry() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log('🔍 Analyzing metric_registry usage...');

    // Check both companies
    const companies = [1757967976336, 1757970334411];

    for (const companyId of companies) {
      console.log(`\n📊 Company ${companyId}:`);
      const schemaName = `analytics_company_${companyId}`;

      try {
        // Check metric_registry structure
        const registryColumns = await client`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = ${schemaName}
            AND table_name = 'metric_registry'
          ORDER BY ordinal_position
        `;

        console.log(`   metric_registry columns:`);
        registryColumns.forEach(col => {
          console.log(`   - ${col.column_name}: ${col.data_type}`);
        });

        // Check data in metric_registry
        const registryData = await client`
          SELECT * FROM ${client(schemaName)}.metric_registry
          LIMIT 5
        `;

        console.log(`   metric_registry data (${registryData.length} rows):`);
        if (registryData.length > 0) {
          registryData.forEach(row => {
            console.log(`   - ${row.metric_key}: ${row.label || 'no label'}`);
          });
        } else {
          console.log(`   - (empty)`);
        }

        // Compare with metrics table
        const metricsData = await client`
          SELECT id, name, metric_key, yearly_goal FROM ${client(schemaName)}.metrics
          WHERE is_active = true
          LIMIT 5
        `;

        console.log(`   metrics table data (${metricsData.length} rows):`);
        metricsData.forEach(row => {
          console.log(`   - ID ${row.id}: ${row.metric_key} (${row.name}) - goal: ${row.yearly_goal}`);
        });

      } catch (error) {
        console.log(`   ❌ Error checking company ${companyId}: ${error.message}`);
      }
    }

    console.log('\n🔍 Summary:');
    console.log('   - metrics table: Primary storage for metric definitions');
    console.log('   - metric_history table: Daily actual vs goal tracking');
    console.log('   - metric_registry table: ???');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

// Run if called directly
analyzeMetricRegistry().catch(console.error);