// scripts/seedInventory.js
require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

const INVENTORY_ROWS = [
  // ReCaps – Foam Trucker
  { sku: 'recap-trucker-gold-dirt', quantity: 15 },

  // ReCaps – Corduroy
  { sku: 'recap-cord-blue-grey', quantity: 4 },
  { sku: 'recap-cord-sage-purp', quantity: 3 },
  { sku: 'recap-cord-yellow', quantity: 4 },
  { sku: 'recap-cord-teal', quantity: 4 },

  // ReCaps – Pom
  { sku: 'recap-pom-blue', quantity: 2 },
  { sku: 'recap-pom-green', quantity: 3 },
  { sku: 'recap-pom-brown', quantity: 2 },

  // ReCaps – Beanie (cuff)
  { sku: 'recap-cuff-black', quantity: 2 },
  { sku: 'recap-cuff-blue', quantity: 3 },
  { sku: 'recap-cuff-purp', quantity: 2 },

  // Voile straps
  { sku: 'strap-20-black', quantity: 100 },
  { sku: 'strap-25-blue', quantity: 100 },

  // Hoodies – Blue Storm
  { sku: 'hoodie-blue-storm-s', quantity: 5 },
  { sku: 'hoodie-blue-storm-m', quantity: 10 },
  { sku: 'hoodie-blue-storm-l', quantity: 10 },
  { sku: 'hoodie-blue-storm-xl', quantity: 2 },

  // Hoodies – Dark Grey Heather
  { sku: 'hoodie-dark-grey-heather-s', quantity: 5 },
  { sku: 'hoodie-dark-grey-heather-m', quantity: 10 },
  { sku: 'hoodie-dark-grey-heather-l', quantity: 10 },
  { sku: 'hoodie-dark-grey-heather-xl', quantity: 8 },

  // Tote
  { sku: 'free-range-tote', quantity: 100 },
];

async function main() {
  const cs = process.env.SUPABASE_DB_URL;
  if (!cs) {
    console.error('❌ SUPABASE_DB_URL is not set in .env.local');
    process.exit(1);
  }

  const client = new Client({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log('✅ Connected to database');

    for (const row of INVENTORY_ROWS) {
      console.log(`➡️  Upserting ${row.sku} = ${row.quantity}`);
      await client.query(
        `
        insert into inventory (sku_key, quantity, updated_at)
        values ($1, $2, now())
        on conflict (sku_key)
        do update set
          quantity = $2,
          updated_at = now()
        `,
        [row.sku, row.quantity]
      );
    }

    console.log('🎉 Inventory seed complete');
  } catch (err) {
    console.error('❌ Seed error:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();