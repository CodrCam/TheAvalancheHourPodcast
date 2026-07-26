// pages/api/store/create-payment-intent.js
import Stripe from 'stripe';
import crypto from 'crypto';
import { resolveCheckoutItems } from '../../../lib/catalogCheckout';
import { validateItemsWithInventory } from '../../../lib/cartValidation';
import {
  applyStoreDiscount,
  isStoreDiscountCode,
  normalizeStoreDiscountCode,
} from '../../../lib/storeDiscounts.mjs';
import { FLAT_SHIPPING_CENTS } from '../../../src/config/store';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' })
  : null;

const CHECKOUT_INTENT_SCHEMA_VERSION = 'v3';
const PAYMENT_METHOD_TYPES = ['card', 'amazon_pay', 'cashapp'];

function computeOrderAmount(items = []) {
  return items.reduce((sum, it) => sum + it.price * it.qty, 0);
}

function normalizeEmail(value) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : '';
}

function normalizeShipping(value) {
  if (!value || typeof value !== 'object') return null;

  const shipping = {
    name: String(value.name || '').trim(),
    line1: String(value.line1 || '').trim(),
    line2: String(value.line2 || '').trim(),
    city: String(value.city || '').trim(),
    state: String(value.state || '').trim(),
    postal_code: String(value.postal_code || '').trim(),
    country: String(value.country || 'US').trim().toUpperCase(),
  };

  if (
    !shipping.name ||
    !shipping.line1 ||
    !shipping.city ||
    !shipping.state ||
    !/^\d{5}(?:-\d{4})?$/.test(shipping.postal_code) ||
    !['US', 'USA'].includes(shipping.country)
  ) {
    return null;
  }

  shipping.country = 'US';
  return shipping;
}

function normalizeCheckoutAttemptId(value) {
  const attemptId = typeof value === 'string' ? value.trim() : '';
  return /^[a-zA-Z0-9_-]{8,100}$/.test(attemptId) ? attemptId : '';
}

function buildIdempotencyKey({
  attemptId,
  items,
  email,
  shipping,
  discountCode,
  totalCents,
  shippingCents,
  taxAmountCents,
  discountAmountCents,
}) {
  const fingerprint = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        schemaVersion: CHECKOUT_INTENT_SCHEMA_VERSION,
        amount: totalCents,
        currency: 'usd',
        paymentMethodTypes: PAYMENT_METHOD_TYPES,
        shippingCents,
        taxAmountCents,
        discountAmountCents,
        items: items.map(({ id, sku, price, qty, options }) => ({
          id,
          sku,
          price,
          qty,
          options,
        })),
        email,
        shipping,
        discountCode,
      })
    )
    .digest('hex')
    .slice(0, 32);

  return `checkout-${CHECKOUT_INTENT_SCHEMA_VERSION}-${attemptId}-${fingerprint}`;
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
    let items;
    try {
      items = await resolveCheckoutItems(body.items);
    } catch (err) {
      if (err?.isCatalogCheckoutValidationError) {
        return res.status(400).json({
          error: err.message || 'The cart contains an unavailable product.',
        });
      }
      console.error('create-payment-intent catalog error', err);
      return res.status(503).json({
        error:
          'The store catalog is temporarily unavailable. Please try again shortly.',
      });
    }

    // Normalize & validate email; require basic structure so receipts go somewhere real.
    const email = normalizeEmail(body.email);
    const shipping = normalizeShipping(body.shipping);
    const discountCode =
      typeof body.discountCode === 'string' ? body.discountCode : null;
    const checkoutAttemptId = normalizeCheckoutAttemptId(
      body.checkoutAttemptId
    );

    if (!items.length) {
      return res.status(400).json({ error: 'No valid items in order' });
    }

    if (!email) {
      return res.status(400).json({ error: 'A valid email address is required' });
    }

    if (!shipping) {
      return res
        .status(400)
        .json({ error: 'Complete U.S. shipping information is required' });
    }

    if (!checkoutAttemptId) {
      return res.status(400).json({ error: 'Checkout session is invalid' });
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

    const requestedDiscountCode = normalizeStoreDiscountCode(discountCode);
    if (
      requestedDiscountCode &&
      !isStoreDiscountCode(requestedDiscountCode)
    ) {
      return res.status(400).json({
        error: 'That discount code was not recognized. Check the code and try again.',
      });
    }

    // Discount
    const {
      subtotalAfterDiscount,
      discountAmountCents,
      discountCode: normalizedCode,
      shippingWaived,
    } = applyStoreDiscount(subtotalCents, discountCode);

    const discountedSubtotalCents = subtotalAfterDiscount;

    // For now, we do NOT calculate tax (handled later if needed)
    const taxAmountCents = 0;

    const shippingCents = shippingWaived ? 0 : FLAT_SHIPPING_CENTS;

    // Final total = discounted subtotal + shipping + tax (0)
    const totalCents =
      discountedSubtotalCents + shippingCents + taxAmountCents;

    const idempotencyKey = buildIdempotencyKey({
      attemptId: checkoutAttemptId,
      items,
      email,
      shipping,
      discountCode: normalizedCode || '',
      totalCents,
      shippingCents,
      taxAmountCents,
      discountAmountCents,
    });
    const orderId = `avh_${crypto
      .createHash('sha256')
      .update(idempotencyKey)
      .digest('hex')
      .slice(0, 12)}`;

    // Compact metadata of { sku, qty }
    const metaItems = [];
    for (const item of items) {
      const entry = {
        sku: item.sku,
        qty: item.qty,
      };
      const testJson = JSON.stringify([...metaItems, entry]);
      if (testJson.length > 480) {
        return res.status(400).json({
          error:
            'This cart has too many separate product variants. Place it as two orders.',
        });
      }
      metaItems.push(entry);
    }
    const metaItemsJson = JSON.stringify(metaItems);

    const pi = await stripe.paymentIntents.create(
      {
        amount: totalCents,
        currency: 'usd',
        payment_method_types: PAYMENT_METHOD_TYPES,
        receipt_email: email,
        metadata: {
          order_id: orderId,
          items: metaItemsJson,
          checkout_attempt_id: checkoutAttemptId,
          checkout_intent_version: CHECKOUT_INTENT_SCHEMA_VERSION,
          discount_code: normalizedCode || '',
          discount_amount_cents: String(discountAmountCents || 0),
          tax_amount_cents: String(taxAmountCents || 0),
          subtotal_cents: String(subtotalCents || 0),
          discounted_subtotal_cents: String(discountedSubtotalCents || 0),
          shipping_cents: String(shippingCents || 0),
          shipping_waived: String(shippingWaived),
        },
        shipping: {
          name: shipping.name,
          address: {
            line1: shipping.line1,
            line2: shipping.line2 || undefined,
            city: shipping.city,
            state: shipping.state,
            postal_code: shipping.postal_code,
            country: 'US',
          },
        },
      },
      {
        idempotencyKey,
      }
    );

    return res.status(200).json({
      clientSecret: pi.client_secret,
      intentId: pi.id,
      orderId,
      breakdown: {
        subtotalCents,
        discountAmountCents,
        discountedSubtotalCents,
        taxAmountCents,
        shippingCents,
        totalCents,
        discountCode: normalizedCode,
        shippingWaived,
      },
    });
  } catch (e) {
    console.error('create-payment-intent error', e);
    return res.status(500).json({
      error: 'Secure checkout could not be prepared. Please try again.',
    });
  }
}
