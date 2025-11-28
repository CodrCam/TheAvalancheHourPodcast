// pages/api/store/record-order.js
import { Client } from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
  if (!SUPABASE_DB_URL) {
    return res.status(500).json({ error: 'SUPABASE_DB_URL not configured' });
  }

  const {
    orderId,
    paymentIntentId,
    amountCents,
    items,
    // status, // we ignore this now
    email,
    shipping,
  } = req.body || {};

  if (!orderId || !paymentIntentId) {
    return res
      .status(400)
      .json({ error: 'orderId and paymentIntentId are required' });
  }

  const safeShipping =
    shipping && typeof shipping === 'object'
      ? shipping
      : {};

  const shippingName = safeShipping.name || null;
  const shippingAddress1 = safeShipping.line1 || null;
  const shippingAddress2 = safeShipping.line2 || null;
  const shippingCity = safeShipping.city || null;
  const shippingState = safeShipping.state || null;
  const shippingPostalCode = safeShipping.postal_code || null;
  const shippingCountry = safeShipping.country || null;

  const customerEmail = typeof email === 'string' && email ? email : null;
  const customerName = shippingName || null;

  const pg = new Client({
    connectionString: SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pg.connect();

    const fulfillmentStatus = 'New';

    await pg.query(
      `
      insert into orders (
        order_id,
        stripe_payment_intent_id,
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
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, now())
      on conflict (order_id) do update set
        stripe_payment_intent_id = excluded.stripe_payment_intent_id,
        fulfillment_status = excluded.fulfillment_status,
        amount_cents = excluded.amount_cents,
        items = excluded.items,
        customer_email = excluded.customer_email,
        customer_name = excluded.customer_name,
        shipping_name = excluded.shipping_name,
        shipping_address1 = excluded.shipping_address1,
        shipping_address2 = excluded.shipping_address2,
        shipping_city = excluded.shipping_city,
        shipping_state = excluded.shipping_state,
        shipping_postal_code = excluded.shipping_postal_code,
        shipping_country = excluded.shipping_country
      `,
      [
        orderId,
        paymentIntentId,
        fulfillmentStatus,
        typeof amountCents === 'number' ? amountCents : 0,
        JSON.stringify(Array.isArray(items) ? items : []),
        customerEmail,
        customerName,
        shippingName,
        shippingAddress1,
        shippingAddress2,
        shippingCity,
        shippingState,
        shippingPostalCode,
        shippingCountry,
      ]
    );

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('record-order error:', err);
    return res.status(500).json({ error: 'Failed to record order' });
  } finally {
    try {
      await pg.end();
    } catch {}
  }
}