// pages/api/stock.js
import { Client } from 'pg';

export default async function handler(req, res) {
  // Only GET is allowed for this public route
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Ensure env is present
  const url = process.env.SUPABASE_DB_URL;
  if (!url) return res.status(500).json({ error: 'Missing SUPABASE_DB_URL' });

  // Parse optional ?sku=a,b,c
  const list = (req.query.sku || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const client = new Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    let rows;
    if (list.length) {
      const q = `select sku_key, quantity, updated_at from inventory where sku_key = any($1)`;
      const { rows: r } = await client.query(q, [list]);
      rows = r;
    } else {
      const { rows: r } = await client.query(
        `select sku_key, quantity, updated_at from inventory order by sku_key asc`
      );
      rows = r;
    }

    return res.status(200).json({ ok: true, data: rows });
  } catch (err) {
    // If the table doesn't exist yet, tell us plainly.
    if (String(err.message).includes('relation "inventory" does not exist')) {
      return res.status(200).json({
        ok: false,
        needs_setup: true,
        error: 'inventory table not found',
      });
    }
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  } finally {
    try { await client.end(); } catch {}
  }
}
