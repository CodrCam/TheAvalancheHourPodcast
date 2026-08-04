import {
  createEpisodeAssetDownloadUrl,
  deleteEpisodeAssetObject,
  sealEpisodeAssetObjectKey,
  shouldRestoreEpisodeAssetMetadataAfterDeleteError,
} from '../../../../lib/episodeAssetStorage.js';
import {
  normalizeEpisodeStudio,
  removeEpisodeAssetFromEpisode,
} from '../../../../lib/episodeStudioPresentation.mjs';
import { restoreEpisodeAssetDeletionMetadata } from '../../../../lib/episodeAssetDeletionRecovery.mjs';
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
  getConfiguredGuestQuestionnaireUploadSlot,
  getGuestQuestionnaireSlotAssets,
  GuestQuestionnaireUploadError,
  isGuestQuestionnaireUploaderId,
  sanitizeGuestQuestionnaireUploadSlot,
} from '../../../../lib/guestQuestionnaireUploadPolicy.mjs';
import {
  isGuestQuestionnaireUploadVersionConflict,
  saveGuestQuestionnaireUploadCompletion,
} from '../../../../lib/guestQuestionnaireUploadStore.js';

const MAX_SAVE_ATTEMPTS = 3;

export const config = {
  api: { bodyParser: { sizeLimit: '16kb' } },
};

function cleanAssetId(value) {
  return String(value || '').trim().slice(0, 180);
}

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
  const configuration = /not configured/i.test(message);
  const unconfirmed =
    error?.code === 'EPISODE_ASSET_DELETE_UNCONFIRMED';
  const storage =
    unconfirmed || /secure storage could not delete/i.test(message);
  const invalidObject = /Episode asset:/i.test(message);
  return new GuestQuestionnaireUploadApiError(
    configuration
      ? 'Guest file storage is not configured.'
      : storage
        ? unconfirmed
          ? 'The file was detached, but secure storage could not confirm final removal. Ask the episode team for help.'
          : 'Secure storage could not remove this file. It remains attached.'
        : invalidObject
          ? 'This file is missing its verified storage record and cannot be removed safely.'
        : 'The guest file could not be removed.',
    {
      status: configuration
        ? 503
        : storage
          ? 502
          : invalidObject
            ? 409
            : 500,
      code: configuration
        ? 'GUEST_UPLOAD_NOT_CONFIGURED'
        : storage
          ? unconfirmed
            ? 'GUEST_UPLOAD_STORAGE_DELETE_UNCONFIRMED'
            : 'GUEST_UPLOAD_STORAGE_DELETE_FAILED'
          : invalidObject
            ? 'GUEST_UPLOAD_STORAGE_RECORD_INVALID'
          : 'GUEST_UPLOAD_DELETE_FAILED',
    }
  );
}

