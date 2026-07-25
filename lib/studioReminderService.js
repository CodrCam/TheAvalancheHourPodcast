import { listEpisodeStudios } from './episodeStudioStore.js';
import { getMicKitTracker } from './micKitStore.js';
import { createStudioNotifications } from './studioNotificationStore.js';
import { generateStudioReminderEntries } from './studioReminderGenerator.mjs';

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
      managerPersonIds:
        options.managerPersonIds ||
        String(process.env.STUDIO_MIC_KIT_MANAGER_PERSON_IDS || '')
          .split(',')
          .map((personId) => personId.trim())
          .filter(Boolean),
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
