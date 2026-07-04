// Pulls the current Supabase/Postgres inventory into seed files for DynamoDB.
require('dotenv').config({ path: '.env.local' });

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const OUTPUT_JSON = path.join(
  process.cwd(),
  'data',
  'dynamodb-inventory-seed.json'
);
const OUTPUT_CSV = path.join(
  process.cwd(),
  'data',
  'dynamodb-inventory-seed.csv'
);

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function writeCsv(rows) {
  const header = ['sku', 'quantity', 'updated_at'];
  const lines = [
    header.join(','),
    ...rows.map((row) =>
      [
        csvEscape(row.sku),
        csvEscape(row.quantity),
        csvEscape(row.updated_at || ''),
      ].join(',')
    ),
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
    const { rows } = await client.query(
      `
      select
        sku_key as sku,
        quantity,
        updated_at
      from inventory
      order by sku_key asc
      `
    );

    const seedRows = rows.map((row) => ({
      sku: String(row.sku),
      quantity: Math.max(0, Number(row.quantity) || 0),
      updated_at: row.updated_at
        ? new Date(row.updated_at).toISOString()
        : new Date().toISOString(),
    }));

    fs.mkdirSync(path.dirname(OUTPUT_JSON), { recursive: true });
    fs.writeFileSync(
      OUTPUT_JSON,
      `${JSON.stringify(seedRows, null, 2)}\n`,
      'utf8'
    );
    writeCsv(seedRows);

    const totalQuantity = seedRows.reduce(
      (sum, row) => sum + Number(row.quantity || 0),
      0
    );
    console.log(`Exported ${seedRows.length} inventory rows.`);
    console.log(`Total quantity: ${totalQuantity}`);
    console.log(`JSON: ${OUTPUT_JSON}`);
    console.log(`CSV:  ${OUTPUT_CSV}`);
  } catch (err) {
    console.error('Inventory export failed:', err.message);
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
