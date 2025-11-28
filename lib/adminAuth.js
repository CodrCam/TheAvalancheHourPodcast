// lib/adminAuth.js
import crypto from 'crypto';

export function timingSafeEqual(a = '', b = '') {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    const dummy = crypto.randomBytes(32);
    crypto.timingSafeEqual(dummy, dummy);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

export function requireAdmin(req, res) {
  const expected = process.env.ADMIN_TOKEN || '';
  const provided =
    req.headers['x-admin-token'] ||
    req.headers['x-adminkey'] ||
    (req.cookies && req.cookies['admin_token']) ||
    '';

  if (!expected || !timingSafeEqual(String(provided), String(expected))) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