function assertCurrentGuestAccess(questionnaire, episode, tokenPayload) {
  if (
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

async function restoreDeletedAsset({
  questionnaire,
  episode,
  beforeDeletion,
  afterDeletion,
  slotKey,
  slotAssets,
  asset,
}) {
  const originalQuestionnaireAsset = slotAssets.find(
    (candidate) => candidate.asset_id === asset.asset_id
  );
  if (!originalQuestionnaireAsset) {
    throw new Error('Guest questionnaire asset metadata could not be restored.');
  }
  let currentQuestionnaire = questionnaire;
  let currentEpisode = episode;
  for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt += 1) {
    const currentSlotAssets = getGuestQuestionnaireSlotAssets(
      currentQuestionnaire,
      slotKey
    );
    const restoredQuestionnaire = mergeGuestQuestionnaireUploadSlot(
      currentQuestionnaire,
      {
        slotKey,
        assets: currentSlotAssets.some(
          (candidate) => candidate.asset_id === asset.asset_id
        )
          ? currentSlotAssets
          : [...currentSlotAssets, originalQuestionnaireAsset],
      }
    );
    const restoredEpisode = restoreEpisodeAssetDeletionMetadata(
      currentEpisode,
      {
        beforeDeletion,
        afterDeletion,
        assetId: asset.asset_id,
      }
    );
    try {
      return await saveGuestQuestionnaireUploadCompletion(
        {
          questionnaire: restoredQuestionnaire,
          episode: restoredEpisode,
        },
        {
          expectedQuestionnaireUpdatedAt: currentQuestionnaire.updated_at,
          expectedEpisodeUpdatedAt: currentEpisode.updated_at,
          now: new Date(),
        }
      );
    } catch (restoreError) {
      if (
        !isGuestQuestionnaireUploadVersionConflict(restoreError) ||
        attempt === MAX_SAVE_ATTEMPTS - 1
      ) {
        throw restoreError;
      }
      const [latestQuestionnaire, latestEpisode] = await Promise.all([
        getGuestQuestionnaire(currentEpisode.episode_id),
        getEpisodeStudio(currentEpisode.episode_id),
      ]);
      if (!latestQuestionnaire.questionnaire || !latestEpisode.episode) {
        throw restoreError;
      }
      currentQuestionnaire = latestQuestionnaire.questionnaire;
      currentEpisode = latestEpisode.episode;
    }
  }
  throw new Error('Guest questionnaire asset metadata could not be restored.');
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (req.method !== 'DELETE') {
    res.setHeader('Allow', 'DELETE');
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
      action: 'delete',
    });
    const assetId = cleanAssetId(req.query.assetId);
    if (!assetId) {
      throw new GuestQuestionnaireUploadApiError(
        'Choose a guest file to remove.',
        { status: 400, code: 'GUEST_UPLOAD_ASSET_INVALID' }
      );
    }
    let questionnaire = access.questionnaire;
    let episode = access.episode;
    let removedAsset = null;
    let priorSlotAssets = [];
    let priorEpisode = null;
    let saved = null;
    let slotKey = '';
    let uploadLocationSealed = false;

    for (let attempt = 0; attempt < MAX_SAVE_ATTEMPTS; attempt += 1) {
      assertCurrentGuestAccess(
        questionnaire,
        episode,
        access.tokenPayload
      );
      const configuredSlot = getConfiguredGuestQuestionnaireUploadSlot(
        questionnaire,
        req.body?.slot_key
      );
      slotKey = configuredSlot.key;
      const currentSlotAssets = getGuestQuestionnaireSlotAssets(
        questionnaire,
        slotKey
      );
      const questionnaireAsset = currentSlotAssets.find(
        (asset) => asset.asset_id === assetId
      );
      const episodeAsset = episode.assets.find(
        (asset) => asset.asset_id === assetId
      );
      if (!questionnaireAsset || !episodeAsset) {
        throw new GuestQuestionnaireUploadApiError(
          'This guest file is no longer available.',
          { status: 404, code: 'GUEST_UPLOAD_ASSET_NOT_FOUND' }
        );
      }
      if (
        !isGuestQuestionnaireUploaderId(
          episodeAsset.uploaded_by_person_id
        ) ||
        episodeAsset.deliverable_id !== configuredSlot.deliverable_id ||
        episodeAsset.category !== configuredSlot.category
      ) {
        throw new GuestQuestionnaireUploadApiError(
          'This guest link cannot remove that file.',
          { status: 403, code: 'GUEST_UPLOAD_DELETE_FORBIDDEN' }
        );
      }

      // Validate the exact immutable object reference before changing either
      // database record. The URL is intentionally discarded and never sent.
      createEpisodeAssetDownloadUrl(episodeAsset.object_key, {
        episodeId: access.tokenPayload.episode_id,
        fileName: episodeAsset.file_name,
        versionId: episodeAsset.object_version_id,
      });
      if (!uploadLocationSealed) {
        await sealEpisodeAssetObjectKey(episodeAsset.object_key, {
          episodeId: access.tokenPayload.episode_id,
        });
        uploadLocationSealed = true;
      }
      const remainingSlotAssets = currentSlotAssets.filter(
        (asset) => asset.asset_id !== assetId
      );
      const mergedQuestionnaire = mergeGuestQuestionnaireUploadSlot(
        questionnaire,
        { slotKey, assets: remainingSlotAssets }
      );
      const now = new Date();
      const nextQuestionnaire = {
        ...mergedQuestionnaire,
        response: {
          ...mergedQuestionnaire.response,
          updated_at: now.toISOString(),
        },
      };
      const removedAt = now.toISOString();
      const detachedEpisode = removeEpisodeAssetFromEpisode(
        episode,
        assetId,
        {
          personName: 'Guest questionnaire',
          updatedAt: removedAt,
        }
      );
      const priorPhotoSelection = episode.deliverables?.find(
        (deliverable) => deliverable.id === 'photos'
      )?.photo_selection;
      const nextPhotoSelection = detachedEpisode.deliverables?.find(
        (deliverable) => deliverable.id === 'photos'
      )?.photo_selection;
      const photoSelectionChanged =
        JSON.stringify(priorPhotoSelection || {}) !==
        JSON.stringify(nextPhotoSelection || {});
      const nextEpisode = photoSelectionChanged
        ? normalizeEpisodeStudio({
            ...detachedEpisode,
            production_workflow_updated_at: removedAt,
            production_workflow_updated_by_person_id: '',
            production_workflow_updated_by_name: 'Guest questionnaire',
          })
        : detachedEpisode;

      try {
        saved = await saveGuestQuestionnaireUploadCompletion(
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
        removedAsset = episodeAsset;
        priorSlotAssets = currentSlotAssets;
        priorEpisode = episode;
        break;
      } catch (saveError) {
        if (
          !isGuestQuestionnaireUploadVersionConflict(saveError) ||
          attempt === MAX_SAVE_ATTEMPTS - 1
        ) {
          if (isGuestQuestionnaireUploadVersionConflict(saveError)) {
            throw new GuestQuestionnaireUploadApiError(
              'The questionnaire changed while the file was being removed. Refresh and try again.',
              { status: 409, code: 'GUEST_UPLOAD_DELETE_RACE' }
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

    if (!saved || !removedAsset) {
      throw new GuestQuestionnaireUploadApiError(
        'The questionnaire changed while the file was being removed. Refresh and try again.',
        { status: 409, code: 'GUEST_UPLOAD_DELETE_RACE' }
      );
    }
    try {
      await deleteEpisodeAssetObject(removedAsset.object_key, {
        episodeId: access.tokenPayload.episode_id,
        versionId: removedAsset.object_version_id,
      });
    } catch (storageError) {
      try {
        if (shouldRestoreEpisodeAssetMetadataAfterDeleteError(storageError)) {
          await restoreDeletedAsset({
            questionnaire: saved.questionnaire,
            episode: saved.episode,
            beforeDeletion: priorEpisode,
            afterDeletion: saved.episode,
            slotKey,
            slotAssets: priorSlotAssets,
            asset: removedAsset,
          });
        }
      } catch (restoreError) {
        console.error(
          'guest questionnaire asset delete rollback failed:',
          restoreError
        );
      }
      throw storageError;
    }

    return res.status(200).json({
      ok: true,
      deleted_asset_id: removedAsset.asset_id,
      slot: sanitizeGuestQuestionnaireUploadSlot(
        saved.questionnaire,
        slotKey
      ),
    });
  } catch (error) {
    return sendGuestQuestionnaireUploadError(res, requestError(error));
  }
}
