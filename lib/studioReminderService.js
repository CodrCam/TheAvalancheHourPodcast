import { listEpisodeStudios } from './episodeStudioStore.js';
import { getMicKitTracker } from './micKitStore.js';
import { createStudioNotifications } from './studioNotificationStore.js';
import { generateStudioReminderEntries } from './studioReminderGenerator.mjs';
import {
  getMicKitManagerPersonIds,
  getStudioAdminNotificationPersonIds,
} from './studioNotificationRecipients.mjs';
import { runEpisodeStudioDeletionCleanup } from './episodeStudioDeletionCleanup.js';

export async function runStudioReminderGeneration(options = {}) {
  const loadEpisodes = options.listEpisodes || listEpisodeStudios;
  const loadMicKitTracker =
    options.loadMicKitTracker || getMicKitTracker;
  const createNotifications =
    options.createNotifications || createStudioNotifications;
  const runDeletionCleanup =
    options.runDeletionCleanup || runEpisodeStudioDeletionCleanup;
  const episodeResult = await loadEpisodes();
  const cleanupOutcomePromise = Promise.allSettled([
    runDeletionCleanup(
      episodeResult.episodes,
      options.deletionCleanupOptions
    ),
  ]).then(([outcome]) => outcome);
  const micKitOutcome = await Promise.allSettled([loadMicKitTracker()]);
  const micKitResult =
    micKitOutcome[0].status === 'fulfilled'
      ? micKitOutcome[0].value
      : { tracker: {} };
  if (micKitOutcome[0].status === 'rejected') {
    console.error(
      'scheduled mic-kit reminder loading failed:',
      micKitOutcome[0].reason
    );
  }
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
  const [notificationOutcome] = await Promise.allSettled([
    createNotifications(entries),
  ]);
  const cleanupOutcome = await cleanupOutcomePromise;
  const results =
    notificationOutcome.status === 'fulfilled'
      ? notificationOutcome.value
      : [];
  if (notificationOutcome.status === 'rejected') {
    console.error(
      'scheduled Studio reminder delivery failed:',
      notificationOutcome.reason
    );
  }
  const deletionCleanup =
    cleanupOutcome.status === 'fulfilled'
      ? cleanupOutcome.value
      : { pending: 0, swept: 0, finalized: 0, purged: 0, failed: 1 };
  if (cleanupOutcome.status === 'rejected') {
    console.error(
      'scheduled episode deletion cleanup failed:',
      cleanupOutcome.reason
    );
  }
  return {
    generated: entries.length,
    created: results.filter((result) => result.created).length,
    duplicates: results.filter((result) => result.duplicate).length,
    skipped_unconfigured: results.filter(
      (result) => result.configured === false
    ).length,
    notification_failed: notificationOutcome.status === 'rejected',
    mic_kit_load_failed: micKitOutcome[0].status === 'rejected',
    deletion_cleanup: deletionCleanup,
  };
}
