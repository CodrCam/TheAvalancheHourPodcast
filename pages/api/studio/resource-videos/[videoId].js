import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { getStudioGuide } from '../../../../lib/studioGuideStore';
import { validateStudioResourceVideoReference } from '../../../../lib/studioResourceVideoPolicy.mjs';
import { createStudioResourceVideoPlaybackUrl } from '../../../../lib/studioResourceVideoStorage';

function findPublishedVideo(guide, videoId) {
  for (const section of guide?.sections || []) {
    if (section.published === false) continue;
    const video = (section.videos || []).find(
      (candidate) => candidate.id === videoId && candidate.active === true
    );
    if (video) return validateStudioResourceVideoReference(video);
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const principal = await requirePermissionAsync(
    req,
    res,
    ADMIN_PERMISSIONS.RESOURCES_READ
  );
  if (!principal) return;

  try {
    const videoId = String(req.query.videoId || '').trim();
    const wantsDraft = req.query.draft === '1';
    const canPreviewDraft = principal.permissions.includes(
      ADMIN_PERMISSIONS.RESOURCES_UPDATE
    );
    const result = await getStudioGuide({
      forHosts: false,
      includeDraft: wantsDraft && canPreviewDraft,
    });
    const video = findPublishedVideo(result.guide, videoId);
    if (!video) {
      return res.status(404).json({
        ok: false,
        error: 'This resource video is not available.',
      });
    }
    const playbackUrl = createStudioResourceVideoPlaybackUrl(video);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    return res.redirect(302, playbackUrl);
  } catch (error) {
    console.error('studio resource video playback error:', error);
    return res.status(503).json({
      ok: false,
      error: 'The protected resource video could not be opened.',
    });
  }
}
