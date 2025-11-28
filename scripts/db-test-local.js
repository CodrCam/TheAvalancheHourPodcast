// scripts/db-test-local.js
const fs = require('fs');
const path = require('path');
const envPath = path.join(process.cwd(), '.env.local');

// 1) Load .env.local explicitly (fallback to .env if .env.local missing)
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
  console.log('• Loaded .env.local');
} else {
  require('dotenv').config(); // tries .env
  console.log('• .env.local not found, tried .env');
}

const { Client } = require('pg');

(async function main() {
  try {
    const url = process.env.SUPABASE_DB_URL;
    if (!url) {
      console.error('❌ Missing SUPABASE_DB_URL. Add it to .env.local');
      process.exit(1);
    }
    console.log('• Found SUPABASE_DB_URL (hidden)');

    // Optional: sanity check for SERVICE_ROLE presence (not needed for this test)
    if (process.env.SUPABASE_SERVICE_ROLE) {
      console.log('• Found SUPABASE_SERVICE_ROLE (hidden)');
    }

    console.log('• Connecting to Postgres...');
    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });

    await client.connect();
    console.log('• Connected. Running test query...');
    const { rows } = await client.query('select now() as now');
    console.log('✅ DB OK:', rows[0].now);
    await client.end();
  } catch (err) {
    console.error('❌ DB ERROR:', err.message);
    process.exit(1);
  }
})();
