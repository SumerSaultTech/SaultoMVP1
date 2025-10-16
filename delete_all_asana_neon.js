import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function deleteAllAsanaConnections() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false // Neon requires SSL
    }
  });

  try {
    await client.connect();
    console.log('🔗 Connected to Neon database');

    // Show all Asana connections before deletion
    const beforeResult = await client.query(
      "SELECT * FROM data_sources WHERE type = 'asana'"
    );
    
    console.log(`📋 Found ${beforeResult.rows.length} Asana connections before deletion:`);
    beforeResult.rows.forEach(row => {
      console.log(`  - ID: ${row.id}, Company: ${row.company_id}, Name: ${row.name}`);
    });

    if (beforeResult.rows.length > 0) {
      // Delete ALL Asana connections
      const deleteResult = await client.query(
        "DELETE FROM data_sources WHERE type = 'asana'"
      );
      
      console.log(`✅ Deleted ${deleteResult.rowCount} Asana connection(s)`);
      
      // Verify deletion
      const afterResult = await client.query(
        "SELECT * FROM data_sources WHERE type = 'asana'"
      );
      
      console.log(`📋 Remaining Asana connections: ${afterResult.rows.length}`);
    } else {
      console.log('ℹ️ No Asana connections found to delete');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
    console.log('🔌 Neon database connection closed');
  }
}

deleteAllAsanaConnections();