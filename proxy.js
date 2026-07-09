// proxy.js
import { NextResponse } from 'next/server';

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

function isPublicAuthPath(pathname) {
  return (
    pathname === '/admin/login' ||
    pathname === '/admin/auth/callback' ||
    pathname === '/api/store/admin/auth/login' ||
    pathname === '/api/store/admin/auth/logout'
  );
}

export function proxy(req) {
  const url = req.nextUrl;
  const isAdminPage = url.pathname.startsWith('/admin');
  const isAdminApi = url.pathname.startsWith('/api/store/admin');
  if (!isAdminPage && !isAdminApi) return NextResponse.next();

  if (isPublicAuthPath(url.pathname)) {
    return NextResponse.next();
  }

  if (!isCognitoConfigured()) {
    return new NextResponse('Cognito admin auth is not configured', {
      status: 500,
    });
  }

  if (hasCognitoTokenCandidate(req)) {
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
