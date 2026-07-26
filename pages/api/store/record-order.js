// pages/api/store/record-order.js
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import { upsertOrder } from '../../../lib/orderStore';
import { resolveRecordedOrderItems } from '../../../lib/catalogCheckout';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2022-11-15' })
  : null;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const TO_EMAIL = process.env.CONTACT_EMAIL || 'theavalanchehourpodcast@gmail.com';

function getPaymentIntentOrderId(paymentIntent) {
  return paymentIntent?.metadata?.order_id || paymentIntent?.id || '';
}

function parsePaymentIntentItems(paymentIntent) {
  if (!paymentIntent?.metadata?.items) return [];

  try {
    const parsed = JSON.parse(paymentIntent.metadata.items);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { orderId, paymentIntentId } = req.body || {};

  if (!orderId || !paymentIntentId) {
    return res
      .status(400)
      .json({ error: 'orderId and paymentIntentId are required' });
  }

  if (!stripe) {
    return res.status(500).json({ error: 'Stripe not configured' });
  }

  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const verifiedOrderId = getPaymentIntentOrderId(paymentIntent);

    if (paymentIntent.status !== 'succeeded') {
      return res.status(409).json({ error: 'Payment is not complete' });
    }

    if (verifiedOrderId !== orderId) {
      return res.status(403).json({ error: 'Order does not match payment' });
    }

    const verifiedAmountCents =
      typeof paymentIntent.amount_received === 'number'
        ? paymentIntent.amount_received
        : paymentIntent.amount;
    const safeShipping = paymentIntent.shipping || {};
    const safeAddress = safeShipping.address || safeShipping;
    const shippingName = safeShipping.name || null;
    const shippingAddress1 = safeAddress.line1 || null;
    const shippingAddress2 = safeAddress.line2 || null;
    const shippingCity = safeAddress.city || null;
    const shippingState = safeAddress.state || null;
    const shippingPostalCode = safeAddress.postal_code || null;
    const shippingCountry = safeAddress.country || null;
    const verifiedCustomerEmail = paymentIntent.receipt_email || null;
    const customerName = shippingName || null;
    const metadataItems = parsePaymentIntentItems(paymentIntent);
    let recordedItems = metadataItems;
    try {
      recordedItems = await resolveRecordedOrderItems(metadataItems);
    } catch (catalogError) {
      console.error(
        'record-order catalog reconstruction failed; preserving verified Stripe metadata:',
        catalogError
      );
    }

    const { isNewOrder } = await upsertOrder({
      order_id: verifiedOrderId,
      stripe_payment_intent_id: paymentIntent.id,
      status: paymentIntent.status,
      fulfillment_status: 'new',
      amount_cents: verifiedAmountCents,
      items: recordedItems,
      customer_email: verifiedCustomerEmail,
      customer_name: customerName,
      shipping_name: shippingName,
      shipping_address1: shippingAddress1,
      shipping_address2: shippingAddress2,
      shipping_city: shippingCity,
      shipping_state: shippingState,
      shipping_postal_code: shippingPostalCode,
      shipping_country: shippingCountry,
    });

    // Email Caleb ONLY on brand-new orders. A notification failure must not
    // turn a successfully recorded, paid order into an HTTP failure.
    if (isNewOrder) {
      if (!EMAIL_USER || !EMAIL_PASS) {
        // Don’t fail the order if email isn’t configured; just log it.
        console.warn('record-order: EMAIL_USER/EMAIL_PASS not configured; skipping notification email');
      } else {
        try {
          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: EMAIL_USER, pass: EMAIL_PASS },
          });

          const safeItems = recordedItems;
          const lines = safeItems.map((it) => {
            const qty = it.qty ?? 1;
            const name = it.name || it.label || it.title || it.id || 'Item';
            const sku = it.sku ? ` (SKU: ${it.sku})` : '';
            return `- ${qty} × ${name}${sku}`;
          });

          const dollars = (Number(verifiedAmountCents || 0) / 100).toFixed(2);

          const subject = `New order placed — ${verifiedOrderId}`;
          const text =
`A new order was placed.

Order ID: ${verifiedOrderId}
PaymentIntent: ${paymentIntent.id}
Total: $${dollars}

Customer: ${customerName || '(no name)'}
Email: ${verifiedCustomerEmail || '(no email)'}
Ship to:
${shippingName || ''}
${shippingAddress1 || ''}
${shippingAddress2 || ''}
${shippingCity || ''}${shippingCity && shippingState ? ', ' : ''}${shippingState || ''} ${shippingPostalCode || ''}
${shippingCountry || ''}

Items:
${lines.length ? lines.join('\n') : '- (no items provided)'}
`;

          await transporter.sendMail({
            from: EMAIL_USER,
            to: TO_EMAIL,
            subject,
            text,
          });
        } catch (emailError) {
          console.error('record-order notification email failed:', emailError);
        }
      }
    }

    return res.status(200).json({ ok: true, isNewOrder });
  } catch (err) {
    console.error('record-order error:', err);
    return res.status(500).json({ error: 'Failed to record order' });
  }
}
