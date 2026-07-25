import { createStudioNotifications } from './studioNotificationStore.js';
import { plainTextPreview } from './studioNotificationPresentation.mjs';

function participants(episode = {}) {
  return [
    ...new Set(
      [
        ...(episode.host_person_ids || []),
        episode.producer_person_id,
        episode.created_by_person_id,
      ].filter(Boolean)
    ),
  ];
}

function recipientEntries(
  recipientIds,
  actorPersonId,
  base,
  dedupePrefix
) {
  return [
    ...new Set((recipientIds || []).filter(Boolean)),
  ]
    .filter((personId) => personId !== actorPersonId)
    .map((personId) => ({
      dedupe_key: `${dedupePrefix}:${personId}`,
      notification: {
        ...base,
        recipient_person_id: personId,
      },
    }));
}

export function buildEpisodeNotificationEntries({
  previousEpisode = null,
  episode,
  action,
  actorPersonId = '',
  actorName = 'Studio team',
}) {
  if (!episode?.episode_id) return [];
  const deepLink = `/studio/episodes/${episode.episode_id}`;
  const base = {
    category: 'episode',
    kind: 'event',
    urgency: 'normal',
    actor_name: actorName,
    entity_kind: 'episode',
    entity_id: episode.episode_id,
    deep_link: deepLink,
  };
  const eventToken = episode.updated_at || new Date().toISOString();
  const entries = [];

  if (action === 'message') {
    const message = episode.messages?.[episode.messages.length - 1];
    entries.push(
      ...recipientEntries(
        participants(episode),
        actorPersonId,
        {
          ...base,
          type: 'episode_discussion_message',
          title: `${actorName} posted in ${episode.title}`,
          preview: plainTextPreview(message?.body),
          deep_link: `${deepLink}#discussion`,
        },
        `episode:discussion:${episode.episode_id}:${message?.message_id || eventToken}`
      )
    );
  }

  const previousParticipants = new Set(
    previousEpisode ? participants(previousEpisode) : []
  );
  const addedParticipants = participants(episode).filter(
    (personId) => !previousParticipants.has(personId)
  );
  if (addedParticipants.length) {
    entries.push(
      ...recipientEntries(
        addedParticipants,
        actorPersonId,
        {
          ...base,
          type: 'episode_assignment',
          title: `You were assigned to ${episode.title}`,
          preview:
            'Open the Episode Studio to review your role, dates, checklist, sponsor reads, and discussion.',
        },
        `episode:assignment:${episode.episode_id}:${eventToken}`
      )
    );
  }

  if (['assign_sponsor_read', 'remove_sponsor_read'].includes(action)) {
    entries.push(
      ...recipientEntries(
        participants(episode),
        actorPersonId,
        {
          ...base,
          type: 'sponsor_read_assigned_or_changed',
          title: `Sponsor read updated for ${episode.title}`,
          preview:
            'The episode sponsor language or recording requirement changed. Review the frozen script snapshot before recording.',
          deep_link: `${deepLink}#sponsor-reads`,
        },
        `episode:sponsor-read:${episode.episode_id}:${eventToken}`
      )
    );
  }

  if (action === 'submit') {
    const resubmitted = previousEpisode?.status === 'needs_changes';
    entries.push(
      ...recipientEntries(
        [episode.producer_person_id],
        actorPersonId,
        {
          ...base,
          type: resubmitted
            ? 'episode_package_resubmitted'
            : 'episode_package_submitted',
          title: `${episode.title} ${
            resubmitted ? 'was resubmitted' : 'is ready for producer review'
          }`,
          preview: resubmitted
            ? 'The assigned hosts completed another pass and returned the package to producer review.'
            : 'The host package, sponsor-read status, and production brief are ready for review.',
          urgency: 'high',
        },
        `episode:${resubmitted ? 'resubmitted' : 'submitted'}:${episode.episode_id}:${eventToken}`
      )
    );
  }

  if (
    ['review', 'override_review'].includes(action) &&
    episode.status === 'needs_changes'
  ) {
    entries.push(
      ...recipientEntries(
        episode.host_person_ids,
        actorPersonId,
        {
          ...base,
          type: 'producer_requested_changes',
          title: `Changes requested for ${episode.title}`,
          preview:
            plainTextPreview(episode.producer_feedback) ||
            'The producer reopened the host package with requested changes.',
          urgency: 'high',
        },
        `episode:changes-requested:${episode.episode_id}:${eventToken}`
      )
    );
  }

  if (
    ['review', 'override_review'].includes(action) &&
    episode.status === 'accepted'
  ) {
    entries.push(
      ...recipientEntries(
        [
          ...episode.host_person_ids,
          episode.created_by_person_id,
        ],
        actorPersonId,
        {
          ...base,
          type: 'producer_approved_episode',
          title: `${episode.title} was approved`,
          preview:
            'Producer acceptance completed the episode preparation workflow.',
        },
        `episode:approved:${episode.episode_id}:${eventToken}`
      )
    );
  }

  if (
    action === 'set_delivery_health' &&
    episode.delivery_health === 'off_track' &&
    previousEpisode?.delivery_health !== 'off_track'
  ) {
    entries.push(
      ...recipientEntries(
        participants(episode),
        actorPersonId,
        {
          ...base,
          type: 'episode_off_track',
          title: `${episode.title} was marked off track`,
          preview:
            'The production team flagged the current delivery outlook. Open the episode discussion for context.',
          urgency: 'high',
        },
        `episode:off-track:${episode.episode_id}:${eventToken}`
      )
    );
  }

  return entries;
}

export async function publishEpisodeNotifications(context) {
  const entries = buildEpisodeNotificationEntries(context);
  return createStudioNotifications(entries);
}
