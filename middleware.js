// middleware.js
import { NextResponse } from 'next/server';

function parseBasicAuth(header = '') {
  if (!header.startsWith('Basic ')) return null;

  try {
    const [, encoded] = header.split(' ');
    const decoded = Buffer.from(encoded || '', 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator === -1) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function configuredPrincipals() {
  if (process.env.ALLOW_LEGACY_ADMIN_AUTH !== 'true') {
    return [];
  }

  return [
    {
      username: process.env.ADMIN_USER || '',
      password: process.env.ADMIN_PASS || '',
      token: process.env.ADMIN_TOKEN || '',
    },
    {
      username: process.env.LOGISTICS_USER || '',
      password: process.env.LOGISTICS_PASS || '',
      token: process.env.LOGISTICS_TOKEN || '',
    },
  ].filter(
    (principal) => principal.token || (principal.username && principal.password)
  );
}

function isCognitoConfigured() {
  const region = process.env.COGNITO_REGION || process.env.AWS_REGION || '';
  return Boolean(
    process.env.COGNITO_APP_CLIENT_ID &&
      (process.env.COGNITO_ISSUER ||
        (region && process.env.COGNITO_USER_POOL_ID))
  );
}

function hasCognitoTokenCandidate(req) {
  const cookieName = process.env.COGNITO_COOKIE_NAME || 'ah_admin_token';
  const auth = req.headers.get('authorization') || '';

  return Boolean(
    auth.startsWith('Bearer ') ||
      req.cookies.get(cookieName)?.value ||
      req.cookies.get('cognito_access_token')?.value ||
      req.cookies.get('cognito_id_token')?.value
  );
}

function isAllowedRequest(req) {
  const auth = parseBasicAuth(req.headers.get('authorization') || '');
  const token =
    req.headers.get('x-admin-token') ||
    req.headers.get('x-adminkey') ||
    req.cookies.get('admin_token')?.value ||
    '';

  return configuredPrincipals().some((principal) => {
    const basicMatches =
      auth &&
      auth.username === principal.username &&
      auth.password === principal.password;
    const tokenMatches = token && token === principal.token;
    return basicMatches || tokenMatches;
  });
}

function isPublicAuthPath(pathname) {
  return (
    pathname === '/admin/login' ||
    pathname === '/admin/auth/callback' ||
    pathname === '/api/store/admin/auth/login' ||
    pathname === '/api/store/admin/auth/logout'
  );
}

export function middleware(req) {
  const url = req.nextUrl;
  const isAdminPage = url.pathname.startsWith('/admin');
  const isAdminApi = url.pathname.startsWith('/api/store/admin');
  if (!isAdminPage && !isAdminApi) return NextResponse.next();

  if (isPublicAuthPath(url.pathname)) {
    return NextResponse.next();
  }

  if (configuredPrincipals().length === 0 && !isCognitoConfigured()) {
    return new NextResponse('Admin credentials not set', { status: 500 });
  }

  if (
    isAllowedRequest(req) ||
    (isCognitoConfigured() && hasCognitoTokenCandidate(req))
  ) {
    return NextResponse.next();
  }

  if (isAdminPage) {
    const loginUrl = url.clone();
    loginUrl.pathname = '/admin/login';
    loginUrl.search = '';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export const config = {
  matcher: ['/admin/:path*', '/api/store/admin/:path*'],
};
