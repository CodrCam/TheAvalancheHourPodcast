// scripts/clearInventory.js

require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;

  if (!connectionString) {
    console.error('❌ SUPABASE_DB_URL is not set in .env.local');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    // Nuke all rows
    await client.query('TRUNCATE TABLE inventory;');

    console.log('🧹 inventory table cleared');
  } catch (err) {
    console.error('❌ Error clearing inventory:', err);
  } finally {
    await client.end();
  }
}

main();