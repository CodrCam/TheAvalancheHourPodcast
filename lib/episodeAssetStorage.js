import crypto from 'crypto';
import {
  EPISODE_ASSET_CATEGORIES,
  sanitizeEpisodeAssetFileName,
  validateEpisodeAssetInput,
} from './episodeAssetPolicy.mjs';
import { EPISODE_ASSET_UPLOAD_GRANT_EXPIRY_MS } from './episodeAssetGrantLifecycle.mjs';

export const EPISODE_ASSET_UPLOAD_GRANT_EXPIRY_SECONDS =
  EPISODE_ASSET_UPLOAD_GRANT_EXPIRY_MS / 1000;
const COMPLETION_TOKEN_EXPIRY_SECONDS = 24 * 60 * 60;
const DOWNLOAD_EXPIRY_SECONDS = 10 * 60;
const UPLOAD_TOKEN_VERSION = 1;
const UPLOAD_TOKEN_PURPOSE = 'episode_asset_upload';
const S3_DELETE_ATTEMPTS = 3;

export { validateEpisodeAssetInput } from './episodeAssetPolicy.mjs';

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

function awsEncodeURIComponent(value) {
  return encodeURIComponent(String(value || '')).replace(
    /[!'()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
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
    tokenSecret: readEnv('EPISODE_ASSETS_UPLOAD_TOKEN_SECRET'),
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

function presignedS3Url(
  method,
  objectKey,
  expiresSeconds,
  additionalQuery = []
) {
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

function presignedS3Put(objectKey, contentType, size, expiresSeconds) {
  const config = storageConfig();
  if (!isEpisodeAssetStorageConfigured()) {
    throw new Error('Episode asset storage is not configured.');
  }
  const now = new Date();
  const requestDate = amzDate(now);
  const dateStamp = requestDate.slice(0, 8);
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const signedHeaders =
    'content-length;content-type;host;if-none-match';
  const query = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${config.accessKeyId}/${scope}`],
    ['X-Amz-Date', requestDate],
    ['X-Amz-Expires', String(expiresSeconds)],
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

function safeId(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
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
  const tokenParts = String(token || '').split('.');
  const [encoded, providedSignature] = tokenParts;
  if (
    tokenParts.length !== 2 ||
    !encoded ||
    !providedSignature ||
    !config.tokenSecret
  ) {
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
  const cleanEpisodeId = safeId(episodeId);
  if (
    payload.version !== UPLOAD_TOKEN_VERSION ||
    payload.purpose !== UPLOAD_TOKEN_PURPOSE ||
    !cleanEpisodeId ||
    payload.episode_id !== cleanEpisodeId
  ) {
    throw new Error('Episode asset: upload authorization is invalid.');
  }
  const expiresAt = Number(payload.expires_at);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    throw new Error('Episode asset: upload authorization has expired.');
  }
  const input = validateEpisodeAssetInput(payload);
  const uploaderPersonId = safeId(payload.uploader_person_id);
  const deliverableId = safeId(payload.deliverable_id);
  const assetId = String(payload.asset_id || '').trim();
  if (
    !uploaderPersonId ||
    !deliverableId ||
    deliverableId !== payload.deliverable_id ||
    !/^asset-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      assetId
    )
  ) {
    throw new Error('Episode asset: upload authorization is invalid.');
  }
  const expectedObjectKey = [
    'episodes',
    cleanEpisodeId,
    input.category,
    `${assetId}-${input.file_name}`,
  ].join('/');
  if (payload.object_key !== expectedObjectKey) {
    throw new Error('Episode asset: upload authorization is invalid.');
  }
  return {
    ...payload,
    ...input,
    uploader_person_id: uploaderPersonId,
    deliverable_id: deliverableId,
    object_key: expectedObjectKey,
    expires_at: expiresAt,
  };
}

export function createEpisodeAssetUpload({
  episodeId,
  uploaderPersonId,
  deliverableId,
  file,
  uploadExpirySeconds = EPISODE_ASSET_UPLOAD_GRANT_EXPIRY_SECONDS,
  completionExpirySeconds = COMPLETION_TOKEN_EXPIRY_SECONDS,
}) {
  if (!isEpisodeAssetStorageConfigured()) {
    throw new Error('Episode asset storage is not configured.');
  }
  const cleanEpisodeId = safeId(episodeId);
  const cleanUploaderPersonId = safeId(uploaderPersonId);
  const cleanDeliverableId = safeId(deliverableId);
  if (!cleanEpisodeId || !cleanUploaderPersonId || !cleanDeliverableId) {
    throw new Error(
      'Episode asset: a valid episode, uploader, and episode step are required.'
    );
  }
  const input = validateEpisodeAssetInput(file);
  const cleanUploadExpirySeconds = Math.max(
    60,
    Math.min(
      7 * 24 * 60 * 60,
      Math.trunc(Number(uploadExpirySeconds)) ||
        EPISODE_ASSET_UPLOAD_GRANT_EXPIRY_SECONDS
    )
  );
  const cleanCompletionExpirySeconds = Math.max(
    cleanUploadExpirySeconds,
    Math.min(
      7 * 24 * 60 * 60,
      Math.trunc(Number(completionExpirySeconds)) ||
        COMPLETION_TOKEN_EXPIRY_SECONDS
    )
  );
  const assetId = `asset-${crypto.randomUUID()}`;
  const objectKey = [
    'episodes',
    cleanEpisodeId,
    input.category,
    `${assetId}-${input.file_name}`,
  ].join('/');
  const uploadExpiresAt =
    Date.now() + cleanUploadExpirySeconds * 1000;
  const completionExpiresAt =
    Date.now() + cleanCompletionExpirySeconds * 1000;
  const upload = presignedS3Put(
    objectKey,
    input.content_type,
    input.size,
    cleanUploadExpirySeconds
  );
  return {
    asset_id: assetId,
    object_key: objectKey,
    upload_url: upload.url,
    upload_method: 'PUT',
    upload_headers: upload.headers,
    expires_at: new Date(uploadExpiresAt).toISOString(),
    completion_expires_at: new Date(completionExpiresAt).toISOString(),
    upload_token: signUploadToken({
      version: UPLOAD_TOKEN_VERSION,
      purpose: UPLOAD_TOKEN_PURPOSE,
      episode_id: cleanEpisodeId,
      uploader_person_id: cleanUploaderPersonId,
      deliverable_id: cleanDeliverableId,
      asset_id: assetId,
      object_key: objectKey,
      ...input,
      expires_at: completionExpiresAt,
    }),
    ...input,
  };
}

async function signedS3Request(
  method,
  objectKey,
  additionalQuery = [],
  options = {}
) {
  const config = storageConfig();
  if (!isEpisodeAssetStorageConfigured()) {
    throw new Error('Episode asset storage is not configured.');
  }
  const now = new Date();
  const requestDate = amzDate(now);
  const dateStamp = requestDate.slice(0, 8);
  const host = `${config.bucket}.s3.${config.region}.amazonaws.com`;
  const payloadHash = String(
    options.payloadHash || 'UNSIGNED-PAYLOAD'
  );
  const additionalHeaders = Object.fromEntries(
    Object.entries(options.headers || {}).map(([name, value]) => [
      String(name || '').trim().toLowerCase(),
      String(value || '').trim(),
    ])
  );
  const headers = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': requestDate,
    ...additionalHeaders,
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
    payloadHash,
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
    `https://${host}${encodePath(objectKey)}${
      canonicalQuery ? `?${canonicalQuery}` : ''
    }`,
    {
      method,
      headers: { ...headers, Authorization: authorization },
      ...(Object.prototype.hasOwnProperty.call(options, 'body')
        ? { body: options.body }
        : {}),
    }
  );
}

async function signedHead(objectKey) {
  return signedS3Request('HEAD', objectKey);
}

export async function sealEpisodeAssetObjectKey(
  objectKey,
  { episodeId } = {}
) {
  const cleanObjectKey = assertEpisodeAssetObjectKey(objectKey, episodeId);
  const emptyPayloadHash = sha256('');
  let lastFailure = null;
  for (let attempt = 0; attempt < S3_DELETE_ATTEMPTS; attempt += 1) {
    try {
      const response = await signedS3Request('PUT', cleanObjectKey, [], {
        body: '',
        payloadHash: emptyPayloadHash,
        headers: {
          'content-type': 'application/octet-stream',
          'x-amz-meta-episode-asset-state': 'deleted',
        },
      });
      if (response.ok) {
        return { sealed: true };
      }
      lastFailure = new Error(
        `Storage returned ${response.status || 'an error'}.`
      );
      if (response.status >= 400 && response.status < 500) break;
    } catch (error) {
      lastFailure = error;
    }
  }
  try {
    const verification = await signedHead(cleanObjectKey);
    if (
      verification.ok &&
      String(
        verification.headers.get('x-amz-meta-episode-asset-state') || ''
      ) === 'deleted'
    ) {
      return { sealed: true };
    }
  } catch (error) {
    lastFailure = error;
  }
  const error = new Error(
    'Episode asset: secure storage could not seal this upload location before deletion.'
  );
  error.code = 'EPISODE_ASSET_DELETE_SEAL_FAILED';
  error.delete_state = 'confirmed_present';
  error.cause = lastFailure;
  throw error;
}

export async function verifyEpisodeAssetObject(payload) {
  const response = await signedHead(payload.object_key);
  if (!response.ok) {
    throw new Error('Episode asset: the uploaded object could not be verified.');
  }
  const size = Number(response.headers.get('content-length') || 0);
  const contentType = String(
    response.headers.get('content-type') || ''
  )
    .trim()
    .toLowerCase();
  if (size !== payload.size || contentType !== payload.content_type) {
    throw new Error(
      'Episode asset: the uploaded file does not match its authorization.'
    );
  }
  const versionId = String(
    response.headers.get('x-amz-version-id') || ''
  ).trim();
  if (!versionId || versionId === 'null') {
    throw new Error(
      'Episode asset: object storage versioning is required before this upload can be attached.'
    );
  }
  const lastModified = new Date(
    String(response.headers.get('last-modified') || '')
  );
  if (Number.isNaN(lastModified.getTime())) {
    throw new Error(
      'Episode asset: the object storage upload time could not be verified.'
    );
  }
  return {
    size,
    content_type: contentType,
    object_version_id: versionId.slice(0, 1024),
    uploaded_at: lastModified.toISOString(),
  };
}

function startsWithBytes(bytes, signature) {
  return signature.every((value, index) => bytes[index] === value);
}

export function validateEpisodeAssetContentSignature(
  bytesValue,
  contentType
) {
  const bytes = Buffer.from(bytesValue || []);
  const type = String(contentType || '').trim().toLowerCase();
  const ascii = bytes.toString('latin1');
  let valid = false;
  if (type === 'application/pdf') {
    valid = bytes.subarray(0, 1024).includes(Buffer.from('%PDF-'));
  } else if (type === 'image/jpeg') {
    valid = startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
  } else if (type === 'image/png') {
    valid = startsWithBytes(bytes, [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
  } else if (type === 'image/webp') {
    valid = ascii.slice(0, 4) === 'RIFF' && ascii.slice(8, 12) === 'WEBP';
  } else if (type === 'image/tiff') {
    valid =
      startsWithBytes(bytes, [0x49, 0x49, 0x2a, 0x00]) ||
      startsWithBytes(bytes, [0x4d, 0x4d, 0x00, 0x2a]);
  } else if (['image/avif', 'image/heic', 'image/heif'].includes(type)) {
    const brandsByType = {
      'image/avif': ['avif', 'avis'],
      'image/heic': ['heic', 'heix', 'hevc', 'hevx'],
      'image/heif': ['mif1', 'msf1', 'heif'],
    };
    valid =
      ascii.slice(4, 8) === 'ftyp' &&
      brandsByType[type].some((brand) => ascii.slice(8, 64).includes(brand));
  } else if (
    type ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    valid =
      startsWithBytes(bytes, [0x50, 0x4b]) &&
      ascii.includes('[Content_Types].xml') &&
      ascii.includes('word/');
  } else if (type === 'application/vnd.oasis.opendocument.text') {
    valid =
      startsWithBytes(bytes, [0x50, 0x4b]) &&
      ascii.includes('mimetype') &&
      ascii.includes('application/vnd.oasis.opendocument.text');
  } else if (type === 'text/plain') {
    valid = !bytes.includes(0);
    if (valid) {
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        valid = false;
      }
    }
  }
  if (!valid) {
    throw new Error(
      'Episode asset: the uploaded file signature does not match its approved type.'
    );
  }
  return true;
}

export async function verifyEpisodeAssetContentSignature(
  payload,
  { versionId } = {}
) {
  const cleanObjectKey = assertEpisodeAssetObjectKey(
    payload?.object_key,
    payload?.episode_id
  );
  const cleanVersionId = assertEpisodeAssetVersionId(versionId);
  const type = String(payload?.content_type || '').trim().toLowerCase();
  const inspectWholeObject = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
  ].includes(type);
  const authorizedSize = Math.max(1, Number(payload?.size) || 0);
  const inspectionSize = inspectWholeObject
    ? authorizedSize
    : Math.min(authorizedSize, 64 * 1024);
  const response = await signedS3Request(
    'GET',
    cleanObjectKey,
    [['versionId', cleanVersionId]],
    { headers: { range: `bytes=0-${inspectionSize - 1}` } }
  );
  if (!response.ok) {
    throw new Error(
      'Episode asset: the uploaded file signature could not be verified.'
    );
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > inspectionSize) {
    throw new Error(
      'Episode asset: the uploaded file signature could not be verified.'
    );
  }
  return validateEpisodeAssetContentSignature(bytes, type);
}

function assertEpisodeAssetObjectKey(objectKey, episodeId) {
  const cleanEpisodeId = safeId(episodeId);
  const cleanObjectKey = String(objectKey || '').trim();
  const parts = cleanObjectKey.split('/');
  if (
    !cleanEpisodeId ||
    parts.length !== 4 ||
    parts[0] !== 'episodes' ||
    parts[1] !== cleanEpisodeId ||
    !EPISODE_ASSET_CATEGORIES.includes(parts[2]) ||
    !/^asset-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-.+/i.test(
      parts[3]
    ) ||
    parts.slice(2).some((part) => part === '.' || part === '..') ||
    /[\u0000-\u001f\u007f]/.test(cleanObjectKey)
  ) {
    throw new Error('Episode asset: the stored object key is invalid.');
  }
  return cleanObjectKey;
}

function assertEpisodeAssetVersionId(versionId) {
  const cleanVersionId = String(versionId || '').trim().slice(0, 1024);
  if (
    !cleanVersionId ||
    cleanVersionId === 'null' ||
    /[\u0000-\u001f\u007f]/.test(cleanVersionId)
  ) {
    throw new Error('Episode asset: the stored object version is invalid.');
  }
  return cleanVersionId;
}

function assertEpisodeAssetCleanupVersionId(versionId) {
  const cleanVersionId = String(versionId || '').trim().slice(0, 1024);
  if (cleanVersionId === 'null') return cleanVersionId;
  return assertEpisodeAssetVersionId(cleanVersionId);
}

export async function deleteEpisodeAssetObject(
  objectKey,
  { episodeId, versionId, allowNullVersionId = false } = {}
) {
  const cleanObjectKey = assertEpisodeAssetObjectKey(objectKey, episodeId);
  const cleanVersionId = allowNullVersionId
    ? assertEpisodeAssetCleanupVersionId(versionId)
    : assertEpisodeAssetVersionId(versionId);
  const versionQuery = [['versionId', cleanVersionId]];
  let lastFailure = null;

  for (let attempt = 0; attempt < S3_DELETE_ATTEMPTS; attempt += 1) {
    try {
      const response = await signedS3Request(
        'DELETE',
        cleanObjectKey,
        versionQuery
      );
      if (response.ok || response.status === 404) {
        return { deleted: true, version_id: cleanVersionId };
      }
      lastFailure = new Error(`Storage returned ${response.status || 'an error'}.`);
      if (response.status >= 400 && response.status < 500) {
        const error = new Error(
          'Episode asset: secure storage could not delete this object version.'
        );
        error.code = 'EPISODE_ASSET_DELETE_REJECTED';
        error.delete_state = 'confirmed_present';
        error.cause = lastFailure;
        throw error;
      }
    } catch (error) {
      if (error?.delete_state === 'confirmed_present') throw error;
      lastFailure = error;
    }
  }

  try {
    const verification = await signedS3Request(
      'HEAD',
      cleanObjectKey,
      versionQuery
    );
    if (verification.status === 404) {
      return { deleted: true, version_id: cleanVersionId };
    }
    if (verification.ok) {
      const error = new Error(
        'Episode asset: secure storage could not delete this object version.'
      );
      error.code = 'EPISODE_ASSET_DELETE_REJECTED';
      error.delete_state = 'confirmed_present';
      error.cause = lastFailure;
      throw error;
    }
  } catch (error) {
    if (error?.delete_state === 'confirmed_present') throw error;
    lastFailure = error;
  }

  const error = new Error(
    'Episode asset: secure storage could not confirm deletion of this object version.'
  );
  error.code = 'EPISODE_ASSET_DELETE_UNCONFIRMED';
  error.delete_state = 'unknown';
  error.cause = lastFailure;
  throw error;
}

export function shouldRestoreEpisodeAssetMetadataAfterDeleteError(error) {
  return error?.delete_state !== 'unknown';
}

function decodeXmlText(value = '') {
  return String(value || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function xmlElementText(value, name) {
  const match = String(value || '').match(
    new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`)
  );
  return match ? decodeXmlText(match[1]).trim() : '';
}

function decodeS3UrlValue(value = '') {
  try {
    return decodeURIComponent(String(value || ''));
  } catch {
    return '';
  }
}

function parseEpisodeAssetVersionListing(xml, episodeId) {
  const entries = [];
  const itemPattern = /<(Version|DeleteMarker)>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = itemPattern.exec(String(xml || '')))) {
    const encodedKey = xmlElementText(match[2], 'Key');
    const versionId = xmlElementText(match[2], 'VersionId');
    let objectKey = '';
    objectKey = decodeS3UrlValue(encodedKey);
    if (!objectKey || !versionId) {
      throw new Error(
        'Episode asset: storage returned an invalid object-version listing.'
      );
    }
    entries.push({
      object_key: assertEpisodeAssetObjectKey(objectKey, episodeId),
      object_version_id: assertEpisodeAssetCleanupVersionId(versionId),
    });
  }
  return {
    entries,
    truncated: xmlElementText(xml, 'IsTruncated') === 'true',
    next_key_marker: decodeS3UrlValue(
      xmlElementText(xml, 'NextKeyMarker')
    ),
    next_version_id_marker: xmlElementText(xml, 'NextVersionIdMarker'),
  };
}

