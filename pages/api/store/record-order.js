// pages/api/store/record-order.js
import nodemailer from 'nodemailer';
import { upsertOrder } from '../../../lib/orderStore';

const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const TO_EMAIL = process.env.CONTACT_EMAIL || 'theavalanchehourpodcast@gmail.com';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    orderId,
    paymentIntentId,
    status,
    amountCents,
    items,
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

  try {
    const { isNewOrder } = await upsertOrder({
      order_id: orderId,
      stripe_payment_intent_id: paymentIntentId,
      status: status || 'paid',
      fulfillment_status: 'new',
      amount_cents: typeof amountCents === 'number' ? amountCents : 0,
      items: Array.isArray(items) ? items : [],
      customer_email: customerEmail,
      customer_name: customerName,
      shipping_name: shippingName,
      shipping_address1: shippingAddress1,
      shipping_address2: shippingAddress2,
      shipping_city: shippingCity,
      shipping_state: shippingState,
      shipping_postal_code: shippingPostalCode,
      shipping_country: shippingCountry,
    });

    // Email Caleb ONLY on brand-new orders.
    if (isNewOrder) {
      if (!EMAIL_USER || !EMAIL_PASS) {
        // Don’t fail the order if email isn’t configured; just log it.
        console.warn('record-order: EMAIL_USER/EMAIL_PASS not configured; skipping notification email');
      } else {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: EMAIL_USER, pass: EMAIL_PASS },
        });

        const safeItems = Array.isArray(items) ? items : [];
        const lines = safeItems.map((it) => {
          const qty = it.qty ?? 1;
          const name = it.name || it.label || it.title || it.id || 'Item';
          const sku = it.sku ? ` (SKU: ${it.sku})` : '';
          return `- ${qty} × ${name}${sku}`;
        });

        const dollars = (Number(amountCents || 0) / 100).toFixed(2);

        const subject = `New order placed — ${orderId}`;
        const text =
`A new order was placed.

Order ID: ${orderId}
PaymentIntent: ${paymentIntentId}
Total: $${dollars}

Customer: ${customerName || '(no name)'}
Email: ${customerEmail || '(no email)'}
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
      }
    }

    return res.status(200).json({ ok: true, isNewOrder });
  } catch (err) {
    console.error('record-order error:', err);
    return res.status(500).json({ error: 'Failed to record order' });
  }
}
