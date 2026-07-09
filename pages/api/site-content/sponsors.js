import { groupSponsorsByTier, listSponsors } from '../../../lib/sponsorStore';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const result = await listSponsors({ allowStaticFallback: true });
    const activeSponsors = result.sponsors.filter((sponsor) => sponsor.active);
    return res.status(200).json({
      ok: true,
      sponsors: activeSponsors,
      tiers: groupSponsorsByTier(activeSponsors),
      source: result.source,
      configured: result.configured,
    });
  } catch (err) {
    console.error('public sponsors error:', err);
    return res.status(200).json({
      ok: true,
      sponsors: [],
      tiers: { legacy: [], partner: [], friends: [] },
      source: 'fallback',
      configured: false,
    });
  }
}
