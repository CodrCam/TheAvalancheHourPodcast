import {
  createEpisodeAssetUpload,
  isEpisodeAssetStorageConfigured,
} from '../../../../lib/episodeAssetStorage.js';
import { recordEpisodeAssetUploadGrant } from '../../../../lib/episodeAssetGrantLifecycle.mjs';
import { saveGuestQuestionnaireWithEpisode } from '../../../../lib/guestQuestionnaireStore.js';
import {
  findDuplicateEpisodeAsset,
  MAX_EPISODE_ASSETS,
} from '../../../../lib/episodeAssetPolicy.mjs';
import {
  GuestQuestionnaireUploadApiError,
  requireGuestQuestionnaireUploadAccess,
  sendGuestQuestionnaireUploadError,
} from '../../../../lib/guestQuestionnaireUploadAccess.js';
import {
  createGuestQuestionnaireUploadAuthorization,
  deriveGuestQuestionnaireUploaderId,
  getConfiguredGuestQuestionnaireUploadSlot,
  getGuestQuestionnaireSlotAssets,
  GuestQuestionnaireUploadError,
  validateGuestQuestionnaireUploadFile,
} from '../../../../lib/guestQuestionnaireUploadPolicy.mjs';
import { authorizeGuestQuestionnaireUploadBudget } from '../../../../lib/guestQuestionnaireUploadBudget.mjs';

const GUEST_UPLOAD_EXPIRY_SECONDS = 15 * 60;
const GUEST_COMPLETION_EXPIRY_SECONDS = 60 * 60;

export const config = {
  api: { bodyParser: { sizeLimit: '32kb' } },
};

