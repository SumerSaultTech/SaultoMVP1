/**
 * Script to compare metrics vs metric_registry table structures
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config();

async function compareMetricsTables() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log('🔍 Comparing metrics vs metric_registry table structures...\n');

    const companyId = 1757967976336;
    const schemaName = `analytics_company_${companyId}`;

    // Get metrics table structure
    const metricsColumns = await client`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = ${schemaName}
        AND table_name = 'metrics'
      ORDER BY ordinal_position
    `;

    // Get metric_registry table structure
    const registryColumns = await client`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = ${schemaName}
        AND table_name = 'metric_registry'
      ORDER BY ordinal_position
    `;

    console.log('📊 METRICS TABLE STRUCTURE:');
    console.log('==========================');
    metricsColumns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`   ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${nullable}${defaultVal}`);
    });

    console.log('\n📋 METRIC_REGISTRY TABLE STRUCTURE:');
    console.log('====================================');
    registryColumns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`   ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${nullable}${defaultVal}`);
    });

    // Compare column names
    const metricsColumnNames = metricsColumns.map(c => c.column_name);
    const registryColumnNames = registryColumns.map(c => c.column_name);

    console.log('\n🔄 COLUMN COMPARISON:');
    console.log('=====================');

    console.log('\n✅ Columns ONLY in metrics table:');
    const onlyInMetrics = metricsColumnNames.filter(name => !registryColumnNames.includes(name));
    onlyInMetrics.forEach(col => console.log(`   - ${col}`));

    console.log('\n🔶 Columns ONLY in metric_registry table:');
    const onlyInRegistry = registryColumnNames.filter(name => !metricsColumnNames.includes(name));
    onlyInRegistry.forEach(col => console.log(`   - ${col}`));

    console.log('\n🤝 Columns in BOTH tables:');
    const inBoth = metricsColumnNames.filter(name => registryColumnNames.includes(name));
    inBoth.forEach(col => console.log(`   - ${col}`));

    // Check actual data
    console.log('\n📊 DATA COMPARISON:');
    console.log('===================');

    const metricsData = await client`
      SELECT COUNT(*) as count FROM ${client(schemaName)}.metrics
    `;

    const registryData = await client`
      SELECT COUNT(*) as count FROM ${client(schemaName)}.metric_registry
    `;

    console.log(`   metrics table:        ${metricsData[0].count} rows`);
    console.log(`   metric_registry table: ${registryData[0].count} rows`);

    // Show sample data
    if (metricsData[0].count > 0) {
      const sampleMetrics = await client`
        SELECT id, metric_key, name, yearly_goal, is_active
        FROM ${client(schemaName)}.metrics
        LIMIT 3
      `;
      console.log('\n📋 Sample metrics data:');
      sampleMetrics.forEach(row => {
        console.log(`   ID ${row.id}: ${row.metric_key} - "${row.name}" (goal: ${row.yearly_goal}, active: ${row.is_active})`);
      });
    }

    if (registryData[0].count > 0) {
      const sampleRegistry = await client`
        SELECT metric_key, label, unit, is_active
        FROM ${client(schemaName)}.metric_registry
        LIMIT 3
      `;
      console.log('\n📋 Sample metric_registry data:');
      sampleRegistry.forEach(row => {
        console.log(`   ${row.metric_key}: "${row.label}" (unit: ${row.unit}, active: ${row.is_active})`);
      });
    } else {
      console.log('\n📋 metric_registry table is empty');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

// Run if called directly
compareMetricsTables().catch(console.error);