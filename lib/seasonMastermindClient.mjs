import crypto from 'node:crypto';

const DEFAULT_REGION = 'us-east-2';
const DEFAULT_TIMEOUT_MS = 45_000;
const MAX_REQUEST_BYTES = 64 * 1024;
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_REQUEST_ID_LENGTH = 128;
const TRANSIENT_GATEWAY_STATUSES = new Set([502, 503, 504]);

function clean(value) {
  return String(value || '').trim();
}

function cleanRequestId(value) {
  const requestId = clean(value).slice(0, MAX_REQUEST_ID_LENGTH);
  return /^[A-Za-z0-9][A-Za-z0-9._:/=-]*$/.test(requestId)
    ? requestId
    : '';
}

function sha256(value, encoding = 'hex') {
  return crypto.createHash('sha256').update(value, 'utf8').digest(encoding);
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function signingKey(secretKey, dateStamp, region, service) {
  const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
  const regionKey = hmac(dateKey, region);
  const serviceKey = hmac(regionKey, service);
  return hmac(serviceKey, 'aws4_request');
}

function amzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function awsEncode(value) {
  return encodeURIComponent(String(value || '')).replace(
    /[!'()*]/g,
    (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

function canonicalPath(pathname) {
  const segments = String(pathname || '/')
    .split('/')
    .map((segment) => awsEncode(decodeURIComponent(segment)));
  return segments.join('/') || '/';
}

function canonicalQuery(url) {
  return [...url.searchParams.entries()]
    .map(([name, value]) => [awsEncode(name), awsEncode(value)])
    .sort(([leftName, leftValue], [rightName, rightValue]) => {
      if (leftName !== rightName) return leftName < rightName ? -1 : 1;
      if (leftValue === rightValue) return 0;
      return leftValue < rightValue ? -1 : 1;
    })
    .map(([name, value]) => `${name}=${value}`)
    .join('&');
}

function safeRegion(value) {
  const region = clean(value) || DEFAULT_REGION;
  if (!/^[a-z]{2}(?:-gov)?-[a-z]+-\d$/.test(region)) {
    throw new Error('Season Mastermind AWS region is invalid.');
  }
  return region;
}

function safeEndpoint(value, region) {
  let url;
  try {
    url = new URL(clean(value));
  } catch {
    throw new Error('Season Mastermind Lambda URL is invalid.');
  }

  const expectedSuffix = `.lambda-url.${region}.on.aws`;
  if (
    url.protocol !== 'https:' ||
    !url.hostname.endsWith(expectedSuffix) ||
    url.hostname === expectedSuffix.slice(1) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !['', '/'].includes(url.pathname)
  ) {
    throw new Error('Season Mastermind Lambda URL is not an allowed endpoint.');
  }
  return url;
}

export function isSeasonMastermindEnabled(env = process.env) {
  return clean(env.SEASON_MASTERMIND_ENABLED).toLowerCase() === 'true';
}

export function seasonMastermindConfig(env = process.env) {
  const region = safeRegion(
    env.SEASON_MASTERMIND_AWS_REGION || env.AWS_REGION
  );
  const endpoint = clean(env.SEASON_MASTERMIND_LAMBDA_URL)
    ? safeEndpoint(env.SEASON_MASTERMIND_LAMBDA_URL, region)
    : null;
  const timeoutValue = Number(env.SEASON_MASTERMIND_TIMEOUT_MS);
  const timeoutMs = Number.isInteger(timeoutValue)
    ? Math.min(Math.max(timeoutValue, 1_000), 60_000)
    : DEFAULT_TIMEOUT_MS;

  return {
    enabled: isSeasonMastermindEnabled(env),
    endpoint,
    region,
    accessKeyId: clean(env.SEASON_MASTERMIND_ACCESS_KEY_ID),
    secretAccessKey: clean(env.SEASON_MASTERMIND_SECRET_ACCESS_KEY),
    sessionToken: clean(env.SEASON_MASTERMIND_SESSION_TOKEN),
    timeoutMs,
  };
}

export function isSeasonMastermindConfigured(env = process.env) {
  try {
    const config = seasonMastermindConfig(env);
    return Boolean(
      config.enabled &&
        config.endpoint &&
        config.accessKeyId &&
        config.secretAccessKey
    );
  } catch {
    return false;
  }
}

export function signSeasonMastermindRequest({
  endpoint,
  region = DEFAULT_REGION,
  accessKeyId,
  secretAccessKey,
  sessionToken = '',
  body,
  now = new Date(),
}) {
  const safeAwsRegion = safeRegion(region);
  const url =
    endpoint instanceof URL
      ? safeEndpoint(endpoint.toString(), safeAwsRegion)
      : safeEndpoint(endpoint, safeAwsRegion);
  const keyId = clean(accessKeyId);
  const secret = clean(secretAccessKey);
  const token = clean(sessionToken);
  if (!keyId || !secret) {
    throw new Error('Season Mastermind caller credentials are missing.');
  }
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new Error('Season Mastermind request time is invalid.');
  }

  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  if (Buffer.byteLength(payload, 'utf8') > MAX_REQUEST_BYTES) {
    throw new Error('Season Mastermind request is too large.');
  }

  const requestDate = amzDate(now);
  const dateStamp = requestDate.slice(0, 8);
  const payloadHash = sha256(payload);
  const headers = {
    'content-type': 'application/json',
    host: url.host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': requestDate,
    ...(token ? { 'x-amz-security-token': token } : {}),
  };
  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${headers[name].replace(/\s+/g, ' ').trim()}\n`)
    .join('');
  const signedHeaders = signedHeaderNames.join(';');
  const canonicalRequest = [
    'POST',
    canonicalPath(url.pathname),
    canonicalQuery(url),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');
  const credentialScope = `${dateStamp}/${safeAwsRegion}/lambda/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    requestDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');
  const signature = hmac(
    signingKey(secret, dateStamp, safeAwsRegion, 'lambda'),
    stringToSign,
    'hex'
  );

  return {
    body: payload,
    headers: {
      'Content-Type': headers['content-type'],
      Host: headers.host,
      'X-Amz-Content-Sha256': headers['x-amz-content-sha256'],
      'X-Amz-Date': headers['x-amz-date'],
      ...(token ? { 'X-Amz-Security-Token': token } : {}),
      Authorization: [
        `AWS4-HMAC-SHA256 Credential=${keyId}/${credentialScope}`,
        `SignedHeaders=${signedHeaders}`,
        `Signature=${signature}`,
      ].join(', '),
    },
    url: url.toString(),
  };
}

export class SeasonMastermindServiceError extends Error {
  constructor(
    message,
    {
      code = 'MASTERMIND_UNAVAILABLE',
      status = 503,
      requestId = '',
    } = {}
  ) {
    super(message);
    this.name = 'SeasonMastermindServiceError';
    this.code = code;
    this.status = status;
    this.requestId = cleanRequestId(requestId);
  }
}

function upstreamRequestId(response) {
  return cleanRequestId(
    response?.headers?.get?.('x-amzn-requestid') ||
      response?.headers?.get?.('x-amz-request-id')
  );
}

function transientGatewayError(response, requestId) {
  return new SeasonMastermindServiceError(
    'Season Mastermind is waking or temporarily unavailable. Try again in a moment.',
    {
      code: 'MASTERMIND_WAKING',
      status: response.status === 504 ? 504 : 503,
      requestId,
    }
  );
}

export async function invokeSeasonMastermind(
  payload,
  { env = process.env, fetchImpl = fetch, now = new Date() } = {}
) {
  const config = seasonMastermindConfig(env);
  if (
    !config.enabled ||
    !config.endpoint ||
    !config.accessKeyId ||
    !config.secretAccessKey
  ) {
    throw new SeasonMastermindServiceError(
      'Season Mastermind is not configured.',
      { code: 'MASTERMIND_NOT_CONFIGURED' }
    );
  }

  const signed = signSeasonMastermindRequest({
    endpoint: config.endpoint,
    region: config.region,
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    sessionToken: config.sessionToken,
    body: payload,
    now,
  });

  let response;
  try {
    response = await fetchImpl(signed.url, {
      method: 'POST',
      headers: signed.headers,
      body: signed.body,
      redirect: 'error',
      signal: AbortSignal.timeout(config.timeoutMs),
    });
  } catch (error) {
    const timedOut =
      error?.name === 'TimeoutError' || error?.name === 'AbortError';
    throw new SeasonMastermindServiceError(
      timedOut
        ? 'Season Mastermind is still waking. Try once more in a moment.'
        : 'Season Mastermind could not be reached.',
      {
        code: timedOut ? 'MASTERMIND_WAKING' : 'MASTERMIND_UNAVAILABLE',
        status: timedOut ? 504 : 503,
      }
    );
  }

  const requestId = upstreamRequestId(response);
  const responseText = await response.text();
  if (Buffer.byteLength(responseText, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new SeasonMastermindServiceError(
      'Season Mastermind returned too much data.',
      {
        code: 'MASTERMIND_RESPONSE_TOO_LARGE',
        status: 502,
        requestId,
      }
    );
  }

  let data = null;
  try {
    data = responseText ? JSON.parse(responseText) : null;
  } catch {
    if (TRANSIENT_GATEWAY_STATUSES.has(response.status)) {
      throw transientGatewayError(response, requestId);
    }
    throw new SeasonMastermindServiceError(
      'Season Mastermind returned an invalid response.',
      { code: 'MASTERMIND_BAD_RESPONSE', status: 502, requestId }
    );
  }

  if (data === null && TRANSIENT_GATEWAY_STATUSES.has(response.status)) {
    throw transientGatewayError(response, requestId);
  }

  if (!response.ok || !data?.ok) {
    const errorPayload =
      data?.error && typeof data.error === 'object' ? data.error : null;
    const upstreamStatus = Number(data?.status ?? errorPayload?.status);
    const status =
      Number.isInteger(upstreamStatus) && upstreamStatus >= 400
        ? Math.min(upstreamStatus, 599)
        : response.status >= 400
          ? response.status
          : 502;
    throw new SeasonMastermindServiceError(
      clean(errorPayload?.message || data?.error) ||
        'Season Mastermind request failed.',
      {
        code:
          clean(errorPayload?.code || data?.code) ||
          'MASTERMIND_REQUEST_FAILED',
        status,
        requestId,
      }
    );
  }

  if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
    return {
      ...data.data,
      ok: true,
      operation: clean(data.operation || payload?.operation),
      ...(clean(data.request_id) ? { request_id: clean(data.request_id) } : {}),
    };
  }

  return data;
}
