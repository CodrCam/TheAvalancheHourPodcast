// pages/api/store/admin/orders.js

import { Client } from 'pg';

const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;

async function getClient() {
  if (!SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL not configured');
  }

  const client = new Client({
    connectionString: SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  return client;
}

export default async function handler(req, res) {
  // Allow GET (list orders) and PATCH (update fulfillment_status)
  if (!['GET', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', ['GET', 'PATCH']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  if (req.method === 'PATCH') {
    return handlePatch(req, res);
  }
}

async function handleGet(_req, res) {
  let pg;
  try {
    pg = await getClient();

    const { rows } = await pg.query(`
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
      order by created_at desc
      limit 200
    `);

    return res.status(200).json({ orders: rows });
  } catch (err) {
    console.error('admin orders fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  } finally {
    if (pg) {
      try {
        await pg.end();
      } catch {}
    }
  }
}

async function handlePatch(req, res) {
  let pg;

  try {
    const { order_id, fulfillment_status } = req.body || {};

    if (!order_id || typeof order_id !== 'string') {
      return res.status(400).json({ error: 'order_id is required' });
    }

    const allowed = ['new', 'processing', 'shipped'];
    const statusNorm =
      typeof fulfillment_status === 'string'
        ? fulfillment_status.toLowerCase()
        : '';

    if (!allowed.includes(statusNorm)) {
      return res.status(400).json({
        error: `Invalid fulfillment_status. Expected one of: ${allowed.join(
          ', '
        )}`,
      });
    }

    pg = await getClient();

    const { rows, rowCount } = await pg.query(
      `
      update orders
      set fulfillment_status = $2
      where order_id = $1
      returning
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
      `,
      [order_id, statusNorm]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.status(200).json({ order: rows[0] });
  } catch (err) {
    console.error('admin orders patch error:', err);
    return res.status(500).json({ error: 'Failed to update fulfillment status' });
  } finally {
    if (pg) {
      try {
        await pg.end();
      } catch {}
    }
  }
}