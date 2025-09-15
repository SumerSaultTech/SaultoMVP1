/**
 * Script to check table structure for companies
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config();

async function checkTableStructure() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log('🔍 Checking table structures...');

    // Check both companies
    const companies = [1757967976336, 1757970334411];

    for (const companyId of companies) {
      console.log(`\n📊 Company ${companyId}:`);
      const schemaName = `analytics_company_${companyId}`;

      try {
        // Check if metric_history table exists and its columns
        const columns = await client`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_schema = ${schemaName}
            AND table_name = 'metric_history'
          ORDER BY ordinal_position
        `;

        if (columns.length > 0) {
          console.log(`   metric_history table exists with columns:`);
          columns.forEach(col => {
            console.log(`   - ${col.column_name}: ${col.data_type}`);
          });

          // Try to count rows
          const rowCount = await client`
            SELECT COUNT(*) as count FROM ${client(schemaName)}.metric_history
          `;
          console.log(`   Row count: ${rowCount[0].count}`);

        } else {
          console.log('   ❌ metric_history table does not exist or has no columns');
        }

      } catch (error) {
        console.log(`   ❌ Error checking company ${companyId}: ${error.message}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
  }
}

// Run if called directly
checkTableStructure().catch(console.error);