import crypto from 'crypto';
import { validateEpisodeAssetInput } from './episodeAssetPolicy.mjs';

const MEBIBYTE = 1024 * 1024;

export const GUEST_QUESTIONNAIRE_UPLOAD_SLOTS = Object.freeze({
  resume: Object.freeze({
    key: 'resume',
    deliverable_id: 'guest-details',
    category: 'document',
    max_files: 1,
    max_bytes: 10 * MEBIBYTE,
    content_types: Object.freeze([
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.oasis.opendocument.text',
      'text/plain',
    ]),
  }),
  photo: Object.freeze({
    key: 'photo',
    deliverable_id: 'photos',
    category: 'image',
    max_files: 10,
    max_bytes: 30 * MEBIBYTE,
    content_types: Object.freeze([
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/avif',
      'image/tiff',
      'image/heic',
      'image/heif',
    ]),
  }),
});

const AUTHORIZATION_VERSION = 1;
const AUTHORIZATION_PURPOSE = 'guest_questionnaire_asset_upload';
const MAX_AUTHORIZATION_LIFETIME_MS = 24 * 60 * 60 * 1000;

function cleanText(value, maxLength = 5000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function safeId(value, maxLength = 180) {
  return cleanText(value, maxLength)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function timingSafeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

function uploadSigningSecret(secretValue) {
  const configured = cleanText(
    secretValue === undefined
      ? process.env.GUEST_QUESTIONNAIRE_TOKEN_SECRET
      : secretValue,
    2000
  );
  if (configured.length < 32) {
    throw new Error(
      'Guest questionnaire uploads are not configured securely.'
    );
  }
  return crypto
    .createHmac('sha256', configured)
    .update('guest-questionnaire-upload-token-v1', 'utf8')
    .digest();
}

function signAuthorization(encoded, secretValue) {
  return crypto
    .createHmac('sha256', uploadSigningSecret(secretValue))
    .update(encoded, 'utf8')
    .digest('base64url');
}

export class GuestQuestionnaireUploadError extends Error {
  constructor(message, code = 'GUEST_QUESTIONNAIRE_UPLOAD_INVALID') {
    super(message);
    this.name = 'GuestQuestionnaireUploadError';
    this.code = code;
  }
}

export function getGuestQuestionnaireUploadSlot(slotKeyValue) {
  const slotKey = safeId(slotKeyValue, 40);
  const slot = GUEST_QUESTIONNAIRE_UPLOAD_SLOTS[slotKey];
  if (!slot) {
    throw new GuestQuestionnaireUploadError(
      'Choose a supported guest questionnaire upload field.',
      'GUEST_UPLOAD_SLOT_INVALID'
    );
  }
  return slot;
}

export function getConfiguredGuestQuestionnaireUploadSlot(
  questionnaireValue,
  slotKeyValue
) {
  const slot = getGuestQuestionnaireUploadSlot(slotKeyValue);
  const configuredSlot = (
    Array.isArray(questionnaireValue?.upload_slots)
      ? questionnaireValue.upload_slots
      : []
  ).find((candidate) => safeId(candidate?.key, 40) === slot.key);
  if (
    !configuredSlot ||
    configuredSlot.visible !== true ||
    configuredSlot.status === 'not_enabled' ||
    configuredSlot.status === 'disabled'
  ) {
    throw new GuestQuestionnaireUploadError(
      'This upload field is not available on the current questionnaire.',
      'GUEST_UPLOAD_SLOT_NOT_AVAILABLE'
    );
  }
  const configuredMaximum = Math.trunc(
    Number(configuredSlot.max_count) || slot.max_files
  );
  return {
    ...slot,
    required: configuredSlot.required === true,
    min_count: Math.max(
      0,
      Math.min(
        slot.max_files,
        Math.trunc(Number(configuredSlot.min_count) || 0)
      )
    ),
    max_count: Math.max(
      1,
      Math.min(slot.max_files, configuredMaximum)
    ),
  };
}

export function validateGuestQuestionnaireUploadFile(
  slotKeyValue,
  fileValue = {}
) {
  const slot = getGuestQuestionnaireUploadSlot(slotKeyValue);
  let input;
  try {
    input = validateEpisodeAssetInput({
      ...plainObject(fileValue),
      category: slot.category,
    });
  } catch (error) {
    throw new GuestQuestionnaireUploadError(
      String(error?.message || 'The selected file is not supported.'),
      'GUEST_UPLOAD_FILE_INVALID'
    );
  }
  if (
    input.size > slot.max_bytes ||
    !slot.content_types.includes(input.content_type)
  ) {
    const message =
      slot.key === 'resume'
        ? 'Use a PDF, DOCX, ODT, or plain-text resume no larger than 10 MB.'
        : 'Use a JPG, PNG, WebP, AVIF, TIFF, HEIC, or HEIF photo no larger than 30 MB.';
    throw new GuestQuestionnaireUploadError(
      message,
      'GUEST_UPLOAD_FILE_INVALID'
    );
  }
  return input;
}

export function deriveGuestQuestionnaireUploaderId({
  episodeId,
  linkTokenHash,
} = {}) {
  const cleanEpisodeId = cleanText(episodeId, 180);
  const cleanLinkHash = cleanText(linkTokenHash, 128);
  if (!cleanEpisodeId || !/^[a-f0-9]{64}$/i.test(cleanLinkHash)) {
    throw new GuestQuestionnaireUploadError(
      'The guest questionnaire upload identity is invalid.',
      'GUEST_UPLOAD_IDENTITY_INVALID'
    );
  }
  const digest = crypto
    .createHash('sha256')
    .update(`${cleanEpisodeId}\u0000${cleanLinkHash}`, 'utf8')
    .digest('hex')
    .slice(0, 32);
  return `guest-questionnaire-${digest}`;
}

export function isGuestQuestionnaireUploaderId(value) {
  return /^guest-questionnaire-[a-f0-9]{32}$/i.test(
    cleanText(value, 180)
  );
}

export function createGuestQuestionnaireUploadAuthorization({
  episodeId,
  slotKey,
  linkTokenHash,
  uploaderPersonId,
  assetUpload,
  now = new Date(),
  secret,
} = {}) {
  const slot = getGuestQuestionnaireUploadSlot(slotKey);
  const upload = plainObject(assetUpload);
  const issuedAt = now.getTime();
  const underlyingExpiry = new Date(
    cleanText(upload.completion_expires_at, 60)
  ).getTime();
  const expiresAt = Math.min(
    Number.isFinite(underlyingExpiry)
      ? underlyingExpiry
      : issuedAt + MAX_AUTHORIZATION_LIFETIME_MS,
    issuedAt + MAX_AUTHORIZATION_LIFETIME_MS
  );
  const payload = {
    v: AUTHORIZATION_VERSION,
    purpose: AUTHORIZATION_PURPOSE,
    episode_id: safeId(episodeId),
    slot_key: slot.key,
    link_token_hash: cleanText(linkTokenHash, 128),
    uploader_person_id: safeId(uploaderPersonId),
    deliverable_id: slot.deliverable_id,
    asset_id: cleanText(upload.asset_id, 180),
    episode_upload_token: cleanText(upload.upload_token, 12000),
    issued_at: issuedAt,
    expires_at: expiresAt,
  };
  if (
    !payload.episode_id ||
    !/^[a-f0-9]{64}$/i.test(payload.link_token_hash) ||
    !payload.uploader_person_id ||
    !payload.asset_id ||
    !payload.episode_upload_token ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= issuedAt
  ) {
    throw new GuestQuestionnaireUploadError(
      'The guest upload could not be authorized.',
      'GUEST_UPLOAD_AUTHORIZATION_INVALID'
    );
  }
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url'
  );
  return `${encoded}.${signAuthorization(encoded, secret)}`;
}

export function verifyGuestQuestionnaireUploadAuthorization(
  tokenValue,
  { episodeId, now = new Date(), secret } = {}
) {
  const token = cleanText(tokenValue, 20000);
  const parts = token.split('.');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new GuestQuestionnaireUploadError(
      'The guest upload authorization is invalid.',
      'GUEST_UPLOAD_AUTHORIZATION_INVALID'
    );
  }
  const expectedSignature = signAuthorization(parts[0], secret);
  if (!timingSafeEqual(parts[1], expectedSignature)) {
    throw new GuestQuestionnaireUploadError(
      'The guest upload authorization is invalid.',
      'GUEST_UPLOAD_AUTHORIZATION_INVALID'
    );
  }
  let payload;
  try {
    payload = JSON.parse(
      Buffer.from(parts[0], 'base64url').toString('utf8')
    );
  } catch {
    throw new GuestQuestionnaireUploadError(
      'The guest upload authorization is invalid.',
      'GUEST_UPLOAD_AUTHORIZATION_INVALID'
    );
  }
  const expectedEpisodeId = safeId(episodeId);
  const slot = getGuestQuestionnaireUploadSlot(payload?.slot_key);
  const issuedAt = Number(payload?.issued_at);
  const expiresAt = Number(payload?.expires_at);
  if (
    payload?.v !== AUTHORIZATION_VERSION ||
    payload?.purpose !== AUTHORIZATION_PURPOSE ||
    !expectedEpisodeId ||
    payload?.episode_id !== expectedEpisodeId ||
    payload?.deliverable_id !== slot.deliverable_id ||
    !/^[a-f0-9]{64}$/i.test(cleanText(payload?.link_token_hash, 128)) ||
    !safeId(payload?.uploader_person_id) ||
    !cleanText(payload?.asset_id, 180) ||
    !cleanText(payload?.episode_upload_token, 12000) ||
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now.getTime() ||
    issuedAt > now.getTime() + 5 * 60 * 1000 ||
    expiresAt <= issuedAt ||
    expiresAt - issuedAt > MAX_AUTHORIZATION_LIFETIME_MS
  ) {
    throw new GuestQuestionnaireUploadError(
      'The guest upload authorization is invalid or expired.',
      'GUEST_UPLOAD_AUTHORIZATION_INVALID'
    );
  }
  return {
    ...payload,
    slot_key: slot.key,
    episode_id: expectedEpisodeId,
    uploader_person_id: safeId(payload.uploader_person_id),
    asset_id: cleanText(payload.asset_id, 180),
    episode_upload_token: cleanText(
      payload.episode_upload_token,
      12000
    ),
    issued_at: issuedAt,
    expires_at: expiresAt,
  };
}

