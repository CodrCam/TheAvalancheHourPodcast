// pages/api/store/apply-tax.js
import Stripe from 'stripe';
import { products } from '../../../src/data/products';
import { skuKey } from '../../../lib/stock';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' })
  : null;

// Same discount rules as create-payment-intent
const DISCOUNT_CODES = {
  FRIENDS20: { type: 'percent', value: 20 },
};

function normalizeItems(raw = []) {
  const clean = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    const p = products.find((x) => x.id === r.id);
    if (!p) continue;

    const qty = Math.max(
      0,
      Math.min(parseInt(r.qty ?? 0, 10) || 0, 100)
    );
    if (!qty) continue;

    clean.push({
      id: p.id,
      name: p.name || p.id,
      price: p.price || 0, // cents
      qty,
      options: r.options || {},
    });
  }
  return clean;
}

function computeOrderAmount(items = []) {
  return items.reduce((sum, it) => sum + it.price * it.qty, 0);
}

function applyDiscount(amountCents, rawCode) {
  const normalized =
    typeof rawCode === 'string'
      ? rawCode.trim().toUpperCase()
      : '';

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
    discountAmountCents = Math.floor(
      (amountCents * def.value) / 100
    );
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

  const minCharge = 50;
  const newSubtotal = Math.max(
    amountCents - discountAmountCents,
    minCharge
  );

  if (newSubtotal === minCharge) {
    discountAmountCents = amountCents - minCharge;
  }

  return {
    subtotalAfterDiscount: newSubtotal,
    discountAmountCents,
    discountCode: normalized,
  };
}

// Allocate an order-level discount across line items for tax
function splitDiscountAcrossLines(items, totalDiscountCents) {
  const preDiscountTotal = computeOrderAmount(items);
  if (preDiscountTotal <= 0 || totalDiscountCents <= 0) {
    return items.map((it) => ({
      item: it,
      amount: it.price * it.qty,
      discountShare: 0,
    }));
  }

  const result = [];
  let accumulated = 0;

  items.forEach((it, idx) => {
    const base = it.price * it.qty;
    let share = 0;

    if (idx < items.length - 1) {
      share = Math.floor(
        (base * totalDiscountCents) / preDiscountTotal
      );
      accumulated += share;
    } else {
      // Last line gets the remainder to avoid rounding drift
      share = totalDiscountCents - accumulated;
    }

    const amount = Math.max(base - share, 0);
    result.push({ item: it, amount, discountShare: share });
  });

  return result;
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
    const {
      paymentIntentId,
      items: rawItems,
      discountCode,
      shipping,
    } = req.body || {};

    if (!paymentIntentId) {
      return res
        .status(400)
        .json({ error: 'paymentIntentId is required' });
    }

    const items = normalizeItems(rawItems);
    if (!items.length) {
      return res
        .status(400)
        .json({ error: 'No valid items to tax' });
    }

    const preDiscountSubtotal = computeOrderAmount(items);

    const {
      subtotalAfterDiscount,
      discountAmountCents,
      discountCode: normalizedCode,
    } = applyDiscount(preDiscountSubtotal, discountCode);

    let taxAmountCents = 0;
    let totalCents = subtotalAfterDiscount;
    let taxCalculationId = null;

    const hasShippingAddress =
      shipping &&
      typeof shipping === 'object' &&
      shipping.country &&
      shipping.postal_code;

    if (hasShippingAddress) {
      // Split discount across lines for tax
      const lines = splitDiscountAcrossLines(
        items,
        discountAmountCents
      );

      const lineItems = lines.map(({ item, amount }) => ({
        amount, // cents, after discount share
        reference: skuKey(item.id, item.options || {}),
        // Generic physical goods tax code; customize per product if needed
        tax_code: 'txcd_99999999',
      }));

      try {
        const calculation = await stripe.tax.calculations.create({
          currency: 'usd',
          line_items: lineItems,
          customer_details: {
            address: {
              line1: shipping.line1 || undefined,
              line2: shipping.line2 || undefined,
              city: shipping.city || undefined,
              state: shipping.state || undefined,
              postal_code: shipping.postal_code || undefined,
              country: shipping.country || 'US',
            },
            address_source: 'shipping',
          },
        });

        taxCalculationId = calculation.id;
        totalCents =
          typeof calculation.amount_total === 'number'
            ? calculation.amount_total
            : subtotalAfterDiscount;

        taxAmountCents =
          typeof calculation.amount_tax === 'number'
            ? calculation.amount_tax
            : Math.max(totalCents - subtotalAfterDiscount, 0);
      } catch (err) {
        console.error('Stripe Tax calculation error:', err);
        // Fallback: no tax, but still allow payment
        taxAmountCents = 0;
        totalCents = subtotalAfterDiscount;
      }
    }

    // Update the existing PaymentIntent to final amount (subtotal - discount + tax)
    const metadataUpdates = {
      tax_amount_cents: String(taxAmountCents || 0),
      tax_subtotal_after_discount_cents: String(
        subtotalAfterDiscount || 0
      ),
    };
    if (taxCalculationId) {
      metadataUpdates.tax_calculation_id = taxCalculationId;
    }
    if (normalizedCode) {
      metadataUpdates.discount_code = normalizedCode;
      metadataUpdates.discount_amount_cents = String(
        discountAmountCents || 0
      );
    }

    await stripe.paymentIntents.update(paymentIntentId, {
      amount: totalCents,
      metadata: metadataUpdates,
    });

    return res.status(200).json({
      totalCents,
      taxAmountCents,
      discountAmountCents,
    });
  } catch (e) {
    console.error('apply-tax error', e);
    return res
      .status(500)
      .json({ error: e.message || 'Internal error' });
  }
}