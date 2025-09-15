/**
 * Script to check if metric_history is populated
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config();

async function checkMetricHistory() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log('🔍 Checking metric_history data...');

    // Check metric_history table for company 1757967976336
    const companyId = 1757967976336;
    const schemaName = `analytics_company_${companyId}`;

    const metricHistoryData = await client`
      SELECT * FROM ${client(schemaName)}.metric_history
      ORDER BY date DESC, metric_id
      LIMIT 10
    `;

    console.log(`📊 Found ${metricHistoryData.length} metric_history records:`);

    if (metricHistoryData.length > 0) {
      console.table(metricHistoryData.map(row => ({
        metric_id: row.metric_id,
        date: row.date,
        actual_value: row.actual_value,
        goal_value: row.goal_value,
        period: row.period,
        recorded_at: row.recorded_at
      })));
    } else {
      console.log('❌ No metric_history records found');
    }

    // Also check what metrics exist
    const metrics = await client`
      SELECT id, name, yearly_goal FROM ${client(schemaName)}.metrics
      WHERE is_active = true
      ORDER BY id
    `;

    console.log(`📋 Active metrics in schema:`);
    console.table(metrics);

  } catch (error) {
    console.error('❌ Error checking metric_history:', error);
  } finally {
    await client.end();
  }
}

// Run if called directly
checkMetricHistory().catch(console.error);