import { deleteEpisodeAssetObjectVersionsForEpisode } from './episodeAssetStorage.js';
import {
  getEpisodeDeletionReadyAt,
  getEpisodeDeletionTombstonePurgeAt,
} from './episodeAssetGrantLifecycle.mjs';
import { normalizeEpisodeStudio } from './episodeStudioPresentation.mjs';
import { deleteEpisodeStudio } from './episodeStudioStore.js';
import {
  finalizeGuestQuestionnaireDeletionWithEpisodeTombstone,
  getGuestQuestionnaire,
} from './guestQuestionnaireStore.js';

export async function finalizeEpisodeStudioDeletion(
  episodeValue,
  options = {}
) {
  const episode = normalizeEpisodeStudio(episodeValue);
  const now = options.now ? new Date(options.now) : new Date();
  const readyAt = getEpisodeDeletionReadyAt(episode);
  if (!episode.deleted_at || !readyAt || Number.isNaN(now.getTime())) {
    throw new Error('Episode Studio: deletion is not ready for cleanup.');
  }
  if (readyAt.getTime() > now.getTime()) {
    return {
      pending: true,
      deletion_ready_at: readyAt.toISOString(),
      episode,
    };
  }

  const deleteVersions =
    options.deleteVersions || deleteEpisodeAssetObjectVersionsForEpisode;
  const storageDeletion = await deleteVersions(episode.episode_id);
  if (storageDeletion.cleanup_pending) {
    return {
      pending: true,
      storage_cleanup_pending: true,
      deletion_ready_at: readyAt.toISOString(),
      episode,
      deleted_storage_version_count:
        storageDeletion.deleted_version_count || 0,
    };
  }
  if (episode.deletion_finalized_at) {
    const purgeAt = getEpisodeDeletionTombstonePurgeAt(episode);
    if (purgeAt && purgeAt.getTime() <= now.getTime()) {
      const deleteTombstone = options.deleteTombstone || deleteEpisodeStudio;
      const deletion = await deleteTombstone(episode.episode_id, {
        expectedUpdatedAt: episode.updated_at,
      });
      return {
        pending: false,
        finalized: true,
        purged: deletion.deleted !== false,
        episode: null,
        deleted_storage_version_count:
          storageDeletion.deleted_version_count || 0,
      };
    }
    return {
      pending: false,
      finalized: true,
      purged: false,
      episode,
      deleted_storage_version_count:
        storageDeletion.deleted_version_count || 0,
    };
  }

  const loadQuestionnaire =
    options.getQuestionnaire || getGuestQuestionnaire;
  const finalizeTombstone =
    options.finalizeTombstone ||
    finalizeGuestQuestionnaireDeletionWithEpisodeTombstone;
  const questionnaireResult = await loadQuestionnaire(episode.episode_id);
  if (!questionnaireResult.configured) {
    throw new Error('Guest questionnaire storage is not configured.');
  }
  const finalized = await finalizeTombstone(episode, {
    expectedQuestionnaireUpdatedAt:
      questionnaireResult.questionnaire?.updated_at || '',
    expectedEpisodeUpdatedAt: episode.updated_at,
    finalizedAt: now.toISOString(),
  });
  return {
    pending: false,
    finalized: true,
    episode: finalized.episode,
    deleted_storage_version_count:
      storageDeletion.deleted_version_count || 0,
  };
}

export async function runEpisodeStudioDeletionCleanup(
  episodesValue = [],
  options = {}
) {
  const episodes = (Array.isArray(episodesValue) ? episodesValue : []).filter(
    (episode) => episode?.deleted_at
  );
  const result = {
    pending: 0,
    swept: 0,
    finalized: 0,
    purged: 0,
    failed: 0,
  };
  for (const episode of episodes) {
    try {
      const cleanup = await finalizeEpisodeStudioDeletion(episode, options);
      if (cleanup.pending) {
        result.pending += 1;
        continue;
      }
      result.swept += 1;
      if (cleanup.purged) result.purged += 1;
      if (!episode.deletion_finalized_at && cleanup.finalized) {
        result.finalized += 1;
      }
    } catch (error) {
      result.failed += 1;
      console.error(
        `episode deletion cleanup failed for ${episode.episode_id}:`,
        error
      );
    }
  }
  return result;
}
