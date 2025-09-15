/**
 * Script to check metric_history for all companies
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config();

async function checkAllMetricHistory() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log('🔍 Checking metric_history data for all companies...');

    // Check both companies
    const companies = [1757967976336, 1757970334411];

    for (const companyId of companies) {
      console.log(`\n📊 Company ${companyId}:`);
      const schemaName = `analytics_company_${companyId}`;

      try {
        const metricHistoryData = await client`
          SELECT * FROM ${client(schemaName)}.metric_history
          ORDER BY date DESC, metric_id
          LIMIT 5
        `;

        console.log(`   Found ${metricHistoryData.length} metric_history records:`);

        if (metricHistoryData.length > 0) {
          metricHistoryData.forEach(row => {
            console.log(`   - Metric ${row.metric_id}: ${row.date} | actual=${row.actual_value} goal=${row.goal_value} period=${row.period}`);
          });
        } else {
          console.log('   ❌ No metric_history records found');
        }

        // Also check what metrics exist
        const metrics = await client`
          SELECT id, name, yearly_goal FROM ${client(schemaName)}.metrics
          WHERE is_active = true
          ORDER BY id
        `;

        console.log(`   Active metrics: ${metrics.map(m => `${m.id}:${m.name}`).join(', ')}`);

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
checkAllMetricHistory().catch(console.error);