export function assertGuestUploadMatchesEpisodeAuthorization(
  guestAuthorizationValue,
  episodeAuthorizationValue
) {
  const guest = plainObject(guestAuthorizationValue);
  const episode = plainObject(episodeAuthorizationValue);
  const slot = getGuestQuestionnaireUploadSlot(guest.slot_key);
  if (
    episode.episode_id !== guest.episode_id ||
    episode.uploader_person_id !== guest.uploader_person_id ||
    episode.deliverable_id !== slot.deliverable_id ||
    episode.asset_id !== guest.asset_id ||
    episode.category !== slot.category
  ) {
    throw new GuestQuestionnaireUploadError(
      'The guest upload authorization does not match the uploaded file.',
      'GUEST_UPLOAD_AUTHORIZATION_MISMATCH'
    );
  }
  return { guest, episode, slot };
}

export function getGuestQuestionnaireSlotAssets(
  questionnaireValue,
  slotKeyValue
) {
  const slot = getGuestQuestionnaireUploadSlot(slotKeyValue);
  const responseSlot = plainObject(
    questionnaireValue?.response?.upload_slots?.[slot.key]
  );
  const assets =
    slot.key === 'resume'
      ? [responseSlot.asset].filter(Boolean)
      : Array.isArray(responseSlot.assets)
        ? responseSlot.assets
        : [responseSlot.asset].filter(Boolean);
  return assets
    .filter((asset) => plainObject(asset).asset_id)
    .slice(0, slot.max_files);
}

