// /pages/api/sitemap.xml.js
import { SITE_URL } from '../../lib/siteMetadata';
import { products } from '../../src/data/products';

function resolveSiteUrl(req) {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (base) return base.startsWith('http') ? base : `https://${base}`;
  if (process.env.NODE_ENV === 'production') return SITE_URL;
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (String(host).includes('localhost') ? 'http' : 'https');
  return String(host).startsWith('http') ? String(host) : `${proto}://${host}`;
}

export default async function handler(req, res) {
  const siteUrl = resolveSiteUrl(req);
  const now = new Date().toISOString();

  try {
    // Static pages
    const staticPages = [
      { url: '/',               lastmod: now, changefreq: 'weekly',  priority: '1.0' },
      { url: '/episodes',       lastmod: now, changefreq: 'weekly',  priority: '0.9' },
      { url: '/episodes/current', lastmod: now, changefreq: 'weekly',  priority: '0.8' },
      { url: '/episodes/archive', lastmod: now, changefreq: 'monthly', priority: '0.7' },
      { url: '/about',          lastmod: now, changefreq: 'monthly', priority: '0.8' },
      { url: '/resources',      lastmod: now, changefreq: 'monthly', priority: '0.7' },
      { url: '/support',        lastmod: now, changefreq: 'monthly', priority: '0.6' },
      { url: '/contact',        lastmod: now, changefreq: 'monthly', priority: '0.6' },
      { url: '/be-a-guest',     lastmod: now, changefreq: 'monthly', priority: '0.5' },
      { url: '/store',          lastmod: now, changefreq: 'weekly',  priority: '0.8' }
    ];

    // Product detail pages
    const productPages = (products || [])
      .filter(p => p?.slug)
      .map(p => ({
        url: `/store/${encodeURIComponent(p.slug)}`,
        lastmod: now,
        changefreq: 'weekly',
        priority: '0.7'
      }));

    const allPages = [...staticPages, ...productPages];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `
  <url>
    <loc>${siteUrl}${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('')}
</urlset>`.trim();

    res.setHeader('Content-Type', 'text/xml; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=3600');
    res.status(200).send(sitemap);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).json({ error: 'Error generating sitemap' });
  }
}
