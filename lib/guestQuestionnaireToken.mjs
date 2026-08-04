import crypto from 'crypto';

const TOKEN_TYPE = 'guest_questionnaire';
const TOKEN_VERSION = 1;
const MIN_SECRET_LENGTH = 32;
const DEFAULT_LIFETIME_DAYS = 21;
const MAX_LIFETIME_DAYS = 90;

function cleanText(value, maxLength = 5000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function base64UrlJson(value) {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function parseBase64UrlJson(value) {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function signature(secret, signingInput) {
  return crypto
    .createHmac('sha256', secret)
    .update(signingInput, 'utf8')
    .digest('base64url');
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function hashGuestQuestionnaireTokenId(value) {
  return crypto
    .createHash('sha256')
    .update(cleanText(value, 500), 'utf8')
    .digest('hex');
}

export function getGuestQuestionnaireTokenSecret() {
  return cleanText(process.env.GUEST_QUESTIONNAIRE_TOKEN_SECRET, 1000);
}

export function isGuestQuestionnaireTokenConfigured(secretValue) {
  const secret = cleanText(
    secretValue === undefined
      ? getGuestQuestionnaireTokenSecret()
      : secretValue,
    1000
  );
  return secret.length >= MIN_SECRET_LENGTH;
}

function requireSecret(secretValue) {
  const secret = cleanText(
    secretValue === undefined
      ? getGuestQuestionnaireTokenSecret()
      : secretValue,
    1000
  );
  if (!isGuestQuestionnaireTokenConfigured(secret)) {
    throw new Error(
      'Guest questionnaire share links are not configured securely.'
    );
  }
  return secret;
}

export function issueGuestQuestionnaireToken({
  episodeId,
  expiresInDays = DEFAULT_LIFETIME_DAYS,
  now = new Date(),
  secret,
} = {}) {
  const cleanEpisodeId = cleanText(episodeId, 180);
  if (!cleanEpisodeId) {
    throw new Error('Guest questionnaire token: episode ID is required.');
  }
  const signingSecret = requireSecret(secret);
  const issuedAt = Math.floor(now.getTime() / 1000);
  const requestedDays = Number(expiresInDays);
  const lifetimeDays = Number.isFinite(requestedDays)
    ? Math.max(1, Math.min(MAX_LIFETIME_DAYS, Math.trunc(requestedDays)))
    : DEFAULT_LIFETIME_DAYS;
  const expiresAt = issuedAt + lifetimeDays * 24 * 60 * 60;
  const jti = crypto.randomBytes(32).toString('base64url');
  const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
  const payload = base64UrlJson({
    v: TOKEN_VERSION,
    typ: TOKEN_TYPE,
    episode_id: cleanEpisodeId,
    jti,
    iat: issuedAt,
    exp: expiresAt,
  });
  const signingInput = `${header}.${payload}`;
  return {
    token: `${signingInput}.${signature(signingSecret, signingInput)}`,
    episode_id: cleanEpisodeId,
    token_jti_hash: hashGuestQuestionnaireTokenId(jti),
    issued_at: new Date(issuedAt * 1000).toISOString(),
    expires_at: new Date(expiresAt * 1000).toISOString(),
  };
}

export function verifyGuestQuestionnaireToken(
  tokenValue,
  { now = new Date(), secret } = {}
) {
  const token = cleanText(tokenValue, 4096);
  if (!token || token !== String(tokenValue || '').trim()) {
    throw new Error('Guest questionnaire share link is invalid.');
  }
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Guest questionnaire share link is invalid.');
  }
  const signingSecret = requireSecret(secret);
  const signingInput = `${parts[0]}.${parts[1]}`;
  if (!safeEqual(parts[2], signature(signingSecret, signingInput))) {
    throw new Error('Guest questionnaire share link is invalid.');
  }
  let header;
  let payload;
  try {
    header = parseBase64UrlJson(parts[0]);
    payload = parseBase64UrlJson(parts[1]);
  } catch {
    throw new Error('Guest questionnaire share link is invalid.');
  }
  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (
    header?.alg !== 'HS256' ||
    header?.typ !== 'JWT' ||
    payload?.v !== TOKEN_VERSION ||
    payload?.typ !== TOKEN_TYPE ||
    !cleanText(payload?.episode_id, 180) ||
    !cleanText(payload?.jti, 180) ||
    !Number.isInteger(payload?.iat) ||
    !Number.isInteger(payload?.exp) ||
    payload.exp <= nowSeconds ||
    payload.iat > nowSeconds + 300 ||
    payload.exp <= payload.iat ||
    payload.exp - payload.iat > MAX_LIFETIME_DAYS * 24 * 60 * 60
  ) {
    throw new Error('Guest questionnaire share link is invalid or expired.');
  }
  return {
    episode_id: cleanText(payload.episode_id, 180),
    token_jti_hash: hashGuestQuestionnaireTokenId(payload.jti),
    issued_at: new Date(payload.iat * 1000).toISOString(),
    expires_at: new Date(payload.exp * 1000).toISOString(),
  };
}

export function guestQuestionnaireTokenMatchesLink(
  tokenPayload = {},
  linkValue = {},
  now = new Date()
) {
  const link = linkValue && typeof linkValue === 'object' ? linkValue : {};
  const expiration = new Date(link.expires_at || '');
  return Boolean(
    link.status === 'active' &&
      tokenPayload.token_jti_hash &&
      safeEqual(tokenPayload.token_jti_hash, link.token_jti_hash) &&
      tokenPayload.expires_at === link.expires_at &&
      !Number.isNaN(expiration.getTime()) &&
      expiration.getTime() > now.getTime()
  );
}

export function isGuestQuestionnairePublicAccessAllowed({
  tokenPayload = {},
  record = {},
  episode = null,
  now = new Date(),
} = {}) {
  return Boolean(
    episode?.episode_id &&
      episode.episode_id === tokenPayload.episode_id &&
      episode.archived !== true &&
      !episode.deleted_at &&
      episode.status !== 'accepted' &&
      record?.episode_id === tokenPayload.episode_id &&
      guestQuestionnaireTokenMatchesLink(tokenPayload, record.link, now)
  );
}

export function getGuestQuestionnaireBearerToken(req = {}) {
  const header =
    req.headers?.authorization ||
    req.headers?.Authorization ||
    req.headers?.get?.('authorization') ||
    '';
  return typeof header === 'string' && header.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : '';
}
