import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PRODUCT_IMAGE_BYTES,
  createProductImageUpload,
  parseProductImageObjectKey,
  validateProductImageDelivery,
  verifyProductImageUploadToken,
} from '../lib/productImageStorage.js';

process.env.PRODUCT_IMAGES_S3_BUCKET = 'product-images';
process.env.PRODUCT_IMAGES_S3_REGION = 'us-east-2';
process.env.PRODUCT_IMAGES_ACCESS_KEY_ID = 'AKIATESTONLY';
process.env.PRODUCT_IMAGES_SECRET_ACCESS_KEY = 'test-secret';
process.env.PRODUCT_IMAGES_UPLOAD_TOKEN_SECRET = 'test-token-secret';

test('creates a bounded S3 form upload tied to one product and image type', () => {
  const upload = createProductImageUpload({
    productId: 'product-field-shirt',
    uploaderId: 'logistics-user',
    file: {
      file_name: 'field-shirt.png',
      content_type: 'image/png',
      size: 2048,
    },
  });
  const policy = JSON.parse(
    Buffer.from(upload.upload_fields.policy, 'base64').toString('utf8')
  );

  assert.equal(upload.upload_method, 'POST');
  assert.equal(
    upload.upload_url,
    'https://product-images.s3.us-east-2.amazonaws.com'
  );
  assert.equal(upload.upload_fields.key, upload.object_key);
  assert.equal(upload.upload_fields['Content-Type'], 'image/png');
  assert.deepEqual(
    policy.conditions.find(
      (condition) => Array.isArray(condition) && condition[0] === 'content-length-range'
    ),
    ['content-length-range', 1, MAX_PRODUCT_IMAGE_BYTES]
  );
  assert.deepEqual(
    policy.conditions.find((condition) => condition['Content-Type']),
    { 'Content-Type': 'image/png' }
  );

  const verified = verifyProductImageUploadToken(
    upload.upload_token,
    'product-field-shirt'
  );
  assert.equal(verified.object_key, upload.object_key);
  assert.equal(verified.size, 2048);
});

test('rejects tampered upload authorization and cross-product completion', () => {
  const upload = createProductImageUpload({
    productId: 'product-field-shirt',
    uploaderId: 'logistics-user',
    file: {
      file_name: 'field-shirt.webp',
      content_type: 'image/webp',
      size: 4096,
    },
  });

  assert.throws(
    () =>
      verifyProductImageUploadToken(
        `${upload.upload_token}tampered`,
        'product-field-shirt'
      ),
    /authorization is invalid/i
  );
  assert.throws(
    () => verifyProductImageUploadToken(upload.upload_token, 'another-product'),
    /authorization has expired/i
  );
});

test('allows delivery only for bounded raster images with safe product keys', () => {
  assert.deepEqual(
    parseProductImageObjectKey(
      'products/product-field-shirt/image-123-field-shirt.png'
    ),
    {
      objectKey: 'products/product-field-shirt/image-123-field-shirt.png',
      productId: 'product-field-shirt',
    }
  );
  assert.deepEqual(
    validateProductImageDelivery({
      contentType: 'image/PNG',
      size: 4096,
    }),
    { contentType: 'image/png', size: 4096 }
  );
  assert.throws(
    () =>
      parseProductImageObjectKey(
        'products/product-field-shirt/../untrusted.html'
      ),
    /key is invalid/i
  );
  assert.throws(
    () =>
      validateProductImageDelivery({
        contentType: 'text/html',
        size: 4096,
      }),
    /not an allowed image type/i
  );
  assert.throws(
    () =>
      validateProductImageDelivery({
        contentType: 'image/png',
        size: MAX_PRODUCT_IMAGE_BYTES + 1,
      }),
    /delivery limit/i
  );
});
