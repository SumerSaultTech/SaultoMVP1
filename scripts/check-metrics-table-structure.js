/**
 * Script to check metrics table structure in company schemas
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config();

async function checkMetricsTableStructure() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log('🔍 Checking metrics table structure...\n');

    const companyId = 1757967976336;
    const schemaName = `analytics_company_${companyId}`;

    // Get metrics table structure
    const columns = await client`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = ${schemaName}
        AND table_name = 'metrics'
      ORDER BY ordinal_position
    `;

    console.log('📊 METRICS TABLE STRUCTURE:');
    console.log('===========================');
    columns.forEach(col => {
      const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
      const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
      console.log(`   ${col.column_name.padEnd(25)} ${col.data_type.padEnd(20)} ${nullable}${defaultVal}`);
    });

    // Check if there's a metric_type or similar column
    const typeColumns = columns.filter(col =>
      col.column_name.includes('type') ||
      col.column_name.includes('format') ||
      col.column_name.includes('unit')
    );

    console.log('\n🏷️ TYPE/FORMAT RELATED COLUMNS:');
    console.log('================================');
    if (typeColumns.length > 0) {
      typeColumns.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('   No type/format columns found');
    }

    // Check sample data
    const sampleData = await client`
      SELECT id, metric_key, name, yearly_goal, format_type
      FROM ${client(schemaName)}.metrics
      LIMIT 3
    `;

    console.log('\n📋 SAMPLE METRICS DATA:');
    console.log('=======================');
    sampleData.forEach(row => {
      console.log(`   ID ${row.id}: ${row.metric_key} - "${row.name}"`);
      console.log(`       Goal: ${row.yearly_goal}, Format: ${row.format_type}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

checkMetricsTableStructure().catch(console.error);