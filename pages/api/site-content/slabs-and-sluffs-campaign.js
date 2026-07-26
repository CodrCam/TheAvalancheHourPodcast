import { listEpisodeStudios } from '../../../lib/episodeStudioStore';
import { buildSlabsAndSluffsCampaign } from '../../../lib/slabsAndSluffsCampaign.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  res.setHeader(
    'Cache-Control',
    'public, s-maxage=300, stale-while-revalidate=1800, stale-if-error=86400'
  );

  try {
    const result = await listEpisodeStudios();
    const campaign = buildSlabsAndSluffsCampaign({
      scheduledEpisodes: result.episodes || [],
    });
    return res.status(200).json({
      ok: true,
      campaign,
      configured: result.configured !== false,
    });
  } catch (error) {
    console.error('Slabs and Sluffs campaign lookup failed:', error);
    return res.status(200).json({
      ok: true,
      campaign: null,
      configured: false,
    });
  }
}
