// lib/cognitoAuth.js
import crypto from 'crypto';

const JWKS_CACHE_TTL_MS = 60 * 60 * 1000;

let jwksCache = {
  issuer: '',
  fetchedAt: 0,
  keys: [],
};

function base64UrlDecode(input = '') {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(
    normalized.length + ((4 - (normalized.length % 4)) % 4),
    '='
  );
  return Buffer.from(padded, 'base64');
}

function parseJwt(token = '') {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }

  return {
    header: JSON.parse(base64UrlDecode(parts[0]).toString('utf8')),
    payload: JSON.parse(base64UrlDecode(parts[1]).toString('utf8')),
    signingInput: `${parts[0]}.${parts[1]}`,
    signature: base64UrlDecode(parts[2]),
  };
}

function getCognitoConfig() {
  const region = process.env.COGNITO_REGION || process.env.AWS_REGION || '';
  const userPoolId = process.env.COGNITO_USER_POOL_ID || '';
  const clientId = process.env.COGNITO_APP_CLIENT_ID || '';
  const issuer =
    process.env.COGNITO_ISSUER ||
    (region && userPoolId
      ? `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`
      : '');

  return {
    region,
    userPoolId,
    clientId,
    issuer,
    adminGroup: process.env.COGNITO_ADMIN_GROUP || 'admin',
    logisticsGroup: process.env.COGNITO_LOGISTICS_GROUP || 'logistics',
    cookieName: process.env.COGNITO_COOKIE_NAME || 'ah_admin_token',
  };
}

export function isCognitoConfigured() {
  const config = getCognitoConfig();
  return Boolean(config.issuer && config.clientId);
}

function getCookieValue(req, name) {
  if (!name) return '';

  const cookies = req.cookies || {};
  const nextCookie = cookies.get?.(name);
  if (typeof nextCookie?.value === 'string') return nextCookie.value;
  if (typeof cookies[name] === 'string') return cookies[name];

  return '';
}

function getBearerToken(req) {
  const header =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    req.headers?.get?.('authorization') ||
    '';

  if (typeof header !== 'string' || !header.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}

export function getCognitoTokenFromRequest(req) {
  const config = getCognitoConfig();

  return (
    getBearerToken(req) ||
    getCookieValue(req, config.cookieName) ||
    getCookieValue(req, 'cognito_access_token') ||
    getCookieValue(req, 'cognito_id_token')
  );
}

async function fetchJwks(issuer) {
  const now = Date.now();
  if (
    jwksCache.issuer === issuer &&
    jwksCache.keys.length > 0 &&
    now - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS
  ) {
    return jwksCache.keys;
  }

  const response = await fetch(`${issuer}/.well-known/jwks.json`);
  if (!response.ok) {
    throw new Error('Failed to fetch Cognito JWKS');
  }

  const body = await response.json();
  const keys = Array.isArray(body.keys) ? body.keys : [];

  jwksCache = {
    issuer,
    fetchedAt: now,
    keys,
  };

  return keys;
}

function verifySignature({ header, signingInput, signature }, jwk) {
  if (header.alg !== 'RS256') return false;

  const publicKey = crypto.createPublicKey({
    key: jwk,
    format: 'jwk',
  });

  return crypto.verify(
    'RSA-SHA256',
    Buffer.from(signingInput),
    publicKey,
    signature
  );
}

function validatePayload(payload, config) {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const tokenUse = payload.token_use;

  if (payload.iss !== config.issuer) {
    throw new Error('Invalid Cognito issuer');
  }

  if (typeof payload.exp !== 'number' || payload.exp <= nowSeconds) {
    throw new Error('Expired Cognito token');
  }

  if (typeof payload.nbf === 'number' && payload.nbf > nowSeconds) {
    throw new Error('Cognito token is not active yet');
  }

  if (tokenUse === 'access') {
    if (payload.client_id !== config.clientId) {
      throw new Error('Invalid Cognito access-token client');
    }
    return;
  }

  if (tokenUse === 'id') {
    if (payload.aud !== config.clientId) {
      throw new Error('Invalid Cognito ID-token audience');
    }
    return;
  }

  throw new Error('Unsupported Cognito token type');
}

export async function verifyCognitoToken(token) {
  const config = getCognitoConfig();
  if (!isCognitoConfigured()) return null;
  if (!token) return null;

  const parsed = parseJwt(token);
  const keys = await fetchJwks(config.issuer);
  const key = keys.find((candidate) => candidate.kid === parsed.header.kid);

  if (!key) {
    throw new Error('Cognito signing key not found');
  }

  if (!verifySignature(parsed, key)) {
    throw new Error('Invalid Cognito token signature');
  }

  validatePayload(parsed.payload, config);

  return parsed.payload;
}

export function getRoleFromCognitoPayload(payload) {
  const config = getCognitoConfig();
  const groups = Array.isArray(payload?.['cognito:groups'])
    ? payload['cognito:groups']
    : [];

  if (groups.includes(config.adminGroup)) return 'admin';
  if (groups.includes(config.logisticsGroup)) return 'logistics';

  return null;
}

export function getUsernameFromCognitoPayload(payload) {
  return (
    payload?.email ||
    payload?.username ||
    payload?.['cognito:username'] ||
    payload?.sub ||
    'cognito-user'
  );
}
