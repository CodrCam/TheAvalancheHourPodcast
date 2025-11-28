// pages/api/webhook.js

import Stripe from 'stripe';
import { Client } from 'pg';

// Stripe needs the raw body, not JSON-parsed
export const config = {
  api: { bodyParser: false },
};

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;

const stripe = STRIPE_SECRET_KEY
  ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' })
  : null;

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  if (!stripe || !STRIPE_WEBHOOK_SECRET) {
    console.error('Stripe not configured for webhook');
    return res.status(500).send('Stripe not configured');
  }

  let event;
  try {
    const rawBody = await readRawBody(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    // Return 200 so Stripe stops retrying, but mark as ignored
    return res.status(200).json({ received: true, note: 'bad signature' });
  }

  console.log('➡️  WEBHOOK EVENT TYPE:', event.type);

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;

    console.log('✅ payment_intent.succeeded for PI', pi.id);

    // Items list saved in metadata by create-payment-intent
    let items = [];
    if (pi.metadata?.items) {
      try {
        items = JSON.parse(pi.metadata.items);
      } catch (err) {
        console.error('Failed to parse pi.metadata.items', err);
      }
    }

    const orderId = pi.metadata?.order_id || pi.id;
    const amountCents =
      typeof pi.amount_received === 'number'
        ? pi.amount_received
        : typeof pi.amount === 'number'
        ? pi.amount
        : 0;

    // Customer + shipping info from PaymentIntent / charges
    const customerEmail =
      pi.receipt_email ||
      (pi.charges?.data?.[0]?.billing_details?.email ?? null);

    const customerName =
      pi.charges?.data?.[0]?.billing_details?.name || null;

    const shipping = pi.shipping || null;
    const shippingName = shipping?.name || null;
    const addr = shipping?.address || {};
    const shippingAddress1 = addr?.line1 || null;
    const shippingAddress2 = addr?.line2 || null;
    const shippingCity = addr?.city || null;
    const shippingState = addr?.state || null;
    const shippingPostalCode = addr?.postal_code || null;
    const shippingCountry = addr?.country || null;

    const pg = new Client({
      connectionString: SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await pg.connect();

      await pg.query(
        `
        insert into orders (
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
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
        on conflict (order_id) do update set
          stripe_payment_intent_id = excluded.stripe_payment_intent_id,
          status = excluded.status,
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
          pi.id,
          'paid',         // payment status
          'New',          // fulfillment status for admin UI
          amountCents,
          JSON.stringify(items || []),
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

      console.log('📦 Order upserted into orders table:', orderId);
    } catch (err) {
      console.error('WEBHOOK DB INSERT ERROR:', err);
      try {
        await pg.end();
      } catch {}
      // Don’t keep 500’ing; just log and acknowledge
      return res
        .status(200)
        .json({ received: true, note: 'db insert failed' });
    }

    try {
      await pg.end();
    } catch {}
  }

  // All other event types: just acknowledge
  return res.status(200).json({ received: true });
}