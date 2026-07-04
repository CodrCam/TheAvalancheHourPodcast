// lib/cognitoOAuth.js
import crypto from 'crypto';

const STATE_COOKIE = 'ah_cognito_oauth_state';
const VERIFIER_COOKIE = 'ah_cognito_pkce_verifier';

function base64Url(buffer) {
  return Buffer.from(buffer)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function randomBase64Url(bytes = 32) {
  return base64Url(crypto.randomBytes(bytes));
}

function getHostUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function normalizeDomain(domain = '') {
  const trimmed = domain.trim().replace(/\/+$/, '');
  if (!trimmed) return '';

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const parsed = new URL(trimmed);
      return parsed.origin;
    } catch {
      return trimmed;
    }
  }

  return `https://${trimmed}`;
}

export function getCognitoOAuthConfig(req) {
  const clientId = process.env.COGNITO_APP_CLIENT_ID || '';
  const clientSecret = process.env.COGNITO_APP_CLIENT_SECRET || '';
  const domain = normalizeDomain(process.env.COGNITO_DOMAIN || '');
  const redirectUri =
    process.env.COGNITO_REDIRECT_URI ||
    `${getHostUrl(req)}/admin/auth/callback`;
  const cookieName = process.env.COGNITO_COOKIE_NAME || 'ah_admin_token';
  const logoutUri =
    process.env.COGNITO_LOGOUT_URI || `${getHostUrl(req)}/admin/login`;

  return {
    clientId,
    clientSecret,
    domain,
    redirectUri,
    logoutUri,
    cookieName,
  };
}

export function isCognitoOAuthConfigured(req) {
  const config = getCognitoOAuthConfig(req);
  return Boolean(config.clientId && config.domain && config.redirectUri);
}

export function createPkcePair() {
  const verifier = randomBase64Url(64);
  const challenge = base64Url(
    crypto.createHash('sha256').update(verifier).digest()
  );
  return { verifier, challenge };
}

export function createOAuthState() {
  return randomBase64Url(32);
}

export function buildAuthorizeUrl(req) {
  const config = getCognitoOAuthConfig(req);
  const state = createOAuthState();
  const { verifier, challenge } = createPkcePair();

  if (!isCognitoOAuthConfigured(req)) {
    throw new Error('Cognito OAuth is not configured');
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope: process.env.COGNITO_OAUTH_SCOPES || 'openid email',
    redirect_uri: config.redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
  });

  return {
    url: `${config.domain}/oauth2/authorize?${params.toString()}`,
    state,
    verifier,
  };
}

export async function exchangeCodeForTokens(req, { code, verifier }) {
  const config = getCognitoOAuthConfig(req);

  if (!isCognitoOAuthConfigured(req)) {
    throw new Error('Cognito OAuth is not configured');
  }

  const response = await fetch(`${config.domain}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(config.clientSecret
        ? {
            Authorization: `Basic ${Buffer.from(
              `${config.clientId}:${config.clientSecret}`
            ).toString('base64')}`,
          }
        : {}),
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      code,
      code_verifier: verifier,
    }).toString(),
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(
      body.error_description || body.error || 'Token exchange failed'
    );
  }

  return body;
}

export function buildLogoutUrl(req) {
  const config = getCognitoOAuthConfig(req);

  if (!config.clientId || !config.domain || !config.logoutUri) {
    return config.logoutUri || '/admin/login';
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.logoutUri,
  });

  return `${config.domain}/logout?${params.toString()}`;
}

export function serializeCookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];

  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);

  return parts.join('; ');
}

export function authCookieOptions(req, maxAge) {
  const proto = req.headers['x-forwarded-proto'] || '';
  const secure =
    process.env.NODE_ENV === 'production' ||
    String(proto).split(',')[0].trim() === 'https';

  return {
    httpOnly: true,
    secure,
    sameSite: 'Lax',
    path: '/',
    maxAge,
  };
}

export function getOAuthCookieNames() {
  return {
    state: STATE_COOKIE,
    verifier: VERIFIER_COOKIE,
  };
}