export async function listEpisodeAssetObjectVersions(episodeId) {
  const cleanEpisodeId = safeId(episodeId);
  if (!cleanEpisodeId || cleanEpisodeId !== String(episodeId || '').trim()) {
    throw new Error('Episode asset: the episode ID is invalid.');
  }
  const prefix = `episodes/${cleanEpisodeId}/`;
  const versions = [];
  let keyMarker = '';
  let versionIdMarker = '';
  for (let page = 0; page < 100; page += 1) {
    const response = await signedS3Request('GET', '', [
      ['encoding-type', 'url'],
      ...(keyMarker ? [['key-marker', keyMarker]] : []),
      ['max-keys', '1000'],
      ['prefix', prefix],
      ...(versionIdMarker
        ? [['version-id-marker', versionIdMarker]]
        : []),
      ['versions', ''],
    ]);
    if (!response.ok) {
      throw new Error(
        'Episode asset: secure storage could not list this episode prefix.'
      );
    }
    const listing = parseEpisodeAssetVersionListing(
      await response.text(),
      cleanEpisodeId
    );
    versions.push(...listing.entries);
    if (!listing.truncated) return versions;
    if (!listing.next_key_marker || !listing.next_version_id_marker) {
      throw new Error(
        'Episode asset: storage returned an incomplete object-version listing.'
      );
    }
    keyMarker = listing.next_key_marker;
    versionIdMarker = listing.next_version_id_marker;
  }
  throw new Error(
    'Episode asset: this episode prefix is too large to delete safely.'
  );
}

