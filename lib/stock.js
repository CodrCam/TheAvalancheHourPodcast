// lib/stock.js
import fs from 'fs';
import path from 'path';
import { products } from '../src/data/products';

export const STOCK_PATH = path.join(process.cwd(), 'data', 'stock.json');

function ensureStockFile() {
  const dir = path.dirname(STOCK_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(STOCK_PATH)) fs.writeFileSync(STOCK_PATH, '[]', 'utf8');
}

export function readStock() {
  ensureStockFile();
  const raw = fs.readFileSync(STOCK_PATH, 'utf8');
  try {
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      return arr.map((r) => ({
        sku: String(r.sku),
        quantity: Number(r.quantity) || 0,
      }));
    }
  } catch {
    // ignore parse errors, fall through
  }
  return [];
}

export function writeStock(list) {
  ensureStockFile();
  const clean = (Array.isArray(list) ? list : []).map((r) => ({
    sku: String(r.sku),
    quantity: Math.max(0, Number(r.quantity) || 0),
  }));
  fs.writeFileSync(STOCK_PATH, JSON.stringify(clean, null, 2), 'utf8');
}

/**
 * skuKey
 *
 * Normalizes a cart item (id + options) into a concrete SKU string that
 * matches the rows in the `inventory` table.
 *
 * For your current catalog, it prefers:
 *   - product.variants[style].skuBySize[size]
 *   - product.variants[style].skuByColor[color]
 * and falls back to the old "id:color:size:style" scheme if nothing matches.
 */
export function skuKey(id, options = {}) {
  const pid = String(id);
  const p = products.find((x) => x.id === pid);

  const style = options.style || options.material || options.variant || null;
  const size = options.size || null;
  const color = options.color || null;

  if (p && p.variants && style && p.variants[style]) {
    const v = p.variants[style];

    // Hoodie-style: sizes drive SKU
    if (size && v.skuBySize && v.skuBySize[size]) {
      return v.skuBySize[size];
    }

    // Hat / strap-style: colors drive SKU
    if (color && v.skuByColor && v.skuByColor[color]) {
      return v.skuByColor[color];
    }
  }

  // Single-SKU product (no variants): just use id itself where it matches inventory
  if (pid === 'free-range-tote') {
    return 'free-range-tote';
  }

  // Fallback: legacy colon-joined key (keeps old behavior for anything unmapped)
  const parts = [pid];
  const { material, fit, variant } = options;

  if (material) parts.push(String(material));
  if (color) parts.push(String(color));
  if (size) parts.push(String(size));
  if (fit) parts.push(String(fit));
  if (style) parts.push(String(style));
  if (variant) parts.push(String(variant));

  return parts.join(':');
}