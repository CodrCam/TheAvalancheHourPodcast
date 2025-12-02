// pages/api/store/create-payment-intent.js
import Stripe from 'stripe';
import crypto from 'crypto';
import { products } from '../../../src/data/products';
import { skuKey } from '../../../lib/stock';
import { validateItemsWithInventory } from '../../../lib/cartValidation';
import { FLAT_SHIPPING_CENTS } from '../../../src/config/store';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' })
  : null;

// Simple discount codes: keys are UPPERCASE, matching  normalization
const DISCOUNT_CODES = {
  S10HOST40: { type: 'percent', value: 40 },  // 40% off
  TAHFRIENDS: { type: 'percent', value: 15 }, // 15% off
};

function normalizeItems(raw = []) {
  const clean = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const p = products.find(x => x.id === r.id);
    if (!p) continue; // ignore unknown products

    const qty = Math.max(0, Math.min(parseInt(r.qty ?? 0, 10) || 0, 100));
    if (!qty) continue;

    const options = r.options || {}; // { style, size, color }

    // Variant-level pricing (e.g. Voile 20" vs 25")
    let price = p.price || 0;
    if (
      options.style &&
      p.variants &&
      p.variants[options.style] &&
      typeof p.variants[options.style].price === 'number'
    ) {
      price = p.variants[options.style].price;
    }

    clean.push({
      id: p.id,
      name: p.name || p.id,
      price,   // cents
      qty,
      options,
    });
  }
  return clean;
}

function computeOrderAmount(items = []) {
  return items.reduce((sum, it) => sum + it.price * it.qty, 0);
}

function applyDiscount(amountCents, rawCode) {
  const normalized =
    typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';

  if (!normalized) {
    return {
      subtotalAfterDiscount: amountCents,
      discountAmountCents: 0,
      discountCode: null,
    };
  }

  const def = DISCOUNT_CODES[normalized];
  if (!def) {
    return {
      subtotalAfterDiscount: amountCents,
      discountAmountCents: 0,
      discountCode: null,
    };
  }

  let discountAmountCents = 0;
  if (def.type === 'percent') {
    discountAmountCents = Math.floor((amountCents * def.value) / 100);
  } else if (def.type === 'fixed') {
    discountAmountCents = def.value;
  }

  if (discountAmountCents <= 0) {
    return {
      subtotalAfterDiscount: amountCents,
      discountAmountCents: 0,
      discountCode: null,
    };
  }

  // Prevent discount from reducing total below some minimum (e.g. 50¢)
  const minCharge = 50;
  const newSubtotal = Math.max(amountCents - discountAmountCents, minCharge);

  if (newSubtotal === minCharge) {
    discountAmountCents = amountCents - minCharge;
  }

  return {
    subtotalAfterDiscount: newSubtotal,
    discountAmountCents,
    discountCode: normalized,
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  try {
    const body = req.body || {};
    const items = normalizeItems(body.items);

    // Normalize & validate email; require basic structure so receipts go somewhere real.
    const rawEmail = typeof body.email === 'string' ? body.email.trim() : '';
    const email =
      rawEmail && rawEmail.includes('@') ? rawEmail : null;

    const shipping =
      body.shipping && typeof body.shipping === 'object'
        ? body.shipping
        : null;
    const discountCode =
      typeof body.discountCode === 'string' ? body.discountCode : null;

    if (!items.length) {
      return res.status(400).json({ error: 'No valid items in order' });
    }

    if (!shipping || !shipping.name) {
      return res
        .status(400)
        .json({ error: 'Shipping information is required' });
    }

    // Inventory validation
    try {
      const { ok, problems } = await validateItemsWithInventory(items);
      if (!ok) {
        const details = problems.map((p) => ({
          key: p.sku,
          available: p.available,
          requested: p.requested,
        }));
        return res
          .status(409)
          .json({ error: 'Insufficient stock', details });
      }
    } catch (err) {
      console.error('create-payment-intent inventory error', err);
      return res.status(500).json({ error: 'Inventory lookup failed' });
    }

    // Subtotal (pre-discount, pre-shipping, no tax)
    const subtotalCents = computeOrderAmount(items);
    if (subtotalCents <= 0) {
      return res.status(400).json({ error: 'Invalid order amount' });
    }

    // Discount
    const {
      subtotalAfterDiscount,
      discountAmountCents,
      discountCode: normalizedCode,
    } = applyDiscount(subtotalCents, discountCode);

    const discountedSubtotalCents = subtotalAfterDiscount;

    // For now, we do NOT calculate tax (handled later if needed)
    const taxAmountCents = 0;

    // Flat shipping for all orders
    const shippingCents = FLAT_SHIPPING_CENTS;

    // Final total = discounted subtotal + shipping + tax (0)
    const totalCents =
      discountedSubtotalCents + shippingCents + taxAmountCents;

    // Simple order id
    const orderId = 'avh_' + crypto.randomBytes(6).toString('hex');

    // Compact metadata of { sku, qty }
    const metaItems = [];
    for (const item of items) {
      const entry = {
        sku: skuKey(item.id, item.options || {}),
        qty: item.qty,
      };
      const testJson = JSON.stringify([...metaItems, entry]);
      if (testJson.length > 480) break;
      metaItems.push(entry);
    }
    const metaItemsJson = JSON.stringify(metaItems);

    const pi = await stripe.paymentIntents.create({
      amount: totalCents,
      currency: 'usd',
      payment_method_types: ['card'],
      receipt_email: email || undefined,
      metadata: {
        order_id: orderId,
        items: metaItemsJson,
        discount_code: normalizedCode || '',
        discount_amount_cents: String(discountAmountCents || 0),
        tax_amount_cents: String(taxAmountCents || 0),
        subtotal_cents: String(subtotalCents || 0),
        discounted_subtotal_cents: String(discountedSubtotalCents || 0),
        shipping_cents: String(shippingCents || 0),
      },
      shipping: {
        name: shipping.name || undefined,
        address: {
          line1: shipping.line1 || undefined,
          line2: shipping.line2 || undefined,
          city: shipping.city || undefined,
          state: shipping.state || undefined,
          postal_code: shipping.postal_code || undefined,
          country: shipping.country || 'US',
        },
      },
    });

    return res.status(200).json({
      clientSecret: pi.client_secret,
      intentId: pi.id,
      breakdown: {
        subtotalCents,
        discountAmountCents,
        discountedSubtotalCents,
        taxAmountCents,
        shippingCents,
        totalCents,
        discountCode: normalizedCode,
      },
    });
  } catch (e) {
    console.error('create-payment-intent error', e);
    return res
      .status(500)
      .json({ error: e.message || 'Internal error' });
  }
}