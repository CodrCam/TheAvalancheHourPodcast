// pages/api/store/admin/orders-export.js
import { Client } from 'pg';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('Method not allowed');
  }

  const SUPABASE_DB_URL = process.env.SUPABASE_DB_URL;
  if (!SUPABASE_DB_URL) {
    return res.status(500).end('SUPABASE_DB_URL not configured');
  }

  const pg = new Client({
    connectionString: SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await pg.connect();

    // Export only orders that are NOT shipped yet
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
      where fulfillment_status is distinct from 'shipped'
      order by created_at asc
      limit 1000
    `);

    // Pirate Ship–friendly headers
    const headers = [
      'Name',          // Shipping recipient
      'Company',
      'Street',
      'Street2',
      'City',
      'State',
      'Zip',
      'Country',
      'Email',
      'OrderID',
      'TotalAmount',
      'Items',
      'Pounds',        // optional, can be blank
      'Ounces',        // optional, can be blank
      'Length',        // optional, can be blank
      'Width',         // optional, can be blank
      'Height',        // optional, can be blank
    ];

    const escape = (value) => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      if (str.includes('"') || str.includes(',') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [headers.join(',')];

    // Helper to format each line item with variant options, e.g.
    // "1× Season 10 Zip-Up Hoodie (Dark Grey Heather / L)"
    function formatItemText(it) {
      if (!it || typeof it !== 'object') return '1× Item';
      const qty = it.qty || it.quantity || 1;
      const name = it.name || it.sku || it.id || 'Item';
      const opt = it.options || {};
      const parts = [];
      if (opt.style) parts.push(opt.style);
      if (opt.size) parts.push(opt.size);
      if (opt.color) parts.push(opt.color);
      const variant =
        parts.length > 0 ? ` (${parts.join(' / ')})` : '';
      return `${qty}× ${name}${variant}`;
    }

    for (const r of rows) {
      // Items as "2× ReCaps Corduroy — Blue/Grey (L); 1× Voile Strap 20\" — Black"
      const itemsText = Array.isArray(r.items)
        ? r.items.map((it) => formatItemText(it)).join('; ')
        : '';

      // For now we leave weight & dims blank and let Pirate Ship's
      // "Default package" handle it. Later you can compute per-SKU weights here.
      const pounds = '';
      const ounces = '';
      const length = '';
      const width = '';
      const height = '';

      const row = [
        r.shipping_name || r.customer_name || '',           // Name
        '',                                                 // Company
        r.shipping_address1 || '',                          // Street
        r.shipping_address2 || '',                          // Street2
        r.shipping_city || '',                              // City
        r.shipping_state || '',                             // State
        r.shipping_postal_code || '',                       // Zip
        r.shipping_country || 'US',                         // Country
        r.customer_email || '',                             // Email
        r.order_id || '',                                   // OrderID
        typeof r.amount_cents === 'number'
          ? (r.amount_cents / 100).toFixed(2)
          : '',                                             // TotalAmount
        itemsText,                                          // Items
        pounds,
        ounces,
        length,
        width,
        height,
      ].map(escape);

      lines.push(row.join(','));
    }

    const csv = lines.join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="orders-unshipped.csv"'
    );
    return res.status(200).send(csv);
  } catch (err) {
    console.error('orders-export error:', err);
    return res.status(500).end('Failed to export orders');
  } finally {
    try {
      await pg.end();
    } catch {}
  }
}