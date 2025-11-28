// pages/api/cart-validate.js
// POST /api/cart-validate
// Body: { items: [{ sku: "hat-001:Corduroy:Navy", qty: 2 }, ...] }
import { Client } from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const url = process.env.SUPABASE_DB_URL;
  if (!url) return res.status(500).json({ error: 'Missing SUPABASE_DB_URL' });

  let items = [];
  try {
    items = (req.body && req.body.items) || [];
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(422).json({ error: 'Body must include items: [{sku, qty}]' });
  }
  // sanitize
  items = items
    .filter(i => i && typeof i.sku === 'string' && Number.isFinite(Number(i.qty)))
    .map(i => ({ sku: i.sku.trim(), qty: Number(i.qty) }))
    .filter(i => i.sku && i.qty > 0);

  if (items.length === 0) {
    return res.status(422).json({ error: 'No valid cart lines found' });
  }

  const skus = [...new Set(items.map(i => i.sku))];

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    const { rows } = await client.query(
      'select sku_key, quantity from inventory where sku_key = any($1)',
      [skus]
    );

    const qtyMap = new Map(rows.map(r => [r.sku_key, Number(r.quantity)]));
    const problems = [];

    for (const line of items) {
      const available = qtyMap.has(line.sku) ? qtyMap.get(line.sku) : 0;
      if (available < line.qty) {
        problems.push({
          sku: line.sku,
          requested: line.qty,
          available,
        });
      }
    }

    return res.status(200).json({
      ok: problems.length === 0,
      problems,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    try { await client.end(); } catch {}
  }
}
