import { ADMIN_PERMISSIONS } from '../../../../../../lib/adminAuth';
import { logAdminAction } from '../../../../../../lib/adminAudit';
import {
  createEpisodeAssetDownloadUrl,
  deleteEpisodeAssetObject,
  sealEpisodeAssetObjectKey,
  shouldRestoreEpisodeAssetMetadataAfterDeleteError,
} from '../../../../../../lib/episodeAssetStorage';
import {
  canDeleteEpisodeAsset,
  canReadEpisodeAsset,
} from '../../../../../../lib/episodeAssetPolicy.mjs';
import { restoreEpisodeAssetDeletionMetadata } from '../../../../../../lib/episodeAssetDeletionRecovery.mjs';
import { requireEpisodeStudioAccess } from '../../../../../../lib/episodeStudioAccess';
import { getHostDraftObserverMutationBlocker } from '../../../../../../lib/episodeStudioDraftAccess.mjs';
import {
  isEpisodeAssetExpired,
  removeEpisodeAssetFromEpisode,
  sanitizeEpisodeStudioForViewer,
} from '../../../../../../lib/episodeStudioPresentation.mjs';
import {
  mergeGuestQuestionnaireUploadSlot,
} from '../../../../../../lib/guestQuestionnairePresentation.mjs';
import {
  getEpisodeStudio,
  saveEpisodeStudio,
} from '../../../../../../lib/episodeStudioStore';
import {
  getGuestQuestionnaire,
} from '../../../../../../lib/guestQuestionnaireStore';
import {
  getGuestQuestionnaireSlotAssets,
} from '../../../../../../lib/guestQuestionnaireUploadPolicy.mjs';
import {
  isGuestQuestionnaireUploadVersionConflict,
  saveGuestQuestionnaireUploadCompletion,
} from '../../../../../../lib/guestQuestionnaireUploadStore';
import {
  publishEpisodeNotifications,
} from '../../../../../../lib/episodeStudioEvents';
import {
  canCreateEpisodeAssetThumbnail,
  createEpisodeAssetThumbnail,
  getOrCreateEpisodeAssetThumbnail,
  readEpisodeAssetThumbnailSource,
} from '../../../../../../lib/episodeAssetThumbnail';

const MAX_METADATA_SAVE_ATTEMPTS = 3;

function removeEpisodeAssetWithWorkflowAudit(
  episode,
  assetId,
  { personId = '', personName = '', updatedAt = '' } = {}
) {
  const updated = removeEpisodeAssetFromEpisode(episode, assetId, {
    personId,
    personName,
    updatedAt,
  });
  const workflowChanged =
    JSON.stringify(updated.production_tasks || []) !==
      JSON.stringify(episode.production_tasks || []) ||
    JSON.stringify(
      updated.deliverables?.find((item) => item.id === 'photos')
        ?.photo_selection || {}
    ) !==
      JSON.stringify(
        episode.deliverables?.find((item) => item.id === 'photos')
          ?.photo_selection || {}
      );
  return workflowChanged
    ? {
        ...updated,
        production_workflow_updated_at: updatedAt,
        production_workflow_updated_by_person_id: personId,
        production_workflow_updated_by_name: personName,
      }
    : updated;
}

function questionnaireSlotForAsset(questionnaire, assetId) {
  return (questionnaire?.upload_slots || []).find((slot) =>
    getGuestQuestionnaireSlotAssets(questionnaire, slot.key).some(
      (candidate) => candidate.asset_id === assetId
    )
  );
}

function questionnaireUpdateLocksAsset(questionnaire, assetId) {
  return Boolean(
    questionnaire?.response?.status === 'update_requested' &&
      questionnaireSlotForAsset(questionnaire, assetId)
  );
}

