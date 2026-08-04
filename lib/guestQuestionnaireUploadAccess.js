import {
  getGuestQuestionnaireBearerToken,
  isGuestQuestionnairePublicAccessAllowed,
  verifyGuestQuestionnaireToken,
} from './guestQuestionnaireToken.mjs';
import {
  consumeGuestQuestionnaireRateLimit,
  getGuestQuestionnaireClientAddress,
} from './guestQuestionnaireRateLimit.mjs';
import { getGuestQuestionnaire } from './guestQuestionnaireStore.js';
import { getEpisodeStudio } from './episodeStudioStore.js';

export class GuestQuestionnaireUploadApiError extends Error {
  constructor(
    message,
    { status = 400, code = 'GUEST_QUESTIONNAIRE_UPLOAD_INVALID' } = {}
  ) {
    super(message);
    this.name = 'GuestQuestionnaireUploadApiError';
    this.status = status;
    this.code = code;
  }
}

function rateLimitOptions(action) {
  if (action === 'presign') {
    return { limit: 24, windowMs: 15 * 60 * 1000 };
  }
  if (action === 'complete') {
    return { limit: 36, windowMs: 15 * 60 * 1000 };
  }
  return { limit: 24, windowMs: 15 * 60 * 1000 };
}

export function sendGuestQuestionnaireUploadError(res, error) {
  const status = Number(error?.status) || 500;
  const code = String(
    error?.code || 'GUEST_QUESTIONNAIRE_UPLOAD_FAILED'
  );
  return res.status(status).json({
    ok: false,
    code,
    error:
      status >= 500
        ? 'The guest upload service is temporarily unavailable. Please try again.'
        : String(error?.message || 'The guest upload could not be completed.'),
  });
}

export async function requireGuestQuestionnaireUploadAccess(
  req,
  res,
  { action = 'presign', allowSubmitted = false } = {}
) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  const token = getGuestQuestionnaireBearerToken(req);
  if (!token) {
    throw new GuestQuestionnaireUploadApiError(
      'This guest questionnaire link is invalid or expired.',
      { status: 401, code: 'GUEST_QUESTIONNAIRE_LINK_INVALID' }
    );
  }
  const rateLimit = consumeGuestQuestionnaireRateLimit({
    token,
    address: getGuestQuestionnaireClientAddress(req),
    action: `upload_${action}`,
    ...rateLimitOptions(action),
  });
  res.setHeader('X-RateLimit-Limit', String(rateLimit.limit));
  res.setHeader('X-RateLimit-Remaining', String(rateLimit.remaining));
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retry_after_seconds));
    throw new GuestQuestionnaireUploadApiError(
      'Too many upload attempts. Wait a few minutes and try again.',
      { status: 429, code: 'GUEST_UPLOAD_RATE_LIMITED' }
    );
  }

  let tokenPayload;
  try {
    tokenPayload = verifyGuestQuestionnaireToken(token);
  } catch (error) {
    const configuration = /not configured securely/i.test(
      String(error?.message || '')
    );
    throw new GuestQuestionnaireUploadApiError(
      configuration
        ? 'Guest questionnaire uploads are not configured.'
        : 'This guest questionnaire link is invalid or expired.',
      {
        status: configuration ? 503 : 401,
        code: configuration
          ? 'GUEST_UPLOAD_NOT_CONFIGURED'
          : 'GUEST_QUESTIONNAIRE_LINK_INVALID',
      }
    );
  }

  let result;
  let episodeResult;
  try {
    [result, episodeResult] = await Promise.all([
      getGuestQuestionnaire(tokenPayload.episode_id),
      getEpisodeStudio(tokenPayload.episode_id),
    ]);
  } catch {
    throw new GuestQuestionnaireUploadApiError(
      'Guest questionnaire storage is unavailable.',
      { status: 503, code: 'GUEST_UPLOAD_STORAGE_UNAVAILABLE' }
    );
  }
  if (!result.configured || !episodeResult.configured) {
    throw new GuestQuestionnaireUploadApiError(
      'Guest questionnaire storage is not configured.',
      { status: 503, code: 'GUEST_UPLOAD_NOT_CONFIGURED' }
    );
  }
  const questionnaire = result.questionnaire;
  const episode = episodeResult.episode;
  if (
    !questionnaire ||
    !episode ||
    !isGuestQuestionnairePublicAccessAllowed({
      tokenPayload,
      record: questionnaire,
      episode,
      now: new Date(),
    })
  ) {
    throw new GuestQuestionnaireUploadApiError(
      'This guest questionnaire is no longer available.',
      { status: 410, code: 'GUEST_QUESTIONNAIRE_UNAVAILABLE' }
    );
  }
  if (!allowSubmitted && questionnaire.response.status === 'submitted') {
    throw new GuestQuestionnaireUploadApiError(
      'This questionnaire has already been submitted, so its files are locked.',
      { status: 409, code: 'GUEST_UPLOADS_LOCKED' }
    );
  }
  return { token, tokenPayload, questionnaire, episode };
}