export function sanitizeGuestQuestionnaireUploadAsset(assetValue = {}) {
  const asset = plainObject(assetValue);
  const status = ['pending', 'uploaded', 'rejected'].includes(asset.status)
    ? asset.status
    : 'uploaded';
  return {
    asset_id: cleanText(asset.asset_id, 180),
    status,
    file_name: cleanText(asset.file_name, 300),
    content_type: cleanText(asset.content_type, 160),
    size_bytes: Math.max(
      0,
      Math.trunc(Number(asset.size_bytes ?? asset.size) || 0)
    ),
    uploaded_at: cleanText(asset.uploaded_at, 60),
  };
}

export function sanitizeGuestQuestionnaireUploadSlot(
  questionnaireValue,
  slotKeyValue
) {
  const slot = getGuestQuestionnaireUploadSlot(slotKeyValue);
  const assets = getGuestQuestionnaireSlotAssets(
    questionnaireValue,
    slot.key
  ).map(sanitizeGuestQuestionnaireUploadAsset);
  const status = assets.some((asset) => asset.status === 'uploaded')
    ? 'uploaded'
    : assets.some((asset) => asset.status === 'pending')
      ? 'pending'
      : assets.some((asset) => asset.status === 'rejected')
        ? 'rejected'
        : 'not_provided';
  return {
    status,
    count: assets.filter((asset) => asset.status === 'uploaded').length,
    ...(slot.key === 'resume'
      ? { asset: assets[0] || null }
      : { assets }),
  };
}
