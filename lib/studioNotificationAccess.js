import { getEpisodeStudiosByIds } from './episodeStudioStore.js';
import { getMicKitTracker } from './micKitStore.js';
import {
  filterOpenableStudioNotifications,
  groupStudioNotifications,
} from './studioNotificationPresentation.mjs';

export async function filterNotificationsForPrincipal(
  notifications = [],
  {
    personId = '',
    permissions = [],
    loadEpisodes = getEpisodeStudiosByIds,
    loadMicKitTracker = getMicKitTracker,
  } = {}
) {
  const episodeIds = [
    ...new Set(
      notifications
        .filter((notification) => notification.category === 'episode')
        .map((notification) => notification.group_entity_id)
        .filter(Boolean)
    ),
  ];
  const needsMicKits = notifications.some(
    (notification) => notification.category === 'mic_kit'
  );
  const [episodeResult, micKitResult] = await Promise.all([
    episodeIds.length
      ? loadEpisodes(episodeIds)
      : Promise.resolve({ episodes: [] }),
    needsMicKits
      ? loadMicKitTracker()
      : Promise.resolve({ tracker: { requests: [] } }),
  ]);
  const episodesById = new Map(
    (episodeResult.episodes || []).map((episode) => [
      episode.episode_id,
      episode,
    ])
  );
  const micKitRequestsById = new Map(
    (micKitResult.tracker?.requests || []).map((request) => [
      request.request_id,
      request,
    ])
  );
  const visible = filterOpenableStudioNotifications(notifications, {
    personId,
    permissions,
    episodesById,
    micKitRequestsById,
  });

  return {
    notifications: visible,
    groups: groupStudioNotifications(visible),
    suppressed_count: notifications.length - visible.length,
  };
}
