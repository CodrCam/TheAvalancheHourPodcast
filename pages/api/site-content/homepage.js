import { DEFAULT_HOME_CONTENT } from '../../../lib/siteContentDefaults';
import { getHomeContent } from '../../../lib/siteContentStore';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const result = await getHomeContent({ allowDefault: true });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('homepage site content error:', err);
    return res.status(200).json({
      ok: true,
      content: DEFAULT_HOME_CONTENT,
      updated_at: '',
      source: 'default',
      configured: false,
    });
  }
}
