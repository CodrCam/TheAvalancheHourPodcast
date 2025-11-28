// pages/api/store/admin/stock.js

import { Client } from 'pg';

export const config = {
  api: { bodyParser: true },
};

function getPg() {
  const cs = process.env.SUPABASE_DB_URL;
  if (!cs) return null;
  return new Client({
    connectionString: cs,
    ssl: { rejectUnauthorized: false },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const pg = getPg();
  if (!pg) {
    return res
      .status(500)
      .json({ error: 'SUPABASE_DB_URL is not configured on the server' });
  }

  try {
    await pg.connect();

    const { rows } = await pg.query(
      'select sku_key as sku, quantity from inventory order by sku_key asc'
    );

    // This is what the admin UI will read
    return res.status(200).json({
      inventory: rows, // [{ sku, quantity }, ...]
    });
  } catch (err) {
    console.error('admin stock GET error:', err);
    return res.status(500).json({ error: 'Failed to load inventory' });
  } finally {
    try {
      await pg.end();
    } catch {
      // ignore
    }
  }
}