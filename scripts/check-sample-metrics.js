/**
 * Script to check sample metrics data to understand format types
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config();

async function checkSampleMetrics() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log('🔍 Checking sample metrics data...\n');

    const companyId = 1757967976336;
    const schemaName = `analytics_company_${companyId}`;

    // Check sample data with format information
    const sampleData = await client`
      SELECT id, metric_key, name, yearly_goal, format, unit, calculation_type
      FROM ${client(schemaName)}.metrics
      WHERE is_active = true
      ORDER BY id
      LIMIT 10
    `;

    console.log('📋 SAMPLE METRICS DATA:');
    console.log('=======================');
    sampleData.forEach(row => {
      console.log(`   ID ${row.id}: ${row.metric_key} - "${row.name}"`);
      console.log(`       Goal: ${row.yearly_goal}, Format: ${row.format}, Unit: ${row.unit}`);
      console.log(`       Calculation Type: ${row.calculation_type}`);
      console.log('');
    });

    // Check distinct format values
    const distinctFormats = await client`
      SELECT DISTINCT format, COUNT(*) as count
      FROM ${client(schemaName)}.metrics
      WHERE is_active = true
      GROUP BY format
      ORDER BY format
    `;

    console.log('📊 DISTINCT FORMAT VALUES:');
    console.log('===========================');
    distinctFormats.forEach(row => {
      console.log(`   ${row.format}: ${row.count} metrics`);
    });

    // Check distinct calculation_type values
    const distinctCalcTypes = await client`
      SELECT DISTINCT calculation_type, COUNT(*) as count
      FROM ${client(schemaName)}.metrics
      WHERE is_active = true
      GROUP BY calculation_type
      ORDER BY calculation_type
    `;

    console.log('\n🧮 DISTINCT CALCULATION TYPES:');
    console.log('==============================');
    distinctCalcTypes.forEach(row => {
      console.log(`   ${row.calculation_type || 'NULL'}: ${row.count} metrics`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkSampleMetrics().catch(console.error);