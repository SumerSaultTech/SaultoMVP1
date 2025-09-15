/**
 * Script to populate metric_history for a company
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from 'dotenv';

// Load environment variables
config();

async function populateMetricHistory(companyId) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const client = postgres(databaseUrl);

  try {
    console.log(`🔄 Populating metric_history for company ${companyId}...`);

    // Run the new ETL function for this company
    const result = await client`
      SELECT populate_company_metrics_time_series(
        ${companyId}::bigint,
        'daily'::text,
        CURRENT_DATE::date,
        CURRENT_DATE::date
      ) as result
    `;

    console.log('✅ ETL result:', result[0]?.result);

    // Check what was populated
    const schemaName = `analytics_company_${companyId}`;
    const metricHistoryData = await client`
      SELECT * FROM ${client(schemaName)}.metric_history
      ORDER BY date DESC, metric_id
    `;

    console.log(`📊 Found ${metricHistoryData.length} metric_history records:`);
    metricHistoryData.forEach(row => {
      console.log(`   - Metric ${row.metric_id}: ${row.date} | actual=${row.actual_value} goal=${row.goal_value} period=${row.period}`);
    });

  } catch (error) {
    console.error('❌ Error populating metric_history:', error);
  } finally {
    await client.end();
  }
}

// Run if called directly
const companyId = process.argv[2] || '1757970334411';
populateMetricHistory(companyId).catch(console.error);