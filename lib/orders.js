// lib/orders.js
import fs from 'fs';
import path from 'path';

export const ORDERS_PATH = path.join(process.cwd(), 'data', 'orders.json');

function ensureDir(p) {
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(p)) fs.writeFileSync(p, '[]');
}

export function readOrders() {
  try {
    ensureDir(ORDERS_PATH);
    const raw = fs.readFileSync(ORDERS_PATH, 'utf-8');
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function writeOrders(next) {
  ensureDir(ORDERS_PATH);
  const tmp = ORDERS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2));
  fs.renameSync(tmp, ORDERS_PATH);
}

export function appendOrder(order) {
  const all = readOrders();
  all.unshift(order); // newest first
  writeOrders(all);
}

export function toCSV(rows) {
  const esc = (v) =>
    String(v ?? '')
      .replace(/"/g, '""')
      .replace(/\n/g, ' ');
  const headers = [
    'id','created','status','amount','currency',
    'email','name','line1','city','state','postal_code','country',
    'items'
  ];
  const lines = [
    headers.join(','),
    ...rows.map(r => {
      const addr = r.shipping?.address || {};
      const items = r.items.map(i => {
        const o = i.options || {};
        return `${i.id} x${i.qty}${o.size ? ` (${o.size})` : ''}${o.color ? ` (${o.color})` : ''}`;
      }).join('; ');
      const cols = [
        r.id,
        r.created,
        r.status,
        (r.amount/100).toFixed(2),
        r.currency,
        r.email,
        r.shipping?.name || '',
        addr.line1 || '', addr.city || '', addr.state || '',
        addr.postal_code || '', addr.country || '',
        items
      ];
      return cols.map(esc).map(v => `"${v}"`).join(',');
    })
  ];
  return lines.join('\n');
}