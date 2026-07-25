import crypto from 'crypto';

const UPLOAD_EXPIRY_SECONDS = 15 * 60;
const DOWNLOAD_EXPIRY_SECONDS = 10 * 60;

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

function sha256(value, encoding = 'hex') {
  return crypto.createHash('sha256').update(value, 'utf8').digest(encoding);
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function signingKey(secretKey, dateStamp, region, service = 's3') {
  const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, 'aws4_request');
}

function amzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function storageConfig() {
  return {
    bucket: readEnv('EPISODE_ASSETS_S3_BUCKET'),
    region:
      readEnv('EPISODE_ASSETS_S3_REGION') ||
      readEnv('AWS_REGION') ||
      'us-east-2',
    accessKeyId: readEnv('EPISODE_ASSETS_ACCESS_KEY_ID'),
    secretAccessKey: readEnv('EPISODE_ASSETS_SECRET_ACCESS_KEY'),
    sessionToken: readEnv('EPISODE_ASSETS_SESSION_TOKEN'),
    tokenSecret:
      readEnv('EPISODE_ASSETS_UPLOAD_TOKEN_SECRET') ||
      readEnv('EPISODE_ASSETS_SECRET_ACCESS_KEY'),
  };
}

export function isEpisodeAssetStorageConfigured() {
  const config = storageConfig();
  return Boolean(
    config.bucket &&
      config.region &&
      config.accessKeyId &&
      config.secretAccessKey &&
      config.tokenSecret
  );
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
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
}

function presignedS3Url(method, objectKey, expiresSeconds) {
  const config = storageConfig();
  if (!isEpisodeAssetStorageConfigured()) {
    throw new Error('Episode asset storage is not configured.');
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
    signingKey(
      config.secretAccessKey,
      dateStamp,
      config.region
    ),
    stringToSign,
    'hex'
  );
  return `https://${host}${encodePath(objectKey)}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function safeFileName(value = '') {
  const fileName = String(value || '')
    .normalize('NFKC')
    .replace(/[^\w.\- ()]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 160);
  return fileName || 'episode-asset';
}

function safeId(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

export const EPISODE_ASSET_CATEGORIES = [
  'recording',
  'image',
  'document',
  'sponsor_audio',
  'other',
];

export function validateEpisodeAssetInput(value = {}) {
  const fileName = safeFileName(value.file_name);
  const contentType = String(value.content_type || '')
    .trim()
    .toLowerCase()
    .slice(0, 160);
  const size = Math.trunc(Number(value.size) || 0);
  const category = EPISODE_ASSET_CATEGORIES.includes(value.category)
    ? value.category
    : 'other';
  const allowed =
    contentType.startsWith('audio/') ||
    contentType.startsWith('image/') ||
    [
      'application/pdf',
      'text/plain',
      'text/markdown',
      'application/json',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ].includes(contentType);
  const maxSize =
    category === 'image'
      ? 30 * 1024 * 1024
      : category === 'document'
        ? 75 * 1024 * 1024
        : 750 * 1024 * 1024;
  if (!allowed) {
    throw new Error('Episode asset: this file type is not supported.');
  }
  if (!size || size > maxSize) {
    throw new Error(
      `Episode asset: this ${category} file exceeds the upload limit.`
    );
  }
  if (
    ['recording', 'sponsor_audio'].includes(category) &&
    !contentType.startsWith('audio/')
  ) {
    throw new Error('Episode asset: choose an audio file for this category.');
  }
  if (category === 'image' && !contentType.startsWith('image/')) {
    throw new Error('Episode asset: choose an image file for this category.');
  }
  return { file_name: fileName, content_type: contentType, size, category };
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

export function verifyEpisodeAssetUploadToken(token, episodeId) {
  const config = storageConfig();
  const [encoded, providedSignature] = String(token || '').split('.');
  if (!encoded || !providedSignature || !config.tokenSecret) {
    throw new Error('Episode asset: upload authorization is invalid.');
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
    throw new Error('Episode asset: upload authorization is invalid.');
  }
  let payload;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8')
    );
  } catch {
    throw new Error('Episode asset: upload authorization is invalid.');
  }
  if (
    payload.episode_id !== safeId(episodeId) ||
    Number(payload.expires_at) < Date.now()
  ) {
    throw new Error('Episode asset: upload authorization has expired.');
  }
  return payload;
}

export function createEpisodeAssetUpload({
  episodeId,
  uploaderPersonId,
  file,
}) {
  const input = validateEpisodeAssetInput(file);
  const assetId = `asset-${crypto.randomUUID()}`;
  const objectKey = [
    'episodes',
    safeId(episodeId),
    input.category,
    `${assetId}-${input.file_name}`,
  ].join('/');
  const expiresAt = Date.now() + UPLOAD_EXPIRY_SECONDS * 1000;
  return {
    asset_id: assetId,
    object_key: objectKey,
    upload_url: presignedS3Url('PUT', objectKey, UPLOAD_EXPIRY_SECONDS),
    expires_at: new Date(expiresAt).toISOString(),
    upload_token: signUploadToken({
      episode_id: safeId(episodeId),
      uploader_person_id: safeId(uploaderPersonId),
      asset_id: assetId,
      object_key: objectKey,
      ...input,
      expires_at: expiresAt,
    }),
    ...input,
  };
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

export async function verifyEpisodeAssetObject(payload) {
  const response = await signedHead(payload.object_key);
  if (!response.ok) {
    throw new Error('Episode asset: the uploaded object could not be verified.');
  }
  const size = Number(response.headers.get('content-length') || 0);
  const contentType = String(
    response.headers.get('content-type') || ''
  ).toLowerCase();
  if (size !== payload.size || contentType !== payload.content_type) {
    throw new Error(
      'Episode asset: the uploaded file does not match its authorization.'
    );
  }
  return { size, content_type: contentType };
}

export function createEpisodeAssetDownloadUrl(objectKey) {
  return presignedS3Url('GET', objectKey, DOWNLOAD_EXPIRY_SECONDS);
}