async function saveAssetMetadataRemoval({
  episode,
  questionnaire,
  assetId,
  personId,
  personName,
  updatedAt,
}) {
  const nextEpisode = removeEpisodeAssetWithWorkflowAudit(episode, assetId, {
    personId,
    personName,
    updatedAt,
  });
  const questionnaireSlot = questionnaireSlotForAsset(
    questionnaire,
    assetId
  );
  if (!questionnaire || !questionnaireSlot) {
    return saveEpisodeStudio(nextEpisode, {
      expectedUpdatedAt: episode.updated_at,
    });
  }

  const remainingAssets = getGuestQuestionnaireSlotAssets(
    questionnaire,
    questionnaireSlot.key
  ).filter((candidate) => candidate.asset_id !== assetId);
  const mergedQuestionnaire = mergeGuestQuestionnaireUploadSlot(
    questionnaire,
    {
      slotKey: questionnaireSlot.key,
      assets: remainingAssets,
    }
  );
  return saveGuestQuestionnaireUploadCompletion(
    {
      episode: nextEpisode,
      questionnaire: {
        ...mergedQuestionnaire,
        response: {
          ...mergedQuestionnaire.response,
          updated_at: updatedAt,
        },
      },
    },
    {
      expectedEpisodeUpdatedAt: episode.updated_at,
      expectedQuestionnaireUpdatedAt: questionnaire.updated_at,
      now: new Date(updatedAt),
    }
  );
}

async function restoreAssetMetadataRemoval({
  saved,
  priorEpisode,
  priorQuestionnaire,
  questionnaireIncluded,
  assetId,
}) {
  let currentEpisode = saved.episode;
  let currentQuestionnaire = saved.questionnaire || null;
  for (let attempt = 0; attempt < MAX_METADATA_SAVE_ATTEMPTS; attempt += 1) {
    const restoredEpisode = restoreEpisodeAssetDeletionMetadata(
      currentEpisode,
      {
        beforeDeletion: priorEpisode,
        afterDeletion: saved.episode,
        assetId,
      }
    );
    try {
      if (
        questionnaireIncluded &&
        currentQuestionnaire &&
        priorQuestionnaire
      ) {
        const priorSlot = questionnaireSlotForAsset(
          priorQuestionnaire,
          assetId
        );
        const originalQuestionnaireAsset = priorSlot
          ? getGuestQuestionnaireSlotAssets(
              priorQuestionnaire,
              priorSlot.key
            ).find((asset) => asset.asset_id === assetId)
          : null;
        if (!priorSlot || !originalQuestionnaireAsset) {
          throw new Error(
            'Guest questionnaire asset metadata could not be restored.'
          );
        }
        const currentSlotAssets = getGuestQuestionnaireSlotAssets(
          currentQuestionnaire,
          priorSlot.key
        );
        const restoredQuestionnaire = mergeGuestQuestionnaireUploadSlot(
          currentQuestionnaire,
          {
            slotKey: priorSlot.key,
            assets: currentSlotAssets.some(
              (asset) => asset.asset_id === assetId
            )
              ? currentSlotAssets
              : [...currentSlotAssets, originalQuestionnaireAsset],
          }
        );
        return await saveGuestQuestionnaireUploadCompletion(
          {
            episode: restoredEpisode,
            questionnaire: restoredQuestionnaire,
          },
          {
            expectedEpisodeUpdatedAt: currentEpisode.updated_at,
            expectedQuestionnaireUpdatedAt:
              currentQuestionnaire.updated_at,
          }
        );
      }
      return await saveEpisodeStudio(restoredEpisode, {
        expectedUpdatedAt: currentEpisode.updated_at,
      });
    } catch (restoreError) {
      const conflict =
        /conditional/i.test(String(restoreError?.message || '')) ||
        isGuestQuestionnaireUploadVersionConflict(restoreError);
      if (!conflict || attempt === MAX_METADATA_SAVE_ATTEMPTS - 1) {
        throw restoreError;
      }
      const [latestEpisode, latestQuestionnaire] = await Promise.all([
        getEpisodeStudio(priorEpisode.episode_id),
        getGuestQuestionnaire(priorEpisode.episode_id),
      ]);
      if (!latestEpisode.episode) throw restoreError;
      currentEpisode = latestEpisode.episode;
      currentQuestionnaire = latestQuestionnaire.questionnaire;
    }
  }
  throw new Error('Episode asset metadata could not be restored.');
}

