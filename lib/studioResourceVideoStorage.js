import crypto from 'crypto';
import {
  isStudioResourceVideoObjectKey,
  validateStudioResourceVideoFile,
  validateStudioResourceVideoReference,
} from './studioResourceVideoPolicy.mjs';

const UPLOAD_EXPIRY_SECONDS = 60 * 60;
const COMPLETION_EXPIRY_SECONDS = 24 * 60 * 60;
const PLAYBACK_EXPIRY_SECONDS = 4 * 60 * 60;
const TOKEN_VERSION = 1;
const TOKEN_PURPOSE = 'studio_resource_video_upload';

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

function storageConfig() {
  return {
    bucket:
      readEnv('STUDIO_RESOURCE_VIDEOS_S3_BUCKET') ||
      readEnv('EPISODE_ASSETS_S3_BUCKET'),
    region:
      readEnv('STUDIO_RESOURCE_VIDEOS_S3_REGION') ||
      readEnv('EPISODE_ASSETS_S3_REGION') ||
      readEnv('AWS_REGION') ||
      'us-east-2',
    accessKeyId:
      readEnv('STUDIO_RESOURCE_VIDEOS_ACCESS_KEY_ID') ||
      readEnv('EPISODE_ASSETS_ACCESS_KEY_ID'),
    secretAccessKey:
      readEnv('STUDIO_RESOURCE_VIDEOS_SECRET_ACCESS_KEY') ||
      readEnv('EPISODE_ASSETS_SECRET_ACCESS_KEY'),
    sessionToken:
      readEnv('STUDIO_RESOURCE_VIDEOS_SESSION_TOKEN') ||
      readEnv('EPISODE_ASSETS_SESSION_TOKEN'),
    tokenSecret:
      readEnv('STUDIO_RESOURCE_VIDEOS_UPLOAD_TOKEN_SECRET') ||
      readEnv('EPISODE_ASSETS_UPLOAD_TOKEN_SECRET') ||
      readEnv('STUDIO_RESOURCE_VIDEOS_SECRET_ACCESS_KEY') ||
      readEnv('EPISODE_ASSETS_SECRET_ACCESS_KEY'),
  };
}

