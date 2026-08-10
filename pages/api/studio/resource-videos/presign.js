import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  createStudioResourceVideoUpload,
  isStudioResourceVideoStorageConfigured,
} from '../../../../lib/studioResourceVideoStorage';

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
  if (!isStudioResourceVideoStorageConfigured()) {
    return res.status(503).json({
      ok: false,
      error:
        'Protected resource-video storage is not configured in this environment.',
    });
  }

  try {
    const upload = createStudioResourceVideoUpload({
      uploaderId: principal.subject || principal.username,
      file: req.body?.file,
    });
    logAdminAction(req, principal, 'studio_resource_video.presign', {
      video_id: upload.video_id,
      content_type: upload.content_type,
      size: upload.size,
    });
    return res.status(200).json({ ok: true, upload });
  } catch (error) {
    return res.status(400).json({
      ok: false,
      error: error.message || 'Could not prepare the resource-video upload.',
    });
  }
}
