// lib/cartValidation.js
import { Client } from 'pg';
import { skuKey } from './stock';

/**
 * Takes an array of "cart items" and verifies them against the inventory table.
 *
 * Accepted item shapes:
 *  - { sku, qty }
 *  - { id, qty, options }
 *
 * Returns: { ok: boolean, problems: [{ sku, requested, available }] }
 */
export async function validateItemsWithInventory(rawItems = []) {
  const items = Array.isArray(rawItems) ? rawItems : [];

  // Build a map of sku -> total requested quantity
  const skuQuantities = new Map();

  for (const item of items) {
    if (!item) continue;

    const qty = parseInt(item.qty, 10) || 0;
    if (qty <= 0) continue;

    // Support both { sku, qty } and { id, qty, options }
    let sku = item.sku;
    if (!sku && item.id) {
      sku = skuKey(item.id, item.options || {});
    }
    if (!sku) continue;

    const key = String(sku);
    skuQuantities.set(key, (skuQuantities.get(key) || 0) + qty);
  }

  if (!skuQuantities.size) {
    return { ok: true, problems: [] };
  }

  const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
  if (!SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL not set');
  }

  const pg = new Client({
    connectionString: SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  const availableMap = new Map();

  try {
    await pg.connect();
    const skus = Array.from(skuQuantities.keys());
    const { rows } = await pg.query(
      'select sku_key as sku, quantity from inventory where sku_key = any($1::text[])',
      [skus]
    );

    for (const r of rows) {
      const key = String(r.sku);
      const qty = parseInt(r.quantity, 10) || 0;
      availableMap.set(key, qty);
    }
  } finally {
    try {
      await pg.end();
    } catch {
      // ignore
    }
  }

  const problems = [];
  for (const [sku, want] of skuQuantities) {
    const have = parseInt(availableMap.get(sku) ?? 0, 10);
    if (want > have) {
      problems.push({ sku, requested: want, available: have });
    }
  }

  return { ok: problems.length === 0, problems };
}
