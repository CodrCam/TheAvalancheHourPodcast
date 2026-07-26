import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../../lib/adminAuth';
import { logAdminAction } from '../../../../../lib/adminAudit';
import {
  createProductImageUpload,
  isProductImageStorageConfigured,
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
  if (!isProductImageStorageConfigured()) {
    return res.status(503).json({
      ok: false,
      error: 'Product image storage is not configured.',
    });
  }

  try {
    const upload = createProductImageUpload({
      productId: req.body?.product_id,
      uploaderId: principal.subject || principal.username,
      file: req.body?.file,
    });
    logAdminAction(req, principal, 'product_media.presign', {
      product_id: req.body?.product_id,
      asset_id: upload.asset_id,
      content_type: upload.content_type,
      size: upload.size,
    });
    return res.status(200).json({ ok: true, upload });
  } catch (err) {
    return res.status(400).json({
      ok: false,
      error: err.message || 'Could not prepare the product image upload.',
    });
  }
}
