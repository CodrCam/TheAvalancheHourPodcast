// pages/api/webhook.js

import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { Client } from 'pg';
import { products } from '../../src/data/products';

// Stripe needs the raw body, not JSON-parsed
export const config = {
  api: { bodyParser: false },
};

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;

// Email configuration (same as /api/contact)
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const TO_EMAIL = process.env.CONTACT_EMAIL || 'theavalanchehourpodcast@gmail.com';

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

/**
 * Given a cart/order item from metadata, try to derive a SKU string.
 * We prefer an explicit item.sku, and fall back to products.js based
 * on id + options (style/size/color).
 */
function resolveSkuForItem(item) {
  if (!item || typeof item !== 'object') return null;

  // 1) If the item already has a sku field, use it.
  if (item.sku && typeof item.sku === 'string') {
    const s = item.sku.trim();
    if (s) return s;
  }

  const id = item.id || item.productId || item.slug;
  if (!id) return null;

  const product = products.find(
    (p) => p.id === id || p.slug === id
  );
  if (!product) return null;

  const options = item.options || {};
  const style = options.style || options.variant || null;
  const size = options.size || null;
  const color = options.color || null;

  // If no style, some products might be single-style and just have skuByColor;
  // but your current catalog uses style for caps/hoodies/straps, so we mostly
  // expect style to be present.
  if (product.variants && style && product.variants[style]) {
    const variant = product.variants[style];

    // Hoodies: skuBySize
    if (variant.skuBySize && size) {
      const sku = variant.skuBySize[size];
      if (sku) return sku;
    }

    // Caps / straps: skuByColor
    if (variant.skuByColor && color) {
      const sku = variant.skuByColor[color];
      if (sku) return sku;
    }
  }

  // If we get here, we couldn't resolve a SKU (e.g. tote with no SKU mapping).
  return null;
}

/**
 * Decrement inventory quantities for all SKUs in this order.
 * We aggregate quantities per SKU and then apply a "delta" update:
 *   quantity = greatest(0, quantity + delta)
 * where delta is negative for an order.
 */
async function decrementInventoryForItems(pg, items) {
  if (!Array.isArray(items) || !items.length) return;

  const skuDeltas = new Map();

  for (const it of items) {
    if (!it || typeof it !== 'object') continue;

    const qtyRaw = it.qty ?? it.quantity ?? 1;
    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const sku = resolveSkuForItem(it);
    if (!sku) {
      console.warn('Could not resolve SKU for item', it);
      continue;
    }

    const prev = skuDeltas.get(sku) || 0;
    // Orders should decrement stock, so negative delta.
    skuDeltas.set(sku, prev - qty);
  }

  if (!skuDeltas.size) return;

  for (const [sku, delta] of skuDeltas.entries()) {
    if (!Number.isFinite(delta) || delta === 0) continue;

    try {
      // This matches the "delta" logic from /api/store/admin/update-stock:
      // - insert with quantity = greatest(0, delta) for new row
      // - on conflict, quantity = greatest(0, inventory.quantity + delta)
      await pg.query(
        `
        insert into inventory (sku_key, quantity, updated_at)
        values ($1, greatest(0, $2), now())
        on conflict (sku_key)
        do update set quantity = greatest(0, inventory.quantity + $2),
                     updated_at = now()
        `,
        [sku, delta]
      );

      console.log('Inventory updated for SKU', sku, 'delta', delta);
    } catch (err) {
      console.error('Inventory update failed for SKU', sku, err);
      // We swallow per-SKU errors so one bad row doesn't tank the whole webhook.
    }
  }
}

function formatMoney(cents) {
  if (!Number.isFinite(cents)) return 'N/A';
  try {
    return (cents / 100).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  } catch {
    return `${cents / 100} USD`;
  }
}

async function sendOrderNotificationEmail({
  orderId,
  amountCents,
  items,
  customerEmail,
  customerName,
  shippingName,
  shippingAddress1,
  shippingAddress2,
  shippingCity,
  shippingState,
  shippingPostalCode,
  shippingCountry,
}) {
  if (!EMAIL_USER || !EMAIL_PASS || !TO_EMAIL) {
    console.warn(
      'Email environment variables not fully configured, skipping order notification email'
    );
    return;
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
  });

  const safeItems = Array.isArray(items) ? items : [];
  const itemsHtml =
    safeItems.length > 0
      ? safeItems
          .map((it, index) => {
            const name = it.name || it.title || it.id || `Item ${index + 1}`;
            const qty = it.qty ?? it.quantity ?? 1;
            const options = it.options || {};
            const parts = [
              options.style || options.variant || null,
              options.size || null,
              options.color || null,
            ].filter(Boolean);
            const details = parts.length ? ` (${parts.join(' / ')})` : '';
            return `<li>${name}${details} x ${qty}</li>`;
          })
          .join('\n')
      : '<li>No items found in metadata</li>';

  const addressLines = [
    shippingName,
    shippingAddress1,
    shippingAddress2,
    [shippingCity, shippingState, shippingPostalCode].filter(Boolean).join(', '),
    shippingCountry,
  ]
    .filter((line) => !!line)
    .map((line) => `<div>${line}</div>`)
    .join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <h2>New store order received</h2>
      
      <p><strong>Order ID:</strong> ${orderId}</p>
      <p><strong>Total amount:</strong> ${formatMoney(amountCents)}</p>
      
      <h3>Customer</h3>
      <p>
        ${customerName ? `<div><strong>Name:</strong> ${customerName}</div>` : ''}
        ${
          customerEmail
            ? `<div><strong>Email:</strong> <a href="mailto:${customerEmail}">${customerEmail}</a></div>`
            : ''
        }
      </p>

      <h3>Shipping address</h3>
      <p>
        ${addressLines || 'No shipping address recorded'}
      </p>

      <h3>Items</h3>
      <ul>
        ${itemsHtml}
      </ul>

      <p style="margin-top: 20px; font-size: 12px; color: #555;">
        This message was generated automatically by the store webhook when the Stripe payment succeeded.
      </p>
    </div>
  `;

  const mailOptions = {
    from: EMAIL_USER,
    to: TO_EMAIL,
    subject: `New store order: ${orderId}`,
    html,
  };

  await transporter.sendMail(mailOptions);
  console.log('Order notification email sent for order', orderId);
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

  console.log('WEBHOOK EVENT TYPE:', event.type);

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;

    console.log('payment_intent.succeeded for PI', pi.id);

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

      // 1) Upsert the order
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
          'paid', // payment status
          'New', // fulfillment status for admin UI
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

      console.log('Order upserted into orders table:', orderId);

      // 2) Decrement inventory for each SKU in the order
      await decrementInventoryForItems(pg, items);
    } catch (err) {
      console.error('WEBHOOK DB INSERT / INVENTORY ERROR:', err);
      try {
        await pg.end();
      } catch (e) {
        // ignore
      }
      // Do not keep returning 500 to Stripe; just log and acknowledge
      return res
        .status(200)
        .json({ received: true, note: 'db insert or inventory update failed' });
    }

    try {
      await pg.end();
    } catch (e) {
      // ignore
    }

    // 3) Fire off internal notification email (non-blocking from Stripe's POV if it fails)
    try {
      await sendOrderNotificationEmail({
        orderId,
        amountCents,
        items,
        customerEmail,
        customerName,
        shippingName,
        shippingAddress1,
        shippingAddress2,
        shippingCity,
        shippingState,
        shippingPostalCode,
        shippingCountry,
      });
    } catch (err) {
      console.error('Order notification email failed:', err);
    }
  }

  // All other event types: just acknowledge
  return res.status(200).json({ received: true });
}