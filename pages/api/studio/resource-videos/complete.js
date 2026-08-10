import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  verifyStudioResourceVideoObject,
  verifyStudioResourceVideoUploadToken,
} from '../../../../lib/studioResourceVideoStorage';

function defaultTitle(fileName = '') {
  return String(fileName || '')
    .replace(/\.mp4$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!req.headers['content-type']?.includes('application/json')) {
    return res
      .status(400)
      .json({ ok: false, error: 'Content-Type must be application/json' });
  }
  const principal = await requirePermissionAsync(
    req,
    res,
    ADMIN_PERMISSIONS.RESOURCES_UPDATE
  );
  if (!principal) return;

  try {
    const payload = verifyStudioResourceVideoUploadToken(
      req.body?.upload_token
    );
    const verified = await verifyStudioResourceVideoObject(payload);
    const video = {
      id: payload.video_id,
      title: defaultTitle(payload.file_name) || 'Resource video',
      description: '',
      file_name: payload.file_name,
      object_key: payload.object_key,
      object_version_id: verified.object_version_id,
      content_type: verified.content_type,
      size: verified.size,
      active: true,
    };
    logAdminAction(req, principal, 'studio_resource_video.complete', {
      video_id: video.id,
      object_key: video.object_key,
      size: video.size,
    });
    return res.status(200).json({ ok: true, video });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || 'Could not verify the resource-video upload.',
    });
  }
}
