const MEBIBYTE = 1024 * 1024;

export const GUEST_UPLOAD_MAX_GRANTS_PER_LINK = 20;
export const GUEST_UPLOAD_MAX_AUTHORIZED_BYTES_PER_LINK = 400 * MEBIBYTE;

function cleanLinkHash(value) {
  const hash = String(value || '').trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(hash) ? hash : '';
}

function cleanIsoDate(value) {
  const parsed = new Date(String(value || '').trim());
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

export function normalizeGuestQuestionnaireUploadBudget(value = {}) {
  return {
    link_token_hash: cleanLinkHash(value?.link_token_hash),
    issued_count: Math.max(
      0,
      Math.min(
        GUEST_UPLOAD_MAX_GRANTS_PER_LINK,
        Math.trunc(Number(value?.issued_count) || 0)
      )
    ),
    issued_bytes: Math.max(
      0,
      Math.min(
        GUEST_UPLOAD_MAX_AUTHORIZED_BYTES_PER_LINK,
        Math.trunc(Number(value?.issued_bytes) || 0)
      )
    ),
    updated_at: cleanIsoDate(value?.updated_at),
  };
}

export function authorizeGuestQuestionnaireUploadBudget(
  value = {},
  { linkTokenHash = '', sizeBytes = 0, now = new Date() } = {}
) {
  const activeHash = cleanLinkHash(linkTokenHash);
  const size = Math.trunc(Number(sizeBytes));
  if (!activeHash || !Number.isFinite(size) || size <= 0) {
    throw new Error('Guest upload budget: authorization input is invalid.');
  }
  const normalized = normalizeGuestQuestionnaireUploadBudget(value);
  const current =
    normalized.link_token_hash === activeHash
      ? normalized
      : {
          link_token_hash: activeHash,
          issued_count: 0,
          issued_bytes: 0,
          updated_at: '',
        };
  const nextCount = current.issued_count + 1;
  const nextBytes = current.issued_bytes + size;
  if (
    nextCount > GUEST_UPLOAD_MAX_GRANTS_PER_LINK ||
    nextBytes > GUEST_UPLOAD_MAX_AUTHORIZED_BYTES_PER_LINK
  ) {
    return {
      allowed: false,
      budget: current,
      reason:
        'This private link has reached its secure upload allowance. Ask the producer for a refreshed link before adding more files.',
    };
  }
  return {
    allowed: true,
    budget: {
      link_token_hash: activeHash,
      issued_count: nextCount,
      issued_bytes: nextBytes,
      updated_at: new Date(now).toISOString(),
    },
    reason: '',
  };
}

export function resetGuestQuestionnaireUploadBudget(linkTokenHash = '') {
  return {
    link_token_hash: cleanLinkHash(linkTokenHash),
    issued_count: 0,
    issued_bytes: 0,
    updated_at: '',
  };
}
