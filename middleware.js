// middleware.js
import { NextResponse } from 'next/server';

export function middleware(req) {
  const url = req.nextUrl;
  if (!url.pathname.startsWith('/admin')) return NextResponse.next();

  const user = process.env.ADMIN_USER || '';
  const pass = process.env.ADMIN_PASS || '';
  if (!user || !pass) {
    return new NextResponse('Admin credentials not set', { status: 500 });
  }

  const auth = req.headers.get('authorization');
  if (!auth || !auth.startsWith('Basic ')) {
    return new NextResponse('Auth required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Admin"' }
    });
  }

  const [, b64] = auth.split(' ');
  const [u, p] = Buffer.from(b64, 'base64').toString('utf8').split(':');
  if (u === user && p === pass) return NextResponse.next();

  return new NextResponse('Unauthorized', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } });
}

export const config = {
  matcher: ['/admin/:path*'],
};