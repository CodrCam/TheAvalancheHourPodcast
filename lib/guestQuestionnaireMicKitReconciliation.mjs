import { reconcileSubmittedGuestMicKitRequests } from './guestQuestionnaireMicKit.mjs';

function isConflict(error) {
  return /conditional|changed elsewhere/i.test(String(error?.message || ''));
}

export async function reconcileSubmittedGuestMicKitQueue({
  trackerResult,
  episodes = [],
  now = new Date().toISOString(),
  loadQuestionnaires,
  loadTracker,
  saveTracker,
  updatedBy = 'guest-questionnaire-backfill',
} = {}) {
  const episodeIds = [
    ...new Set(
      (Array.isArray(episodes) ? episodes : [])
        .filter(
          (episode) =>
            episode?.episode_id &&
            episode.status !== 'accepted' &&
            episode.archived !== true &&
            !episode.deleted_at &&
            !episode.deletion_finalized_at
        )
        .map((episode) => episode.episode_id)
    ),
  ];
  if (
    !trackerResult?.configured ||
    !episodeIds.length ||
    typeof loadQuestionnaires !== 'function' ||
    typeof loadTracker !== 'function' ||
    typeof saveTracker !== 'function'
  ) {
    return trackerResult;
  }

  const questionnaireResult = await loadQuestionnaires(episodeIds);
  if (!questionnaireResult?.configured) return trackerResult;

  let current = trackerResult;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const reconciliation = reconcileSubmittedGuestMicKitRequests({
      tracker: current.tracker,
      questionnaires: questionnaireResult.questionnaires,
      episodes,
      now,
    });
    if (!reconciliation.changed) {
      return {
        ...current,
        reconciled_guest_request_ids: reconciliation.request_ids,
      };
    }
    try {
      const saved = await saveTracker(reconciliation.tracker, {
        expectedUpdatedAt: current.tracker.updated_at,
        updatedBy,
      });
      return {
        ...saved,
        reconciled_guest_request_ids: reconciliation.request_ids,
      };
    } catch (error) {
      if (!isConflict(error) || attempt === 2) throw error;
      current = await loadTracker();
      if (!current?.configured) return trackerResult;
    }
  }
  return current;
}
