import { escapeHtml } from '../../lib/escapeHtml';
import {
  SITE_DESCRIPTION,
  SITE_EMAIL,
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

function rfcDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toUTCString() : date.toUTCString();
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).send('Method not allowed');
  }

  const siteUrl = resolveSiteUrl(req);

  try {
    const response = await fetch(`${siteUrl}/api/spotify`);
    const episodes = response.ok ? await response.json() : [];

    const items = (Array.isArray(episodes) ? episodes : []).slice(0, 50).map((episode) => {
      const spotifyUrl = episode.external_urls?.spotify;
      const linkUrl = spotifyUrl || absoluteUrl('/episodes');
      const guid = spotifyUrl || episode.id || linkUrl;
      const description = plainText(episode.description);

      return `
    <item>
      <title>${escapeHtml(episode.name)}</title>
      <link>${escapeHtml(linkUrl)}</link>
      <guid isPermaLink="${spotifyUrl ? 'true' : 'false'}">${escapeHtml(guid)}</guid>
      <description>${escapeHtml(description)}</description>
      <pubDate>${rfcDate(episode.release_date)}</pubDate>
      ${episode.duration_ms ? `<itunes:duration>${Math.round(episode.duration_ms / 1000)}</itunes:duration>` : ''}
      ${episode.images?.[0]?.url ? `<itunes:image href="${escapeHtml(episode.images[0].url)}" />` : ''}
    </item>`;
    }).join('');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>${escapeHtml(SITE_NAME)}</title>
    <link>${escapeHtml(SITE_URL)}</link>
    <description>${escapeHtml(SITE_DESCRIPTION)}</description>
    <language>en-us</language>
    <managingEditor>${escapeHtml(SITE_EMAIL)} (${escapeHtml(SITE_NAME)})</managingEditor>
    <webMaster>${escapeHtml(SITE_EMAIL)} (${escapeHtml(SITE_NAME)})</webMaster>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <image>
      <url>${escapeHtml(SITE_IMAGE_URL)}</url>
      <title>${escapeHtml(SITE_NAME)}</title>
      <link>${escapeHtml(SITE_URL)}</link>
    </image>
    <itunes:author>${escapeHtml(SITE_NAME)}</itunes:author>
    <itunes:summary>${escapeHtml(SITE_DESCRIPTION)}</itunes:summary>
    <itunes:image href="${escapeHtml(SITE_IMAGE_URL)}" />
${items}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml; charset=UTF-8');
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    res.status(200).send(rss);
  } catch (error) {
    res.status(500).send(`Error generating RSS feed: ${escapeHtml(error.message)}`);
  }
}
