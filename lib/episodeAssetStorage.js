import crypto from 'crypto';
import {
  EPISODE_ASSET_CATEGORIES,
  sanitizeEpisodeAssetFileName,
  validateEpisodeAssetInput,
} from './episodeAssetPolicy.mjs';

const UPLOAD_EXPIRY_SECONDS = 60 * 60;
const COMPLETION_TOKEN_EXPIRY_SECONDS = 24 * 60 * 60;
const DOWNLOAD_EXPIRY_SECONDS = 10 * 60;
const UPLOAD_TOKEN_VERSION = 1;
const UPLOAD_TOKEN_PURPOSE = 'episode_asset_upload';

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

function presignedS3Post(objectKey, contentType, size, expiresSeconds) {
  const config = storageConfig();
  if (!isEpisodeAssetStorageConfigured()) {
    throw new Error('Episode asset storage is not configured.');
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
        ['content-length-range', size, size],
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
  const assetId = `asset-${crypto.randomUUID()}`;
  const objectKey = [
    'episodes',
    cleanEpisodeId,
    input.category,
    `${assetId}-${input.file_name}`,
  ].join('/');
  const uploadExpiresAt = Date.now() + UPLOAD_EXPIRY_SECONDS * 1000;
  const completionExpiresAt =
    Date.now() + COMPLETION_TOKEN_EXPIRY_SECONDS * 1000;
  const upload = presignedS3Post(
    objectKey,
    input.content_type,
    input.size,
    UPLOAD_EXPIRY_SECONDS
  );
  return {
    asset_id: assetId,
    object_key: objectKey,
    upload_url: upload.url,
    upload_method: 'POST',
    upload_fields: upload.fields,
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

async function signedHead(objectKey) {
  const config = storageConfig();
  if (!isEpisodeAssetStorageConfigured()) {
    throw new Error('Episode asset storage is not configured.');
  }
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
  const cleanVersionId = String(versionId || '').trim().slice(0, 1024);
  if (/[\u0000-\u001f\u007f]/.test(cleanVersionId)) {
    throw new Error('Episode asset: the stored object version is invalid.');
  }
  const responseQuery = [
    ['response-content-disposition', attachmentDisposition(fileName)],
    ...(cleanVersionId ? [['versionId', cleanVersionId]] : []),
  ];
  return presignedS3Url(
    'GET',
    cleanObjectKey,
    DOWNLOAD_EXPIRY_SECONDS,
    responseQuery
  );
}