export function isStudioResourceVideoStorageConfigured() {
  const config = storageConfig();
  return Boolean(
    config.bucket &&
      config.region &&
      config.accessKeyId &&
      config.secretAccessKey &&
      config.tokenSecret
  );
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
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

function awsEncodeURIComponent(value) {
  return encodeURIComponent(String(value || '')).replace(
    /[!'()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function encodePath(value) {
  return `/${String(value || '')
    .split('/')
    .map((part) => awsEncodeURIComponent(part))
    .join('/')}`;
}

function encodeQuery(entries) {
  return entries
    .map(([name, value]) => [
      awsEncodeURIComponent(name),
      awsEncodeURIComponent(value),
    ])
    .sort(([leftName, leftValue], [rightName, rightValue]) => {
      if (leftName !== rightName) return leftName < rightName ? -1 : 1;
      if (leftValue === rightValue) return 0;
      return leftValue < rightValue ? -1 : 1;
    })
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
}

function presignedS3Url(method, objectKey, expiresSeconds, additionalQuery = []) {
  const config = storageConfig();
  if (!isStudioResourceVideoStorageConfigured()) {
    throw new Error('Resource video storage is not configured.');
  }
  const requestDate = amzDate(new Date());
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
    ...additionalQuery,
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

function presignedS3Put(objectKey, contentType, size) {
  const config = storageConfig();
  if (!isStudioResourceVideoStorageConfigured()) {
    throw new Error('Resource video storage is not configured.');
  }
  const requestDate = amzDate(new Date());
  const dateStamp = requestDate.slice(0, 8);
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const signedHeaders = 'content-length;content-type;host;if-none-match';
  const query = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${config.accessKeyId}/${scope}`],
    ['X-Amz-Date', requestDate],
    ['X-Amz-Expires', String(UPLOAD_EXPIRY_SECONDS)],
    ['X-Amz-SignedHeaders', signedHeaders],
    ...(config.sessionToken
      ? [['X-Amz-Security-Token', config.sessionToken]]
      : []),
  ];
  const canonicalQuery = encodeQuery(query);
  const canonicalRequest = [
    'PUT',
    encodePath(objectKey),
    canonicalQuery,
    `content-length:${size}\ncontent-type:${contentType}\nhost:${host}\nif-none-match:*\n`,
    signedHeaders,
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
  return {
    url: `https://${host}${encodePath(objectKey)}?${canonicalQuery}&X-Amz-Signature=${signature}`,
    headers: {
      'Content-Type': contentType,
      'If-None-Match': '*',
    },
  };
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

export function createStudioResourceVideoUpload({ uploaderId, file }) {
  if (!isStudioResourceVideoStorageConfigured()) {
    throw new Error('Resource video storage is not configured.');
  }
  const input = validateStudioResourceVideoFile(file);
  const videoId = `resource-video-${crypto.randomUUID()}`;
  const objectKey = `studio-resources/videos/${videoId}-${input.file_name}`;
  const completionExpiresAt = Date.now() + COMPLETION_EXPIRY_SECONDS * 1000;
  const upload = presignedS3Put(
    objectKey,
    input.content_type,
    input.size
  );

  return {
    video_id: videoId,
    object_key: objectKey,
    upload_url: upload.url,
    upload_method: 'PUT',
    upload_headers: upload.headers,
    upload_token: signUploadToken({
      version: TOKEN_VERSION,
      purpose: TOKEN_PURPOSE,
      video_id: videoId,
      uploader_id: String(uploaderId || '').trim().slice(0, 200),
      object_key: objectKey,
      ...input,
      expires_at: completionExpiresAt,
    }),
    expires_at: new Date(Date.now() + UPLOAD_EXPIRY_SECONDS * 1000).toISOString(),
    completion_expires_at: new Date(completionExpiresAt).toISOString(),
    ...input,
  };
}

export function verifyStudioResourceVideoUploadToken(token) {
  const config = storageConfig();
  const parts = String(token || '').split('.');
  const [encoded, providedSignature] = parts;
  if (
    parts.length !== 2 ||
    !encoded ||
    !providedSignature ||
    !config.tokenSecret
  ) {
    throw new Error('Resource video: upload authorization is invalid.');
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
    throw new Error('Resource video: upload authorization is invalid.');
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Resource video: upload authorization is invalid.');
  }
  const input = validateStudioResourceVideoFile(payload);
  if (
    payload.version !== TOKEN_VERSION ||
    payload.purpose !== TOKEN_PURPOSE ||
    Number(payload.expires_at) <= Date.now() ||
    !isStudioResourceVideoObjectKey(payload.object_key, payload.video_id)
  ) {
    throw new Error('Resource video: upload authorization is invalid or expired.');
  }
  const expectedObjectKey =
    `studio-resources/videos/${payload.video_id}-${input.file_name}`;
  if (payload.object_key !== expectedObjectKey) {
    throw new Error('Resource video: upload authorization is invalid.');
  }
  return { ...payload, ...input, object_key: expectedObjectKey };
}

async function signedS3Request(method, objectKey, additionalQuery = [], options = {}) {
  const config = storageConfig();
  if (!isStudioResourceVideoStorageConfigured()) {
    throw new Error('Resource video storage is not configured.');
  }
  const requestDate = amzDate(new Date());
  const dateStamp = requestDate.slice(0, 8);
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const headers = {
    host,
    'x-amz-content-sha256': 'UNSIGNED-PAYLOAD',
    'x-amz-date': requestDate,
    ...(options.headers || {}),
    ...(config.sessionToken
      ? { 'x-amz-security-token': config.sessionToken }
      : {}),
  };
  const headerNames = Object.keys(headers).sort();
  const canonicalHeaders = headerNames
    .map((name) => `${name}:${headers[name]}\n`)
    .join('');
  const signedHeaders = headerNames.join(';');
  const canonicalQuery = encodeQuery(additionalQuery);
  const canonicalRequest = [
    method,
    encodePath(objectKey),
    canonicalQuery,
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
  return fetch(
    `https://${host}${encodePath(objectKey)}${canonicalQuery ? `?${canonicalQuery}` : ''}`,
    { method, headers: { ...headers, Authorization: authorization } }
  );
}

export async function verifyStudioResourceVideoObject(payload) {
  const response = await signedS3Request('HEAD', payload.object_key);
  if (!response.ok) {
    throw new Error('Resource video: the uploaded object could not be verified.');
  }
  const size = Number(response.headers.get('content-length') || 0);
  const contentType = String(response.headers.get('content-type') || '')
    .trim()
    .toLowerCase();
  if (size !== payload.size || contentType !== payload.content_type) {
    throw new Error(
      'Resource video: the uploaded file does not match its authorization.'
    );
  }
  const versionId = String(response.headers.get('x-amz-version-id') || '').trim();
  if (!versionId || versionId === 'null') {
    throw new Error(
      'Resource video: object storage versioning is required before this upload can be published.'
    );
  }

  const signatureResponse = await signedS3Request(
    'GET',
    payload.object_key,
    [['versionId', versionId]],
    { headers: { range: 'bytes=0-63' } }
  );
  if (!signatureResponse.ok) {
    throw new Error('Resource video: the MP4 signature could not be verified.');
  }
  const bytes = Buffer.from(await signatureResponse.arrayBuffer());
  if (bytes.length < 12 || bytes.toString('latin1', 4, 8) !== 'ftyp') {
    throw new Error(
      'Resource video: the uploaded file is not a recognized MP4 video.'
    );
  }

  return {
    size,
    content_type: contentType,
    object_version_id: versionId.slice(0, 1024),
  };
}

export function createStudioResourceVideoPlaybackUrl(value) {
  const video = validateStudioResourceVideoReference(value);
  return presignedS3Url('GET', video.object_key, PLAYBACK_EXPIRY_SECONDS, [
    ['versionId', video.object_version_id],
    ['response-content-type', video.content_type],
    [
      'response-content-disposition',
      `inline; filename="${video.file_name.replace(/["\\]/g, '-')}"`,
    ],
  ]);
}
