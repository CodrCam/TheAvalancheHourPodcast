import {
  PODCAST_ID,
  SITE_DESCRIPTION,
  SITE_IMAGE_URL,
  SITE_NAME,
  SITE_URL,
  absoluteUrl,
} from '../../lib/siteMetadata';

function resolveSiteUrl(req) {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  if (base) return base.startsWith('http') ? base : `https://${base}`;
  if (process.env.NODE_ENV === 'production') return SITE_URL;
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || (String(host).includes('localhost') ? 'http' : 'https');
  return String(host).startsWith('http') ? String(host) : `${proto}://${host}`;
}

function plainText(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function isoDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const siteUrl = resolveSiteUrl(req);

  try {
    const response = await fetch(`${siteUrl}/api/spotify`);
    const episodes = response.ok ? await response.json() : [];

    const feed = {
      version: 'https://jsonfeed.org/version/1.1',
      title: SITE_NAME,
      home_page_url: SITE_URL,
      feed_url: `${SITE_URL}/api/feed.json`,
      description: SITE_DESCRIPTION,
      icon: SITE_IMAGE_URL,
      favicon: `${SITE_URL}/favicon-48x48.png`,
      language: 'en-US',
      authors: [{ name: SITE_NAME, url: SITE_URL }],
      _schema_id: PODCAST_ID,
      items: (Array.isArray(episodes) ? episodes : []).slice(0, 50).map((episode) => {
        const spotifyUrl = episode.external_urls?.spotify;
        return {
          id: episode.id,
          url: spotifyUrl || absoluteUrl('/episodes'),
          external_url: spotifyUrl,
          title: episode.name,
          content_text: plainText(episode.description),
          summary: plainText(episode.description).slice(0, 280),
          date_published: isoDate(episode.release_date),
          image: episode.images?.[0]?.url || SITE_IMAGE_URL,
          duration_in_seconds: episode.duration_ms ? Math.round(episode.duration_ms / 1000) : undefined,
        };
      }),
    };

    res.setHeader('Content-Type', 'application/feed+json; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    res.status(200).json(feed);
  } catch (error) {
    res.status(500).json({ error: 'Error generating JSON feed', message: error.message });
  }
}
