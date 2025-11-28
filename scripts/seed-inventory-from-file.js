// scripts/seed-inventory-from-file.js
// Reads src/data/stock.json => upserts into inventory
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

(async () => {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) { console.error('Missing SUPABASE_DB_URL'); process.exit(1); }

  // Choose the stock.json you want to import:
  const filePath = path.join(process.cwd(), 'src', 'data', 'stock.json');
  if (!fs.existsSync(filePath)) { console.error('stock.json not found:', filePath); process.exit(1); }

  const json = JSON.parse(fs.readFileSync(filePath, 'utf8')); // { "skuKey": number, ... }
  const entries = Object.entries(json);

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    for (const [sku, qty] of entries) {
      await client.query(
        `insert into inventory(sku_key, quantity)
         values ($1, $2)
         on conflict (sku_key) do update set quantity=$2, updated_at=now()`,
        [sku, Number(qty)]
      );
    }
    console.log(`Seeded ${entries.length} inventory rows.`);
  } catch (e) {
    console.error('Seed error:', e.message);
  } finally {
    await client.end();
  }
})();
