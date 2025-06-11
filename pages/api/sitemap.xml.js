// pages/api/sitemap.xml.js
export default async function handler(req, res) {
  const baseUrl = 'https://www.theavalanchehour.com';
  
  try {
    // Fetch episodes for dynamic sitemap generation
    const episodesResponse = await fetch(`${baseUrl}/api/spotify`);
    const episodes = episodesResponse.ok ? await episodesResponse.json() : [];

    // Static pages
    const staticPages = [
      {
        url: '/',
        lastmod: new Date().toISOString(),
        changefreq: 'weekly',
        priority: '1.0'
      },
      {
        url: '/episodes',
        lastmod: new Date().toISOString(),
        changefreq: 'weekly',
        priority: '0.9'
      },
      {
        url: '/about',
        lastmod: new Date().toISOString(),
        changefreq: 'monthly',
        priority: '0.8'
      },
      {
        url: '/resources',
        lastmod: new Date().toISOString(),
        changefreq: 'monthly',
        priority: '0.7'
      },
      {
        url: '/contact',
        lastmod: new Date().toISOString(),
        changefreq: 'monthly',
        priority: '0.6'
      },
      {
        url: '/be-a-guest',
        lastmod: new Date().toISOString(),
        changefreq: 'monthly',
        priority: '0.5'
      }
    ];

    // Episode pages (if you create individual episode pages)
    const episodePages = episodes.map(episode => ({
      url: `/episodes/${encodeURIComponent(episode.id)}`,
      lastmod: episode.release_date,
      changefreq: 'yearly',
      priority: '0.6'
    }));

    const allPages = [...staticPages, ...episodePages];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages.map(page => `
  <url>
    <loc>${baseUrl}${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('')}
</urlset>`;

    res.setHeader('Content-Type', 'text/xml');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
    res.status(200).send(sitemap);
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).json({ error: 'Error generating sitemap' });
  }
}

// Also create pages/sitemap.xml.js for static generation
export async function getServerSideProps({ res }) {
  const baseUrl = 'https://www.theavalanchehour.com';
  
  // Redirect to API route for dynamic generation
  res.writeHead(301, {
    Location: '/api/sitemap.xml'
  });
  res.end();

  return {
    props: {},
  };
}