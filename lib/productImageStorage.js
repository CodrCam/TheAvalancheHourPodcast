import crypto from 'crypto';

const UPLOAD_EXPIRY_SECONDS = 15 * 60;
const DOWNLOAD_EXPIRY_SECONDS = 10 * 60;
export const MAX_PRODUCT_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

function storageConfig() {
  return {
    bucket:
      readEnv('PRODUCT_IMAGES_S3_BUCKET') ||
      readEnv('EPISODE_ASSETS_S3_BUCKET'),
    region:
      readEnv('PRODUCT_IMAGES_S3_REGION') ||
      readEnv('EPISODE_ASSETS_S3_REGION') ||
      readEnv('AWS_REGION') ||
      'us-east-2',
    accessKeyId:
      readEnv('PRODUCT_IMAGES_ACCESS_KEY_ID') ||
      readEnv('EPISODE_ASSETS_ACCESS_KEY_ID'),
    secretAccessKey:
      readEnv('PRODUCT_IMAGES_SECRET_ACCESS_KEY') ||
      readEnv('EPISODE_ASSETS_SECRET_ACCESS_KEY'),
    sessionToken:
      readEnv('PRODUCT_IMAGES_SESSION_TOKEN') ||
      readEnv('EPISODE_ASSETS_SESSION_TOKEN'),
    tokenSecret:
      readEnv('PRODUCT_IMAGES_UPLOAD_TOKEN_SECRET') ||
      readEnv('EPISODE_ASSETS_UPLOAD_TOKEN_SECRET') ||
      readEnv('PRODUCT_IMAGES_SECRET_ACCESS_KEY') ||
      readEnv('EPISODE_ASSETS_SECRET_ACCESS_KEY'),
  };
}

export function isProductImageStorageConfigured() {
  const config = storageConfig();
  return Boolean(
    config.bucket &&
      config.region &&
      config.accessKeyId &&
      config.secretAccessKey &&
      config.tokenSecret
  );
}

function sha256(value, encoding = 'hex') {
  return crypto.createHash('sha256').update(value, 'utf8').digest(encoding);
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function signingKey(secretKey, dateStamp, region) {
  const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, 's3');
  return hmac(serviceKey, 'aws4_request');
}

function amzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function encodePath(value) {
  return `/${String(value || '')
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

function encodeQuery(entries) {
  return entries
    .map(([name, value]) => [
      encodeURIComponent(name),
      encodeURIComponent(value),
    ])
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
}

function presignedS3Url(method, objectKey, expiresSeconds) {
  const config = storageConfig();
  if (!isProductImageStorageConfigured()) {
    throw new Error('Product image storage is not configured.');
  }
  const now = new Date();
  const requestDate = amzDate(now);
  const dateStamp = requestDate.slice(0, 8);
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const query = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${config.accessKeyId}/${scope}`],
    ['X-Amz-Date', requestDate],
    ['X-Amz-Expires', String(expiresSeconds)],
    ['X-Amz-SignedHeaders', 'host'],
    ...(config.sessionToken
      ? [['X-Amz-Security-Token', config.sessionToken]]
      : []),
  ];
  const canonicalQuery = encodeQuery(query);
  const canonicalRequest = [
    method,
    encodePath(objectKey),
    canonicalQuery,
    `host:${host}\n`,
    'host',
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    requestDate,
    scope,
    sha256(canonicalRequest),
  ].join('\n');
  const signature = hmac(
    signingKey(config.secretAccessKey, dateStamp, config.region),
    stringToSign,
    'hex'
  );
  return `https://${host}${encodePath(objectKey)}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function presignedS3Post(objectKey, contentType, expiresSeconds) {
  const config = storageConfig();
  if (!isProductImageStorageConfigured()) {
    throw new Error('Product image storage is not configured.');
  }
  const now = new Date();
  const requestDate = amzDate(now);
  const dateStamp = requestDate.slice(0, 8);
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const credential = `${config.accessKeyId}/${scope}`;
  const fields = {
    key: objectKey,
    'Content-Type': contentType,
    'x-amz-algorithm': 'AWS4-HMAC-SHA256',
    'x-amz-credential': credential,
    'x-amz-date': requestDate,
    ...(config.sessionToken
      ? { 'x-amz-security-token': config.sessionToken }
      : {}),
  };
  const policy = Buffer.from(
    JSON.stringify({
      expiration: new Date(
        now.getTime() + expiresSeconds * 1000
      ).toISOString(),
      conditions: [
        { bucket: config.bucket },
        { key: objectKey },
        { 'Content-Type': contentType },
        ['content-length-range', 1, MAX_PRODUCT_IMAGE_BYTES],
        { 'x-amz-algorithm': fields['x-amz-algorithm'] },
        { 'x-amz-credential': credential },
        { 'x-amz-date': requestDate },
        ...(config.sessionToken
          ? [{ 'x-amz-security-token': config.sessionToken }]
          : []),
      ],
    }),
    'utf8'
  ).toString('base64');
  fields.policy = policy;
  fields['x-amz-signature'] = hmac(
    signingKey(config.secretAccessKey, dateStamp, config.region),
    policy,
    'hex'
  );
  return {
    url: `https://${config.bucket}.s3.${config.region}.amazonaws.com`,
    fields,
  };
}

function safeId(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function safeFileName(value = '') {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[^\w.\- ()]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 160) || 'product-image';
}

function validateImageFile(file = {}) {
  const fileName = safeFileName(file.file_name);
  const contentType = String(file.content_type || '').trim().toLowerCase();
  const size = Math.trunc(Number(file.size) || 0);
  if (!ALLOWED_IMAGE_TYPES.has(contentType)) {
    throw new Error('Use a JPG, PNG, WebP, or AVIF product image.');
  }
  if (!size || size > MAX_PRODUCT_IMAGE_BYTES) {
    throw new Error('Product images must be 12 MB or smaller.');
  }
  return { file_name: fileName, content_type: contentType, size };
}

