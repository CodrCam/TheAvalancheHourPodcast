import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../../lib/adminAuth';
import { logAdminAction } from '../../../../../lib/adminAudit';
import {
  createProductImageDownloadUrl,
  verifyProductImageObject,
  verifyProductImageUploadToken,
} from '../../../../../lib/productImageStorage';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const principal = await requirePermissionAsync(
    req,
    res,
    ADMIN_PERMISSIONS.PRODUCT_MEDIA_UPDATE
  );
  if (!principal) return;

  try {
    const payload = verifyProductImageUploadToken(
      req.body?.upload_token,
      req.body?.product_id
    );
    await verifyProductImageObject(payload);
    const media = {
      assetId: payload.asset_id,
      source: 's3',
      objectKey: payload.object_key,
      url: `/api/store/product-image?key=${encodeURIComponent(
        payload.object_key
      )}`,
      previewUrl: createProductImageDownloadUrl(payload.object_key),
      altText: String(req.body?.alt_text || '').trim().slice(0, 240),
      role: 'gallery',
      sortOrder: 0,
    };
    logAdminAction(req, principal, 'product_media.complete', {
      product_id: req.body?.product_id,
      asset_id: payload.asset_id,
      object_key: payload.object_key,
    });
    return res.status(200).json({ ok: true, media });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: err.message || 'Could not verify the product image.',
    });
  }
}
