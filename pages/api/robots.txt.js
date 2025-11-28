// /pages/api/robots.txt.js

function resolveSiteUrl(req) {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (base) return base.startsWith('http') ? base : `https://${base}`;
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (String(host).includes('localhost') ? 'http' : 'https');
  return String(host).startsWith('http') ? String(host) : `${proto}://${host}`;
}

export default function handler(req, res) {
  const siteUrl = resolveSiteUrl(req);
  const host = siteUrl.replace(/^https?:\/\//, '');

  const content = `
User-agent: *
Allow: /

# Disallow internal/admin/dev paths
Disallow: /api/
Disallow: /admin/
Disallow: /store/admin/
Disallow: /_next/
Disallow: /private/
Disallow: /tmp/
Disallow: /drafts/

Sitemap: ${siteUrl}/api/sitemap.xml
Crawl-delay: 5
Host: ${host}
`.trim();

  res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
  res.status(200).send(content);
}