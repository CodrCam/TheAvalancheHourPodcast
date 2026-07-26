// pages/api/webhook.js

import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { escapeHtml } from '../../lib/escapeHtml';
import { finalizePaidOrderInventory } from '../../lib/orderInventoryStore';
import { upsertOrder } from '../../lib/orderStore';
import { products } from '../../src/data/products';

// Stripe needs the raw body, not JSON-parsed
export const config = {
  api: { bodyParser: false },
};

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

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
 * Finalize inventory for a paid order. The order marker and every stock
 * decrement are committed in one DynamoDB transaction.
 */
async function finalizeInventoryForItems(orderId, items) {
  if (!Array.isArray(items) || !items.length) {
    throw new Error('Paid store order has no inventory items');
  }

  const skuDeltas = new Map();

  for (const it of items) {
    if (!it || typeof it !== 'object') continue;

    const qtyRaw = it.qty ?? it.quantity ?? 1;
    const qty = Number(qtyRaw);
    if (!Number.isFinite(qty) || qty <= 0) continue;

    const sku = resolveSkuForItem(it);
    if (!sku) {
      throw new Error('Could not resolve an inventory SKU for a paid item');
    }

    const prev = skuDeltas.get(sku) || 0;
    // Orders should decrement stock, so negative delta.
    skuDeltas.set(sku, prev - qty);
  }

  if (!skuDeltas.size) {
    throw new Error('Paid store order has no valid inventory quantities');
  }

  const result = await finalizePaidOrderInventory(
    orderId,
    [...skuDeltas.entries()].map(([sku, delta]) => ({ sku, delta }))
  );
  console.log(
    result.applied
      ? 'Inventory transaction completed for SKUs'
      : result.alreadyApplied
        ? 'Inventory transaction was already completed for SKUs'
        : 'Inventory transaction requires stock review for SKUs',
    result.changes.map((change) => change.sku)
  );
  return result;
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
  inventoryRequiresAttention = false,
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
            const name = escapeHtml(it.name || it.title || it.id || `Item ${index + 1}`);
            const qty = escapeHtml(it.qty ?? it.quantity ?? 1);
            const options = it.options || {};
            const parts = [
              options.style || options.variant || null,
              options.size || null,
              options.color || null,
            ].filter(Boolean).map(escapeHtml);
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
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join('');

  const safeOrderId = escapeHtml(orderId);
  const safeCustomerName = escapeHtml(customerName);
  const safeCustomerEmail = escapeHtml(customerEmail);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto;">
      <h2>New store order received</h2>
      ${
        inventoryRequiresAttention
          ? '<p style="padding: 12px; background: #fff3cd; color: #7a4b00;"><strong>Stock review required:</strong> payment succeeded, but the complete inventory decrement could not be applied. Review this order before fulfillment.</p>'
          : ''
      }
      
      <p><strong>Order ID:</strong> ${safeOrderId}</p>
      <p><strong>Total amount:</strong> ${formatMoney(amountCents)}</p>
      
      <h3>Customer</h3>
      <p>
        ${customerName ? `<div><strong>Name:</strong> ${safeCustomerName}</div>` : ''}
        ${
          customerEmail
            ? `<div><strong>Email:</strong> <a href="mailto:${safeCustomerEmail}">${safeCustomerEmail}</a></div>`
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
    subject: `${
      inventoryRequiresAttention ? 'Stock review required — ' : ''
    }New store order: ${orderId}`,
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
    return res.status(400).send('Webhook signature verification failed');
  }

  console.log('WEBHOOK EVENT TYPE:', event.type);

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;

    console.log('payment_intent.succeeded for PI', pi.id);

    // This Stripe account can also receive support/payment-link payments.
    // Only PaymentIntents created by the merchandise checkout belong here.
    if (!pi.metadata?.order_id || !pi.metadata?.items) {
      console.log('Ignoring non-store PaymentIntent', pi.id);
      return res.status(200).json({ received: true, ignored: true });
    }

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

    try {
      // 1) Upsert the order. Webhook metadata can be compact, so preserve
      // fuller cart line details if /api/store/record-order already saved them.
      const { isNewOrder } = await upsertOrder(
        {
          order_id: orderId,
          stripe_payment_intent_id: pi.id,
          status: 'paid',
          fulfillment_status: 'new',
          amount_cents: amountCents,
          items: items || [],
          customer_email: customerEmail,
          customer_name: customerName,
          shipping_name: shippingName,
          shipping_address1: shippingAddress1,
          shipping_address2: shippingAddress2,
          shipping_city: shippingCity,
          shipping_state: shippingState,
          shipping_postal_code: shippingPostalCode,
          shipping_country: shippingCountry,
        },
        { preserveExistingItems: true }
      );

      console.log('Order upserted into orders table:', orderId);

      // 2) Mark the paid order and decrement every SKU in one transaction.
      // Duplicate webhooks become no-ops; insufficient stock is flagged for
      // operations without allowing the quantity to go negative.
      const inventoryResult = await finalizeInventoryForItems(orderId, items);

      // 3) Fire off internal notification email only when this webhook created
      // the order. If the browser fallback recorded it first, that endpoint
      // already sent the notification. A newly detected stock problem always
      // receives its own alert.
      if (isNewOrder || inventoryResult.newlyFlagged) {
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
            inventoryRequiresAttention:
              inventoryResult.requiresAttention,
          });
        } catch (err) {
          console.error('Order notification email failed:', err);
        }
      }
    } catch (err) {
      console.error('WEBHOOK DB INSERT / INVENTORY ERROR:', err);
      return res
        .status(500)
        .json({ received: false, error: 'Order processing failed; retry required' });
    }
  }

  // All other event types: just acknowledge
  return res.status(200).json({ received: true });
}
