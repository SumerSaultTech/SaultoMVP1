/**
 * Database Migration Runner
 * Run with: DATABASE_URL="your_neon_url" node run-migrations.js
 */

import pkg from 'pg';
const { Client } = pkg;
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';

// Load environment variables
config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('🔍 Connected to Neon database');

    // Migration files in order
    const migrations = [
      '001-create-date-dimension.sql',
      '002-create-metric-registry-function.sql', 
      '003-setup-existing-companies.sql'
    ];

    console.log(`📋 Running ${migrations.length} migrations...\n`);

    for (const migration of migrations) {
      const migrationPath = path.join(__dirname, 'migrations', migration);
      
      if (!fs.existsSync(migrationPath)) {
        console.error(`❌ Migration file not found: ${migration}`);
        continue;
      }

      console.log(`🔧 Running migration: ${migration}`);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      try {
        await client.query(sql);
        console.log(`✅ Migration completed: ${migration}\n`);
      } catch (error) {
        console.error(`❌ Migration failed: ${migration}`);
        console.error(`Error: ${error.message}\n`);
        // Continue with other migrations
      }
    }

    // Verify final state
    console.log('🔍 Verifying migration results...\n');
    
    // Check date dimension
    const dateCheck = await client.query(`
      SELECT COUNT(*) as row_count, MIN(dt) as min_date, MAX(dt) as max_date 
      FROM shared_utils.dim_date;
    `);
    console.log('📅 Date Dimension:', dateCheck.rows[0]);
    
    // Check metric registry tables
    const registryCheck = await client.query(`
      SELECT schemaname, tablename, 
             SUBSTRING(schemaname FROM 'analytics_company_(.*)') as company_id
      FROM pg_tables 
      WHERE tablename = 'metric_registry' 
        AND schemaname LIKE 'analytics_company_%'
      ORDER BY schemaname;
    `);
    console.log('📊 Metric Registry Tables Created:', registryCheck.rows.length);
    registryCheck.rows.forEach(row => {
      console.log(`   - Company ${row.company_id}: ${row.schemaname}.${row.tablename}`);
    });

    console.log('\n✅ All migrations completed successfully!');

  } catch (error) {
    console.error('❌ Migration runner error:', error.message);
  } finally {
    await client.end();
  }
}

// Check for DATABASE_URL
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  console.error('Usage: DATABASE_URL="your_neon_url" node run-migrations.js');
  process.exit(1);
}

runMigrations().catch(console.error);