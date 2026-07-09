// Pulls historical Supabase/Postgres orders into seed files for DynamoDB.
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const OUTPUT_JSON = path.join(
  process.cwd(),
  'data',
  'dynamodb-orders-seed.json'
);
const OUTPUT_CSV = path.join(
  process.cwd(),
  'data',
  'dynamodb-orders-seed.csv'
);

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function parseItems(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function isoDate(value) {
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function normalizeOrder(row) {
  const createdAt = isoDate(row.created_at);
  return {
    order_id: String(row.order_id || '').trim(),
    stripe_payment_intent_id: String(row.stripe_payment_intent_id || '').trim(),
    status: String(row.status || 'paid').trim().toLowerCase(),
    fulfillment_status: String(row.fulfillment_status || 'new').trim().toLowerCase(),
    amount_cents: Math.max(0, Math.trunc(Number(row.amount_cents) || 0)),
    items: parseItems(row.items),
    customer_email: String(row.customer_email || '').trim(),
    customer_name: String(row.customer_name || '').trim(),
    shipping_name: String(row.shipping_name || '').trim(),
    shipping_address1: String(row.shipping_address1 || '').trim(),
    shipping_address2: String(row.shipping_address2 || '').trim(),
    shipping_city: String(row.shipping_city || '').trim(),
    shipping_state: String(row.shipping_state || '').trim(),
    shipping_postal_code: String(row.shipping_postal_code || '').trim(),
    shipping_country: String(row.shipping_country || '').trim(),
    created_at: createdAt,
    updated_at: isoDate(row.updated_at || row.created_at || createdAt),
    inventory_decremented: true,
    inventory_decrement_status: 'migrated',
  };
}

function writeCsv(rows) {
  const header = [
    'order_id',
    'stripe_payment_intent_id',
    'status',
    'fulfillment_status',
    'amount_cents',
    'customer_email',
    'customer_name',
    'shipping_name',
    'shipping_address1',
    'shipping_address2',
    'shipping_city',
    'shipping_state',
    'shipping_postal_code',
    'shipping_country',
    'created_at',
  ];

  const lines = [
    header.join(','),
    ...rows.map((row) => header.map((field) => csvEscape(row[field])).join(',')),
  ];
  fs.writeFileSync(OUTPUT_CSV, `${lines.join('\n')}\n`, 'utf8');
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    console.error('Missing SUPABASE_DB_URL in .env.local');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const { rows } = await client.query(`
      select
        order_id,
        stripe_payment_intent_id,
        status,
        fulfillment_status,
        amount_cents,
        items,
        customer_email,
        customer_name,
        shipping_name,
        shipping_address1,
        shipping_address2,
        shipping_city,
        shipping_state,
        shipping_postal_code,
        shipping_country,
        created_at
      from orders
      where order_id not like 'debug-%'
      order by created_at asc
    `);

    const seedRows = rows.map(normalizeOrder).filter((row) => row.order_id);

    fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
    fs.writeFileSync(
      OUTPUT_JSON,
      `${JSON.stringify(seedRows, null, 2)}\n`,
      'utf8'
    );
    writeCsv(seedRows);

    const totalCents = seedRows.reduce(
      (sum, row) => sum + Number(row.amount_cents || 0),
      0
    );
    console.log(`Exported ${seedRows.length} order rows.`);
    console.log(`Total historical amount: $${(totalCents / 100).toFixed(2)}`);
    console.log(`JSON: ${OUTPUT_JSON}`);
    console.log(`CSV:  ${OUTPUT_CSV}`);
  } catch (err) {
    console.error('Order export failed:', err.message);
    process.exitCode = 1;
  } finally {
    try {
      await client.end();
    } catch {
      // ignore
    }
  }
}

main();