export default async function handler(req, res) {
  if (!['GET', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const episodeId = String(req.query.episodeId || '').trim();
  const access = await requireEpisodeStudioAccess(
    req,
    res,
    episodeId,
    req.method === 'DELETE'
      ? ADMIN_PERMISSIONS.EPISODES_UPDATE
      : ADMIN_PERMISSIONS.EPISODES_READ
  );
  if (!access) return;
  const assetId = String(req.query.assetId || '').trim();
  const asset = access.episode.assets.find(
    (candidate) => candidate.asset_id === assetId
  );
  if (!asset) {
    return res.status(404).json({ ok: false, error: 'Episode asset not found.' });
  }
  if (
    req.method === 'GET' &&
    !canReadEpisodeAsset({
      roles: access.roles,
      canManage: access.canManage,
      viewerPersonId: access.binding?.person_id || '',
      episode: access.episode,
      asset,
    })
  ) {
    return res.status(404).json({ ok: false, error: 'Episode asset not found.' });
  }

  if (req.method === 'DELETE') {
    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }
    const hostDraftBlocker = getHostDraftObserverMutationBlocker({
      status: access.episode.status,
      canHost: access.roles.includes('host'),
      canManage: access.canManage,
    });
    if (hostDraftBlocker) {
      return res
        .status(hostDraftBlocker.status)
        .json({ ok: false, ...hostDraftBlocker });
    }
    if (
      !canDeleteEpisodeAsset({
        roles: access.roles,
        status: access.episode.status,
        canManage: access.canManage,
        viewerPersonId: access.binding?.person_id,
        uploaderPersonId: asset.uploaded_by_person_id,
      })
    ) {
      return res.status(403).json({
        ok: false,
        error:
          'Only the assigned producer, a Studio manager, or the assigned uploader can delete this file at this stage.',
      });
    }
    const expectedUpdatedAt = String(
      req.body?.expected_updated_at || ''
    ).trim();
    if (
      !expectedUpdatedAt ||
      expectedUpdatedAt !== access.episode.updated_at
    ) {
      return res.status(409).json({
        ok: false,
        error:
          'This Episode Studio changed in another session. Refresh before deleting the file.',
      });
    }

    try {
      const workflowUpdatedByName =
        access.principal.displayName ||
        access.principal.username ||
        'Studio participant';
      const questionnaireResult = await getGuestQuestionnaire(episodeId);
      let currentEpisode = access.episode;
      let currentQuestionnaire = questionnaireResult.questionnaire;
      let assetToDelete = asset;
      let saved = null;
      let priorEpisode = null;
      let priorQuestionnaire = null;
      let questionnaireIncluded = false;
      let metadataChanged = false;
      let uploadLocationSealed = false;

      for (
        let attempt = 0;
        attempt < MAX_METADATA_SAVE_ATTEMPTS;
        attempt += 1
      ) {
        const currentAsset = currentEpisode?.assets?.find(
          (candidate) => candidate.asset_id === assetId
        );
        const currentQuestionnaireSlot = questionnaireSlotForAsset(
          currentQuestionnaire,
          assetId
        );
        if (questionnaireUpdateLocksAsset(currentQuestionnaire, assetId)) {
          return res.status(409).json({
            ok: false,
            code: 'GUEST_UPLOADS_UPDATE_LOCKED',
            error:
              'This previously submitted guest file is preserved while a corrected response is open. Cancel or complete the guest update before deleting it.',
          });
        }
        if (!currentAsset && !currentQuestionnaireSlot) {
          saved = {
            episode: currentEpisode,
            questionnaire: currentQuestionnaire,
          };
          break;
        }
        if (currentAsset) assetToDelete = currentAsset;

        // Verify the immutable object reference before detaching its metadata.
        // The generated URL is discarded and never returned to this caller.
        createEpisodeAssetDownloadUrl(assetToDelete.object_key, {
          episodeId,
          fileName: assetToDelete.file_name,
          versionId: assetToDelete.object_version_id,
        });
        if (!uploadLocationSealed) {
          await sealEpisodeAssetObjectKey(assetToDelete.object_key, {
            episodeId,
          });
          uploadLocationSealed = true;
        }

        priorEpisode = currentEpisode;
        priorQuestionnaire = currentQuestionnaire;
        questionnaireIncluded = Boolean(
          currentQuestionnaire && currentQuestionnaireSlot
        );
        const workflowUpdatedAt = new Date().toISOString();
        try {
          saved = await saveAssetMetadataRemoval({
            episode: currentEpisode,
            questionnaire: currentQuestionnaire,
            assetId,
            personId: access.binding?.person_id || '',
            personName: workflowUpdatedByName,
            updatedAt: workflowUpdatedAt,
          });
          metadataChanged = true;
          break;
        } catch (saveError) {
          const conflict =
            /conditional/i.test(String(saveError?.message || '')) ||
            isGuestQuestionnaireUploadVersionConflict(saveError);
          if (!conflict || attempt === MAX_METADATA_SAVE_ATTEMPTS - 1) {
            throw saveError;
          }
          const [latest, latestQuestionnaire] = await Promise.all([
            getEpisodeStudio(episodeId),
            getGuestQuestionnaire(episodeId),
          ]);
          if (!latest.episode) {
            throw new Error('Episode Studio changed while deleting its file.');
          }
          if (latest.episode.updated_at !== expectedUpdatedAt) {
            throw new Error(
              'Episode Studio conditional version changed while deleting its file.'
            );
          }
          currentEpisode = latest.episode;
          currentQuestionnaire = latestQuestionnaire.questionnaire;
        }
      }

      if (!saved?.episode) {
        throw new Error('Episode Studio changed while deleting its file.');
      }

      try {
        await deleteEpisodeAssetObject(assetToDelete.object_key, {
          episodeId,
          versionId: assetToDelete.object_version_id,
        });
      } catch (storageError) {
        if (
          metadataChanged &&
          shouldRestoreEpisodeAssetMetadataAfterDeleteError(storageError)
        ) {
          try {
            await restoreAssetMetadataRemoval({
              saved,
              priorEpisode,
              priorQuestionnaire,
              questionnaireIncluded,
              assetId,
            });
          } catch (restoreError) {
            console.error(
              'episode asset delete metadata rollback failed:',
              restoreError
            );
          }
        }
        throw storageError;
      }

      logAdminAction(req, access.principal, 'episode_studio.asset_delete', {
        episode_id: episodeId,
        asset_id: assetToDelete.asset_id,
        category: assetToDelete.category,
        content_type: assetToDelete.content_type,
        size: assetToDelete.size,
        object_version_id: assetToDelete.object_version_id,
      });
      try {
        await publishEpisodeNotifications({
          previousEpisode: priorEpisode || access.episode,
          episode: saved.episode,
          action: 'asset_deleted',
          actorPersonId: access.binding?.person_id || '',
          actorName:
            access.principal.displayName ||
            access.principal.username ||
            'Studio participant',
          event: { asset: assetToDelete },
        });
      } catch (notificationError) {
        console.error(
          'episode asset deletion notification generation failed:',
          notificationError
        );
      }
      return res.status(200).json({
        ok: true,
        episode: sanitizeEpisodeStudioForViewer(saved.episode),
        deleted_asset_id: assetToDelete.asset_id,
      });
    } catch (error) {
      const message = String(error?.message || '');
      const unconfirmed =
        error?.code === 'EPISODE_ASSET_DELETE_UNCONFIRMED';
      const storage =
        unconfirmed || /secure storage could not delete/i.test(message);
      const invalidVersion = /stored object version is invalid/i.test(message);
      const conflict = /conditional/i.test(message);
      return res
        .status(storage ? 502 : invalidVersion || conflict ? 409 : 500)
        .json({
          ok: false,
          error: storage
            ? unconfirmed
              ? 'The file was detached, but secure storage could not confirm whether its exact object version was removed. Ask a Studio manager to verify storage before considering the deletion complete.'
              : 'Secure storage did not allow this exact file version to be deleted. The file was not removed from the episode.'
            : invalidVersion
              ? 'This file is missing its immutable storage version and cannot be deleted safely.'
              : conflict
                ? 'This Episode Studio changed while the file was being deleted. Refresh to confirm its current state.'
                : 'Could not delete this episode file.',
        });
    }
  }

  if (isEpisodeAssetExpired(asset)) {
    return res.status(410).json({
      ok: false,
      error:
        'This temporary production asset reached the end of its 180-day storage window.',
    });
  }
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (String(req.query.preview || '') === 'thumbnail') {
    if (!canCreateEpisodeAssetThumbnail(asset)) {
      return res.status(415).json({
        ok: false,
        code: 'EPISODE_ASSET_THUMBNAIL_UNSUPPORTED',
        error:
          'This image format cannot be previewed safely. Download the original file to review it.',
      });
    }
    try {
      const thumbnail = await getOrCreateEpisodeAssetThumbnail(
        `${episodeId}:${asset.asset_id}:${asset.object_version_id}`,
        async () => {
          const sourceResponse = await fetch(
            createEpisodeAssetDownloadUrl(asset.object_key, {
              episodeId,
              fileName: asset.file_name,
              versionId: asset.object_version_id,
            }),
            {
              method: 'GET',
              headers: { Accept: asset.content_type },
            }
          );
          if (!sourceResponse.ok) {
            throw new Error(
              `Episode asset thumbnail source returned ${sourceResponse.status}.`
            );
          }
          const source = await readEpisodeAssetThumbnailSource(
            sourceResponse,
            { expectedSize: asset.size }
          );
          return createEpisodeAssetThumbnail(source, {
            contentType: asset.content_type,
            expectedSize: asset.size,
          });
        }
      );
      res.setHeader('Content-Type', 'image/webp');
      res.setHeader(
        'Content-Disposition',
        'inline; filename="episode-photo-preview.webp"'
      );
      res.setHeader('Content-Length', String(thumbnail.length));
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      return res.status(200).send(thumbnail);
    } catch (error) {
      const message = String(error?.message || '');
      const missingVersion = /stored object version is invalid/i.test(message);
      const unavailable = /not configured|source returned/i.test(message);
      const busy = /preview service is busy/i.test(message);
      if (busy) res.setHeader('Retry-After', '2');
      return res.status(
        missingVersion ? 409 : unavailable ? 503 : busy ? 429 : 422
      ).json({
        ok: false,
        code: missingVersion
          ? 'EPISODE_ASSET_VERSION_INVALID'
          : unavailable
            ? 'EPISODE_ASSET_THUMBNAIL_UNAVAILABLE'
            : busy
              ? 'EPISODE_ASSET_THUMBNAIL_BUSY'
              : 'EPISODE_ASSET_THUMBNAIL_DECODE_FAILED',
        error: missingVersion
          ? 'This image is missing its immutable storage version and cannot be previewed safely.'
          : unavailable
            ? 'The secured image could not be opened for preview. Download the original file instead.'
            : busy
              ? 'Photo previews are busy. Wait a moment and try again, or download the original file.'
              : 'This image could not be decoded into a safe preview. Download the original file instead.',
      });
    }
  }
  try {
    return res.redirect(
      302,
      createEpisodeAssetDownloadUrl(asset.object_key, {
        episodeId,
        fileName: asset.file_name,
        versionId: asset.object_version_id,
      })
    );
  } catch (error) {
    const missingVersion = /stored object version is invalid/i.test(
      String(error?.message || '')
    );
    return res.status(missingVersion ? 409 : 503).json({
      ok: false,
      error: missingVersion
        ? 'This episode asset is missing its immutable storage version and cannot be downloaded safely.'
        : 'Episode asset downloads are not configured in this environment.',
    });
  }
}
