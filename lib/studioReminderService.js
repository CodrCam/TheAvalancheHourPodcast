import { listEpisodeStudios } from './episodeStudioStore.js';
import { getMicKitTracker } from './micKitStore.js';
import { createStudioNotifications } from './studioNotificationStore.js';
import { generateStudioReminderEntries } from './studioReminderGenerator.mjs';
import {
  getMicKitManagerPersonIds,
  getStudioAdminNotificationPersonIds,
} from './studioNotificationRecipients.mjs';

export async function runStudioReminderGeneration(options = {}) {
  const [episodeResult, micKitResult] = await Promise.all([
    listEpisodeStudios(),
    getMicKitTracker(),
  ]);
  const entries = generateStudioReminderEntries(
    {
      episodes: episodeResult.episodes,
      micKitTracker: micKitResult.tracker,
    },
    {
      ...options,
      managerPersonIds: getMicKitManagerPersonIds(
        options.managerPersonIds
      ),
      adminPersonIds: getStudioAdminNotificationPersonIds(
        options.adminPersonIds
      ),
    }
  );
  const results = await createStudioNotifications(entries);
  return {
    generated: entries.length,
    created: results.filter((result) => result.created).length,
    duplicates: results.filter((result) => result.duplicate).length,
    skipped_unconfigured: results.filter(
      (result) => result.configured === false
    ).length,
  };
}
