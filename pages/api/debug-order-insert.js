// pages/api/debug-order-insert.js
import { Client } from 'pg';

export default async function handler(req, res) {
  const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
  if (!SUPABASE_DB_URL) {
    return res.status(500).json({ error: 'SUPABASE_DB_URL not set' });
  }

  const pg = new Client({
    connectionString: SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pg.connect();

    const result = await pg.query(
      `
      insert into orders (
        order_id,
        stripe_payment_intent_id,
        status,
        amount_cents,
        items,
        created_at
      )
      values ($1, $2, $3, $4, $5, now())
      returning *
      `,
      [
        'debug-order-1',
        'pi_debug_123',
        'paid',
        1234,
        JSON.stringify([{ sku: 'test-sku', qty: 1 }]),
      ]
    );

    await pg.end();
    return res.status(200).json({ inserted: result.rows[0] });
  } catch (err) {
    console.error('debug-order-insert error:', err);
    try { await pg.end(); } catch {}
    return res.status(500).json({ error: String(err) });
  }
}
