// pages/api/robots.txt.js
export default function handler(req, res) {
  const baseUrl = 'https://www.theavalanchehour.com';
  
  const robotsTxt = `User-agent: *
Allow: /

# Sitemap
Sitemap: ${baseUrl}/api/sitemap.xml

# Disallow admin pages if any
Disallow: /admin/
Disallow: /_next/
Disallow: /api/

# Allow specific API endpoints that should be crawled
Allow: /api/sitemap.xml
Allow: /api/robots.txt

# Crawl delay for polite crawling
Crawl-delay: 1

# Block common bot traps
Disallow: /trap/
Disallow: /honeypot/`;

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
  res.status(200).send(robotsTxt);
}

// Also create static robots.txt in public folder with this content:
/*
User-agent: *
Allow: /

Sitemap: https://www.theavalanchehour.com/api/sitemap.xml

Disallow: /admin/
Disallow: /_next/
Disallow: /api/

Allow: /api/sitemap.xml
Allow: /api/robots.txt

Crawl-delay: 1
*/