function signUploadToken(payload) {
  const config = storageConfig();
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );
  const signature = crypto
    .createHmac('sha256', config.tokenSecret)
    .update(encoded, 'utf8')
    .digest('base64url');
  return `${encoded}.${signature}`;
}

export function createProductImageUpload({ productId, uploaderId, file }) {
  if (!isProductImageStorageConfigured()) {
    throw new Error('Product image storage is not configured.');
  }
  const input = validateImageFile(file);
  const cleanProductId = safeId(productId);
  if (!cleanProductId) throw new Error('Save a product name before uploading.');
  const assetId = `image-${crypto.randomUUID()}`;
  const objectKey = [
    'products',
    cleanProductId,
    `${assetId}-${input.file_name}`,
  ].join('/');
  const expiresAt = Date.now() + UPLOAD_EXPIRY_SECONDS * 1000;
  const upload = presignedS3Post(
    objectKey,
    input.content_type,
    UPLOAD_EXPIRY_SECONDS
  );
  return {
    asset_id: assetId,
    object_key: objectKey,
    upload_url: upload.url,
    upload_method: 'POST',
    upload_fields: upload.fields,
    upload_token: signUploadToken({
      product_id: cleanProductId,
      uploader_id: safeId(uploaderId),
      asset_id: assetId,
      object_key: objectKey,
      ...input,
      expires_at: expiresAt,
    }),
    expires_at: new Date(expiresAt).toISOString(),
    ...input,
  };
}

export function verifyProductImageUploadToken(token, productId) {
  const config = storageConfig();
  const [encoded, providedSignature] = String(token || '').split('.');
  if (!encoded || !providedSignature || !config.tokenSecret) {
    throw new Error('Product image upload authorization is invalid.');
  }
  const expectedSignature = crypto
    .createHmac('sha256', config.tokenSecret)
    .update(encoded, 'utf8')
    .digest('base64url');
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (
    provided.length !== expected.length ||
    !crypto.timingSafeEqual(provided, expected)
  ) {
    throw new Error('Product image upload authorization is invalid.');
  }
  let payload;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    );
  } catch {
    throw new Error('Product image upload authorization is invalid.');
  }
  if (
    payload.product_id !== safeId(productId) ||
    !String(payload.object_key || '').startsWith(
      `products/${safeId(productId)}/`
    ) ||
    Number(payload.expires_at) < Date.now()
  ) {
    throw new Error('Product image upload authorization has expired.');
  }
  return payload;
}

async function signedHead(objectKey) {
  const config = storageConfig();
  const now = new Date();
  const requestDate = amzDate(now);
  const dateStamp = requestDate.slice(0, 8);
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const headers = {
    host,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-amz-date': requestDate,
    ...(config.sessionToken
      ? { 'x-amz-security-token': config.sessionToken }
      : {}),
  };
  const headerNames = Object.keys(headers).sort();
  const canonicalHeaders = headerNames
    .map((name) => `${name}:${headers[name]}\n`)
    .join('');
  const signedHeaders = headerNames.join(';');
  const canonicalRequest = [
    'HEAD',
    encodePath(objectKey),
    '',
    canonicalHeaders,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n');
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    requestDate,
    scope,
    sha256(canonicalRequest),
  ].join('\n');
  const signature = hmac(
    signingKey(config.secretAccessKey, dateStamp, config.region),
    stringToSign,
    'hex'
  );
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');
  return fetch(`https://${host}${encodePath(objectKey)}`, {
    method: 'HEAD',
    headers: { ...headers, Authorization: authorization },
  });
}

export async function verifyProductImageObject(payload) {
  const response = await signedHead(payload.object_key);
  if (!response.ok) {
    throw new Error('The uploaded product image could not be verified.');
  }
  const size = Number(response.headers.get('content-length') || 0);
  const contentType = String(
    response.headers.get('content-type') || ''
  ).toLowerCase();
  if (size !== payload.size || contentType !== payload.content_type) {
    throw new Error('The uploaded product image does not match its upload.');
  }
  return { size, content_type: contentType };
}

export function parseProductImageObjectKey(objectKey) {
  const cleanKey = String(objectKey || '').trim();
  const parts = cleanKey.split('/');
  const productId = safeId(parts[1]);
  if (
    parts.length < 3 ||
    parts[0] !== 'products' ||
    !productId ||
    parts[1] !== productId ||
    parts.slice(2).some((part) => !part || part === '.' || part === '..')
  ) {
    throw new Error('Product image key is invalid.');
  }
  return { objectKey: cleanKey, productId };
}

export function validateProductImageDelivery({ contentType, size } = {}) {
  const normalizedType = String(contentType || '').trim().toLowerCase();
  const normalizedSize = Number(size);
  if (!ALLOWED_IMAGE_TYPES.has(normalizedType)) {
    throw new Error('Stored product media is not an allowed image type.');
  }
  if (
    !Number.isSafeInteger(normalizedSize) ||
    normalizedSize <= 0 ||
    normalizedSize > MAX_PRODUCT_IMAGE_BYTES
  ) {
    throw new Error('Stored product media exceeds the image delivery limit.');
  }
  return { contentType: normalizedType, size: normalizedSize };
}

export function createProductImageDownloadUrl(objectKey) {
  const { objectKey: cleanKey } = parseProductImageObjectKey(objectKey);
  return presignedS3Url('GET', cleanKey, DOWNLOAD_EXPIRY_SECONDS);
}
