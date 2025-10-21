import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function checkAsanaConnection() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Neon requires SSL
    }
  });

  try {
    await client.connect();
    console.log('🔗 Connected to Neon database');

    // Check for any remaining Asana connections
    const queryResult = await client.query(
      "SELECT * FROM data_sources WHERE type = 'asana'"
    );
    
    console.log(`📋 Found ${queryResult.rows.length} Asana connections:`);
    if (queryResult.rows.length > 0) {
      queryResult.rows.forEach(row => {
        console.log(`  - ID: ${row.id}, Company: ${row.company_id}, Name: ${row.name}`);
      });
    } else {
      console.log('✅ No Asana connections found - deletion was successful!');
    }

  } catch (error) {
    console.error('❌ Error connecting to Neon:', error.message);
  } finally {
    await client.end();
    console.log('🔌 Neon database connection closed');
  }
}

checkAsanaConnection();