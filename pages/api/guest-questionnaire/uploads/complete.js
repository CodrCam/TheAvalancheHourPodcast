import {
  deleteEpisodeAssetObject,
  sealEpisodeAssetObjectKey,
  verifyEpisodeAssetContentSignature,
  verifyEpisodeAssetObject,
  verifyEpisodeAssetUploadToken,
} from '../../../../lib/episodeAssetStorage.js';
import {
  episodeAssetMatchesUploadAuthorization,
  findDuplicateEpisodeAsset,
  MAX_EPISODE_ASSETS,
} from '../../../../lib/episodeAssetPolicy.mjs';
import {
  EPISODE_ASSET_RETENTION_DAYS,
  getEpisodeAssetRetentionExpiresAt,
  normalizeEpisodeStudio,
} from '../../../../lib/episodeStudioPresentation.mjs';
import { getEpisodeStudio } from '../../../../lib/episodeStudioStore.js';
import {
  mergeGuestQuestionnaireUploadSlot,
} from '../../../../lib/guestQuestionnairePresentation.mjs';
import { getGuestQuestionnaire } from '../../../../lib/guestQuestionnaireStore.js';
import {
  isGuestQuestionnairePublicAccessAllowed,
} from '../../../../lib/guestQuestionnaireToken.mjs';
import {
  GuestQuestionnaireUploadApiError,
  requireGuestQuestionnaireUploadAccess,
  sendGuestQuestionnaireUploadError,
} from '../../../../lib/guestQuestionnaireUploadAccess.js';
import {
  assertGuestUploadMatchesEpisodeAuthorization,
  deriveGuestQuestionnaireUploaderId,
  getConfiguredGuestQuestionnaireUploadSlot,
  getGuestQuestionnaireSlotAssets,
  GuestQuestionnaireUploadError,
  sanitizeGuestQuestionnaireUploadSlot,
  validateGuestQuestionnaireUploadFile,
  verifyGuestQuestionnaireUploadAuthorization,
} from '../../../../lib/guestQuestionnaireUploadPolicy.mjs';
import {
  isGuestQuestionnaireUploadVersionConflict,
  saveGuestQuestionnaireUploadCompletion,
} from '../../../../lib/guestQuestionnaireUploadStore.js';

const MAX_SAVE_ATTEMPTS = 3;

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
  const message = String(error?.message || '');
  if (/Episode asset:/i.test(message)) {
    return new GuestQuestionnaireUploadApiError(message, {
      status: 400,
      code: 'GUEST_UPLOAD_OBJECT_INVALID',
    });
  }
  const configuration = /not configured/i.test(message);
  return new GuestQuestionnaireUploadApiError(
    configuration
      ? 'Guest file storage is not configured.'
      : 'The guest upload could not be completed.',
    {
      status: configuration ? 503 : 500,
      code: configuration
        ? 'GUEST_UPLOAD_NOT_CONFIGURED'
        : 'GUEST_UPLOAD_COMPLETION_FAILED',
    }
  );
}

function assertCurrentGuestAccess(questionnaire, episode, tokenPayload) {
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
  if (questionnaire.response.status === 'submitted') {
    throw new GuestQuestionnaireUploadApiError(
      'This questionnaire has already been submitted, so its files are locked.',
      { status: 409, code: 'GUEST_UPLOADS_LOCKED' }
    );
  }
}

function assertCurrentEpisodeStep(episode, configuredSlot) {
  if (!episode) {
    throw new GuestQuestionnaireUploadApiError(
      'This questionnaire is no longer connected to an episode.',
      { status: 410, code: 'GUEST_UPLOAD_EPISODE_UNAVAILABLE' }
    );
  }
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
}

async function cleanupVerifiedObject(payload, verifiedObject) {
  if (!payload?.object_key || !verifiedObject?.object_version_id) return;
  try {
    await sealEpisodeAssetObjectKey(payload.object_key, {
      episodeId: payload.episode_id,
    });
    await deleteEpisodeAssetObject(payload.object_key, {
      episodeId: payload.episode_id,
      versionId: verifiedObject.object_version_id,
    });
  } catch (error) {
    console.error('guest questionnaire duplicate upload cleanup failed:', error);
  }
}