function requestError(error) {
  if (error instanceof GuestQuestionnaireUploadApiError) return error;
  if (error instanceof GuestQuestionnaireUploadError) {
    return new GuestQuestionnaireUploadApiError(error.message, {
      status:
        error.code === 'GUEST_UPLOAD_SLOT_NOT_AVAILABLE' ? 409 : 400,
      code: error.code,
    });
  }
  if (/conditional|transaction cancelled/i.test(String(error?.message || ''))) {
    return new GuestQuestionnaireUploadApiError(
      'The Episode Studio changed while the upload was being authorized. Try again.',
      {
        status: 409,
        code: 'GUEST_UPLOAD_STUDIO_CHANGED',
      }
    );
  }
  const configuration = /not configured/i.test(
    String(error?.message || '')
  );
  return new GuestQuestionnaireUploadApiError(
    configuration
      ? 'Guest questionnaire uploads are not configured.'
      : 'The guest upload could not be authorized.',
    {
      status: configuration ? 503 : 500,
      code: configuration
        ? 'GUEST_UPLOAD_NOT_CONFIGURED'
        : 'GUEST_UPLOAD_PRESIGN_FAILED',
    }
  );
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!req.headers['content-type']?.includes('application/json')) {
    return res.status(400).json({
      ok: false,
      code: 'GUEST_UPLOAD_CONTENT_TYPE_INVALID',
      error: 'Content-Type must be application/json.',
    });
  }

  try {
    const access = await requireGuestQuestionnaireUploadAccess(req, res, {
      action: 'presign',
    });
    const configuredSlot = getConfiguredGuestQuestionnaireUploadSlot(
      access.questionnaire,
      req.body?.slot_key
    );
    const currentAssets = getGuestQuestionnaireSlotAssets(
      access.questionnaire,
      configuredSlot.key
    );
    if (currentAssets.length >= configuredSlot.max_count) {
      throw new GuestQuestionnaireUploadApiError(
        `This upload field already has its maximum of ${configuredSlot.max_count} file${
          configuredSlot.max_count === 1 ? '' : 's'
        }. Remove a file before adding another.`,
        { status: 409, code: 'GUEST_UPLOAD_SLOT_FULL' }
      );
    }

    const episode = access.episode;
    const deliverable = episode.deliverables.find(
      (item) => item.id === configuredSlot.deliverable_id
    );
    if (
      !deliverable ||
      deliverable.asset_category !== configuredSlot.category
    ) {
      throw new GuestQuestionnaireUploadApiError(
        'This upload field is not connected to the current Episode Studio.',
        { status: 409, code: 'GUEST_UPLOAD_STEP_UNAVAILABLE' }
      );
    }
    if (episode.assets.length >= MAX_EPISODE_ASSETS) {
      throw new GuestQuestionnaireUploadApiError(
        'This episode has reached its secure file limit.',
        { status: 409, code: 'EPISODE_ASSET_LIMIT_REACHED' }
      );
    }

    const file = validateGuestQuestionnaireUploadFile(
      configuredSlot.key,
      req.body?.file
    );
    const duplicate = findDuplicateEpisodeAsset(episode.assets, {
      ...file,
      deliverable_id: configuredSlot.deliverable_id,
    });
    if (duplicate) {
      throw new GuestQuestionnaireUploadApiError(
        `“${file.file_name}” is already attached to this episode.`,
        { status: 409, code: 'GUEST_UPLOAD_DUPLICATE' }
      );
    }
    if (!isEpisodeAssetStorageConfigured()) {
      throw new GuestQuestionnaireUploadApiError(
        'Guest file storage is not configured.',
        { status: 503, code: 'GUEST_UPLOAD_NOT_CONFIGURED' }
      );
    }

    const uploaderPersonId = deriveGuestQuestionnaireUploaderId({
      episodeId: access.tokenPayload.episode_id,
      linkTokenHash: access.tokenPayload.token_jti_hash,
    });
    const budgetAuthorization = authorizeGuestQuestionnaireUploadBudget(
      access.questionnaire.upload_budget,
      {
        linkTokenHash: access.tokenPayload.token_jti_hash,
        sizeBytes: file.size,
      }
    );
    if (!budgetAuthorization.allowed) {
      throw new GuestQuestionnaireUploadApiError(
        budgetAuthorization.reason,
        { status: 429, code: 'GUEST_UPLOAD_LINK_ALLOWANCE_REACHED' }
      );
    }
    const episodeUpload = createEpisodeAssetUpload({
      episodeId: access.tokenPayload.episode_id,
      uploaderPersonId,
      deliverableId: configuredSlot.deliverable_id,
      file,
      uploadExpirySeconds: GUEST_UPLOAD_EXPIRY_SECONDS,
      completionExpirySeconds: GUEST_COMPLETION_EXPIRY_SECONDS,
    });
    const uploadToken = createGuestQuestionnaireUploadAuthorization({
      episodeId: access.tokenPayload.episode_id,
      slotKey: configuredSlot.key,
      linkTokenHash: access.tokenPayload.token_jti_hash,
      uploaderPersonId,
      assetUpload: episodeUpload,
    });
    await saveGuestQuestionnaireWithEpisode(
      {
        questionnaire: {
          ...access.questionnaire,
          upload_budget: budgetAuthorization.budget,
        },
        episode: recordEpisodeAssetUploadGrant(
          episode,
          episodeUpload.expires_at
        ),
      },
      {
        expectedQuestionnaireUpdatedAt: access.questionnaire.updated_at,
        expectedEpisodeUpdatedAt: episode.updated_at,
      }
    );

    return res.status(200).json({
      ok: true,
      upload: {
        asset_id: episodeUpload.asset_id,
        slot_key: configuredSlot.key,
        file_name: episodeUpload.file_name,
        content_type: episodeUpload.content_type,
        size: episodeUpload.size,
        upload_url: episodeUpload.upload_url,
        upload_method: episodeUpload.upload_method,
        upload_headers: episodeUpload.upload_headers,
        expires_at: episodeUpload.expires_at,
        completion_expires_at: episodeUpload.completion_expires_at,
        upload_token: uploadToken,
      },
    });
  } catch (error) {
    return sendGuestQuestionnaireUploadError(res, requestError(error));
  }
}