async function listEpisodeAssetObjectVersionCleanupPage(
  episodeId,
  maxVersions
) {
  const cleanEpisodeId = safeId(episodeId);
  if (!cleanEpisodeId || cleanEpisodeId !== String(episodeId || '').trim()) {
    throw new Error('Episode asset: the episode ID is invalid.');
  }
  const response = await signedS3Request('GET', '', [
    ['encoding-type', 'url'],
    ['max-keys', String(maxVersions)],
    ['prefix', `episodes/${cleanEpisodeId}/`],
    ['versions', ''],
  ]);
  if (!response.ok) {
    throw new Error(
      'Episode asset: secure storage could not list this episode prefix.'
    );
  }
  return parseEpisodeAssetVersionListing(
    await response.text(),
    cleanEpisodeId
  );
}

export async function deleteEpisodeAssetObjectVersionsForEpisode(
  episodeId,
  { maxVersions = 20 } = {}
) {
  const cleanLimit = Math.max(
    1,
    Math.min(100, Math.trunc(Number(maxVersions) || 20))
  );
  const listing = await listEpisodeAssetObjectVersionCleanupPage(
    episodeId,
    cleanLimit
  );
  for (let index = 0; index < listing.entries.length; index += 5) {
    const batch = listing.entries.slice(index, index + 5);
    await Promise.all(
      batch.map((version) =>
        deleteEpisodeAssetObject(version.object_key, {
          episodeId,
          versionId: version.object_version_id,
          allowNullVersionId: true,
        })
      )
    );
  }
  return {
    deleted: !listing.truncated,
    cleanup_pending: listing.truncated,
    deleted_version_count: listing.entries.length,
  };
}

function attachmentDisposition(fileName) {
  const sanitized =
    sanitizeEpisodeAssetFileName(fileName) || 'episode-asset-download';
  const fallback = sanitized
    .normalize('NFKD')
    .replace(/[^\x20-\x7e]+/g, '-')
    .replace(/["\\]+/g, '-')
    .slice(0, 180);
  const encoded = encodeURIComponent(sanitized).replace(
    /[!'()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function createEpisodeAssetDownloadUrl(
  objectKey,
  { episodeId, fileName, versionId } = {}
) {
  const cleanObjectKey = assertEpisodeAssetObjectKey(objectKey, episodeId);
  const cleanVersionId = assertEpisodeAssetVersionId(versionId);
  const responseQuery = [
    ['response-content-disposition', attachmentDisposition(fileName)],
    ['versionId', cleanVersionId],
  ];
  return presignedS3Url(
    'GET',
    cleanObjectKey,
    DOWNLOAD_EXPIRY_SECONDS,
    responseQuery
  );
}
