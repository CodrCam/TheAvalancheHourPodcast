import crypto from 'crypto';
import { isIP } from 'node:net';

const buckets = new Map();
const MAX_BUCKETS = 5000;
const NETLIFY_CLIENT_IP_HEADER = 'x-nf-client-connection-ip';

function fingerprint(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''), 'utf8')
    .digest('hex');
}

function prune(nowMs) {
  for (const [key, bucket] of buckets) {
    if (bucket.reset_at_ms <= nowMs) buckets.delete(key);
  }
  if (buckets.size >= MAX_BUCKETS) {
    const oldest = [...buckets.entries()]
      .sort((a, b) => a[1].reset_at_ms - b[1].reset_at_ms)
      .slice(0, Math.max(1, Math.ceil(MAX_BUCKETS * 0.1)));
    oldest.forEach(([key]) => buckets.delete(key));
  }
}

function validatedIpAddress(value) {
  if (typeof value !== 'string') return '';
  const candidate = value.trim();
  return isIP(candidate) ? candidate : '';
}

function requestHeader(req = {}, name = '') {
  const headers = req.headers || {};
  if (typeof headers.get === 'function') {
    return headers.get(name) || '';
  }
  const value = headers[name];
  return typeof value === 'string' ? value : '';
}

export function getGuestQuestionnaireClientAddress(
  req = {},
  { isNetlify = process.env.NETLIFY === 'true' } = {}
) {
  if (isNetlify) {
    const netlifyAddress = validatedIpAddress(
      requestHeader(req, NETLIFY_CLIENT_IP_HEADER)
    );
    if (netlifyAddress) return netlifyAddress;
  }
  return validatedIpAddress(req.socket?.remoteAddress) || 'unknown';
}

function consumeBucket({ key, nowMs, duration, maxRequests }) {
  const current = buckets.get(key);
  const bucket =
    current && current.reset_at_ms > nowMs
      ? current
      : { count: 0, reset_at_ms: nowMs + duration };
  bucket.count += 1;
  buckets.set(key, bucket);
  return {
    allowed: bucket.count <= maxRequests,
    remaining: Math.max(0, maxRequests - bucket.count),
    retry_after_seconds: Math.max(
      1,
      Math.ceil((bucket.reset_at_ms - nowMs) / 1000)
    ),
  };
}

export function consumeGuestQuestionnaireRateLimit({
  token = '',
  address = '',
  action = 'read',
  now = new Date(),
  limit,
  windowMs,
} = {}) {
  const write = action === 'submit';
  const maxRequests = Number.isFinite(Number(limit))
    ? Math.max(1, Math.trunc(Number(limit)))
    : write
      ? 10
      : 60;
  const duration = Number.isFinite(Number(windowMs))
    ? Math.max(1000, Math.trunc(Number(windowMs)))
    : write
      ? 15 * 60 * 1000
      : 5 * 60 * 1000;
  const nowMs = now.getTime();
  prune(nowMs);
  const addressRate = consumeBucket({
    key: `address:${action}:${fingerprint(address || 'unknown')}`,
    nowMs,
    duration,
    maxRequests,
  });
  if (!addressRate.allowed) {
    return {
      ...addressRate,
      limit: maxRequests,
    };
  }

  const tokenRate = consumeBucket({
    key: `token:${action}:${fingerprint(token)}`,
    nowMs,
    duration,
    maxRequests,
  });
  return {
    allowed: tokenRate.allowed,
    limit: maxRequests,
    remaining: Math.min(addressRate.remaining, tokenRate.remaining),
    retry_after_seconds: Math.max(
      addressRate.retry_after_seconds,
      tokenRate.retry_after_seconds
    ),
  };
}

export function resetGuestQuestionnaireRateLimitsForTests() {
  buckets.clear();
}