function questionnaireAsset(asset) {
  return {
    asset_id: asset.asset_id,
    status: 'uploaded',
    file_name: asset.file_name,
    content_type: asset.content_type,
    size_bytes: asset.size,
    uploaded_at: asset.uploaded_at,
  };
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

  let verifiedObject = null;
  let contentSignatureVerified = false;
  let episodeAuthorization = null;
  try {
    const access = await requireGuestQuestionnaireUploadAccess(req, res, {
      action: 'complete',
    });
    const guestAuthorization =
      verifyGuestQuestionnaireUploadAuthorization(
        req.body?.upload_token,
        { episodeId: access.tokenPayload.episode_id }
      );
    if (
      guestAuthorization.link_token_hash !==
      access.tokenPayload.token_jti_hash
    ) {
      throw new GuestQuestionnaireUploadApiError(
        'This upload authorization belongs to another guest link.',
        { status: 401, code: 'GUEST_UPLOAD_LINK_MISMATCH' }
      );
    }
    const expectedUploaderId = deriveGuestQuestionnaireUploaderId({
      episodeId: access.tokenPayload.episode_id,
      linkTokenHash: access.tokenPayload.token_jti_hash,
    });
    if (guestAuthorization.uploader_person_id !== expectedUploaderId) {
      throw new GuestQuestionnaireUploadApiError(
        'This upload authorization belongs to another guest link.',
        { status: 401, code: 'GUEST_UPLOAD_LINK_MISMATCH' }
      );
    }
    episodeAuthorization = verifyEpisodeAssetUploadToken(
      guestAuthorization.episode_upload_token,
      access.tokenPayload.episode_id
    );
    assertGuestUploadMatchesEpisodeAuthorization(
      guestAuthorization,
      episodeAuthorization
    );
    validateGuestQuestionnaireUploadFile(
      guestAuthorization.slot_key,
      episodeAuthorization
    );

    let questionnaire = access.questionnaire;
    let episode = access.episode;

    for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt += 1) {
      assertCurrentGuestAccess(
        questionnaire,
        episode,
        access.tokenPayload
      );
      const configuredSlot = getConfiguredGuestQuestionnaireUploadSlot(
        questionnaire,
        guestAuthorization.slot_key
      );
      assertCurrentEpisodeStep(episode, configuredSlot);

      const existingEpisodeAsset = episode.assets.find(
        (asset) => asset.asset_id === episodeAuthorization.asset_id
      );
      const currentQuestionnaireAssets = getGuestQuestionnaireSlotAssets(
        questionnaire,
        configuredSlot.key
      );
      const questionnaireAlreadyAttached =
        currentQuestionnaireAssets.some(
          (asset) => asset.asset_id === episodeAuthorization.asset_id
        );
      if (existingEpisodeAsset) {
        if (
          !episodeAssetMatchesUploadAuthorization(
            existingEpisodeAsset,
            episodeAuthorization
          )
        ) {
          throw new GuestQuestionnaireUploadApiError(
            'This upload conflicts with an existing episode file.',
            { status: 409, code: 'GUEST_UPLOAD_COMPLETION_CONFLICT' }
          );
        }
        if (questionnaireAlreadyAttached) {
          return res.status(200).json({
            ok: true,
            already_completed: true,
            slot: sanitizeGuestQuestionnaireUploadSlot(
              questionnaire,
              configuredSlot.key
            ),
          });
        }
      }

      if (
        !existingEpisodeAsset &&
        !questionnaireAlreadyAttached &&
        currentQuestionnaireAssets.length >= configuredSlot.max_count
      ) {
        if (!verifiedObject) {
          verifiedObject = await verifyEpisodeAssetObject(
            episodeAuthorization
          );
        }
        await cleanupVerifiedObject(episodeAuthorization, verifiedObject);
        throw new GuestQuestionnaireUploadApiError(
          `This upload field already has its maximum of ${configuredSlot.max_count} file${
            configuredSlot.max_count === 1 ? '' : 's'
          }.`,
          { status: 409, code: 'GUEST_UPLOAD_SLOT_FULL' }
        );
      }
      if (!existingEpisodeAsset && episode.assets.length >= MAX_EPISODE_ASSETS) {
        if (!verifiedObject) {
          verifiedObject = await verifyEpisodeAssetObject(
            episodeAuthorization
          );
        }
        await cleanupVerifiedObject(episodeAuthorization, verifiedObject);
        throw new GuestQuestionnaireUploadApiError(
          'This episode has reached its secure file limit.',
          { status: 409, code: 'EPISODE_ASSET_LIMIT_REACHED' }
        );
      }

      const duplicate = !existingEpisodeAsset
        ? findDuplicateEpisodeAsset(episode.assets, {
            ...episodeAuthorization,
            deliverable_id: configuredSlot.deliverable_id,
          })
        : null;
      if (duplicate) {
        if (!verifiedObject) {
          verifiedObject = await verifyEpisodeAssetObject(
            episodeAuthorization
          );
        }
        await cleanupVerifiedObject(episodeAuthorization, verifiedObject);
        throw new GuestQuestionnaireUploadApiError(
          `“${episodeAuthorization.file_name}” is already attached to this episode.`,
          {
            status: 409,
            code: 'GUEST_UPLOAD_DUPLICATE',
          }
        );
      }

      if (!verifiedObject && !existingEpisodeAsset) {
        verifiedObject = await verifyEpisodeAssetObject(
          episodeAuthorization
        );
      }
      if (!existingEpisodeAsset && !contentSignatureVerified) {
        try {
          await verifyEpisodeAssetContentSignature(episodeAuthorization, {
            versionId: verifiedObject.object_version_id,
          });
          contentSignatureVerified = true;
        } catch {
          await cleanupVerifiedObject(episodeAuthorization, verifiedObject);
          throw new GuestQuestionnaireUploadApiError(
            'This file does not match its approved resume or photo format. Choose the original file and try again.',
            { status: 400, code: 'GUEST_UPLOAD_SIGNATURE_INVALID' }
          );
        }
      }
      const uploadedAt = existingEpisodeAsset
        ? existingEpisodeAsset.uploaded_at
        : verifiedObject.uploaded_at;
      const asset = existingEpisodeAsset || {
        asset_id: episodeAuthorization.asset_id,
        object_key: episodeAuthorization.object_key,
        object_version_id: verifiedObject.object_version_id,
        file_name: episodeAuthorization.file_name,
        content_type: episodeAuthorization.content_type,
        size: episodeAuthorization.size,
        category: episodeAuthorization.category,
        label: episodeAuthorization.file_name,
        notes: 'Submitted through the private guest questionnaire.',
        deliverable_id: configuredSlot.deliverable_id,
        uploaded_at: uploadedAt,
        uploaded_by_person_id: expectedUploaderId,
        uploaded_by_name: 'Questionnaire guest',
        retention_days: EPISODE_ASSET_RETENTION_DAYS,
        retention_expires_at: getEpisodeAssetRetentionExpiresAt(
          uploadedAt,
          EPISODE_ASSET_RETENTION_DAYS
        ),
        status: 'uploaded',
      };
      const nextSlotAssets = questionnaireAlreadyAttached
        ? currentQuestionnaireAssets
        : [...currentQuestionnaireAssets, questionnaireAsset(asset)];
      const mergedQuestionnaire = mergeGuestQuestionnaireUploadSlot(
        questionnaire,
        {
          slotKey: configuredSlot.key,
          assets: nextSlotAssets,
        }
      );
      const now = new Date();
      const nextQuestionnaire = {
        ...mergedQuestionnaire,
        response: {
          ...mergedQuestionnaire.response,
          updated_at: now.toISOString(),
        },
      };
      const nextEpisode = existingEpisodeAsset
        ? episode
        : normalizeEpisodeStudio({
            ...episode,
            assets: [...episode.assets, asset],
          });

      try {
        const saved = await saveGuestQuestionnaireUploadCompletion(
          {
            questionnaire: nextQuestionnaire,
            episode: nextEpisode,
          },
          {
            expectedQuestionnaireUpdatedAt: questionnaire.updated_at,
            expectedEpisodeUpdatedAt: episode.updated_at,
            now,
          }
        );
        return res.status(existingEpisodeAsset ? 200 : 201).json({
          ok: true,
          already_completed: Boolean(existingEpisodeAsset),
          slot: sanitizeGuestQuestionnaireUploadSlot(
            saved.questionnaire,
            configuredSlot.key
          ),
        });
      } catch (saveError) {
        if (
          !isGuestQuestionnaireUploadVersionConflict(saveError) ||
          attempt === MAX_SAVE_ATTEMPTS - 1
        ) {
          if (isGuestQuestionnaireUploadVersionConflict(saveError)) {
            throw new GuestQuestionnaireUploadApiError(
              'The questionnaire changed while the file was attaching. Refresh and try again.',
              { status: 409, code: 'GUEST_UPLOAD_COMPLETION_RACE' }
            );
          }
          throw saveError;
        }
        const [latestQuestionnaire, latestEpisode] = await Promise.all([
          getGuestQuestionnaire(access.tokenPayload.episode_id),
          getEpisodeStudio(access.tokenPayload.episode_id),
        ]);
        questionnaire = latestQuestionnaire.questionnaire;
        episode = latestEpisode.episode;
      }
    }

    throw new GuestQuestionnaireUploadApiError(
      'The questionnaire changed while the file was attaching. Refresh and try again.',
      { status: 409, code: 'GUEST_UPLOAD_COMPLETION_RACE' }
    );
  } catch (error) {
    return sendGuestQuestionnaireUploadError(res, requestError(error));
  }
}
