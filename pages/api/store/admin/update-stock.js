// pages/api/store/admin/update-stock.js
import { Client } from 'pg';

export const config = { api: { bodyParser: true } };

function getPg() {
  const cs = process.env.SUPABASE_DB_URL;
  if (!cs) return null;
  return new Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
}

function normalizeBody(req, mode) {
  // mode: 'delta' for PUT, 'set' for PATCH
  const b = req.body || {};
  if (Array.isArray(b.items)) return b.items;
  if (mode === 'delta') return b.sku ? [{ sku: b.sku, delta: Number(b.delta) }] : [];
  if (mode === 'set') return b.sku ? [{ sku: b.sku, quantity: Number(b.quantity) }] : [];
  return [];
}

async function applyDelta(pg, sku, delta) {
  // increments by delta; floors at 0
  const { rows } = await pg.query(
    `
    insert into inventory (sku_key, quantity, updated_at)
    values ($1, greatest(0, $2), now())
    on conflict (sku_key)
    do update set quantity = greatest(0, inventory.quantity + $2), updated_at = now()
    returning sku_key as sku, quantity
    `,
    [sku, delta]
  );
  return rows[0];
}

async function applySet(pg, sku, quantity) {
  const q = Math.max(0, Number.isFinite(quantity) ? quantity : 0);
  const { rows } = await pg.query(
    `
    insert into inventory (sku_key, quantity, updated_at)
    values ($1, $2, now())
    on conflict (sku_key)
    do update set quantity = $2, updated_at = now()
    returning sku_key as sku, quantity
    `,
    [sku, q]
  );
  return rows[0];
}

export default async function handler(req, res) {
  // Allow only PUT (delta) and PATCH (set)
  if (!['PUT', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'PUT,PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Require JSON
  if (!req.headers['content-type']?.includes('application/json')) {
    return res.status(400).json({ ok: false, error: 'Content-Type must be application/json' });
  }

  const pg = getPg();
  if (!pg) {
    return res.status(200).json({ ok: false, error: 'Missing SUPABASE_DB_URL' });
  }

  const mode = req.method === 'PUT' ? 'delta' : 'set';
  const items = normalizeBody(req, mode).filter(Boolean);

  if (!items.length) {
    return res.status(200).json({ ok: false, error: 'No items provided' });
  }

  try {
    await pg.connect();
    const updated = [];

    if (mode === 'delta') {
      for (const it of items) {
        const sku = String(it.sku || '').trim();
        const delta = Number(it.delta);
        if (!sku || !Number.isFinite(delta)) continue;
        updated.push(await applyDelta(pg, sku, delta));
      }
    } else {
      for (const it of items) {
        const sku = String(it.sku || '').trim();
        const q = Number(it.quantity);
        if (!sku || !Number.isFinite(q)) continue;
        updated.push(await applySet(pg, sku, q));
      }
    }

    return res.status(200).json({ ok: true, updated });
  } catch {
    // Hardened: no 500s, quiet failure
    return res.status(200).json({ ok: false, error: 'update failed' });
  } finally {
    try { await pg.end(); } catch {}
  }
}
