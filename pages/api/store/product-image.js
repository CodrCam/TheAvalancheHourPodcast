import {
  createProductImageDownloadUrl,
  isProductImageStorageConfigured,
  parseProductImageObjectKey,
  validateProductImageDelivery,
} from '../../../lib/productImageStorage';
import { getCatalogProductById } from '../../../lib/productCatalogStore';

export const config = { api: { responseLimit: '12mb' } };

function productLinksImage(product, objectKey) {
  return (product?.media || []).some(
    (item) => item?.source === 's3' && item?.objectKey === objectKey
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  if (!isProductImageStorageConfigured()) {
    return res.status(503).end();
  }

  try {
    const { objectKey, productId } = parseProductImageObjectKey(
      req.query?.key
    );
    const product = await getCatalogProductById(productId);
    if (!productLinksImage(product, objectKey)) {
      return res.status(404).end();
    }

    const response = await fetch(createProductImageDownloadUrl(objectKey));
    if (!response.ok) return res.status(response.status).end();

    const delivery = validateProductImageDelivery({
      contentType: response.headers.get('content-type'),
      size: Number(response.headers.get('content-length') || 0),
    });
    if (!response.body) return res.status(502).end();

    res.setHeader('Content-Type', delivery.contentType);
    res.setHeader('Content-Length', String(delivery.size));
    res.setHeader('Content-Disposition', 'inline; filename="product-image"');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Cache-Control',
      'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800'
    );
    res.status(200);

    let bytesSent = 0;
    for await (const chunk of response.body) {
      bytesSent += chunk.byteLength;
      if (bytesSent > delivery.size) {
        throw new Error('Product image response exceeded its declared size.');
      }
      res.write(Buffer.from(chunk));
    }
    if (bytesSent !== delivery.size) {
      throw new Error('Product image response was incomplete.');
    }
    return res.end();
  } catch (err) {
    console.error('product image proxy error:', err);
    if (res.headersSent) {
      res.destroy(err);
      return;
    }
    return res.status(404).end();
  }
}
