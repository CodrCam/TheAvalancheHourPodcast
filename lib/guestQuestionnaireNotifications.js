import { createStudioNotifications } from './studioNotificationStore.js';

export function buildGuestQuestionnaireSubmissionNotifications({
  episode = {},
  responseRevision = 0,
} = {}) {
  if (!episode?.episode_id) return [];
  const recipients = [
    ...new Set(
      [
        ...(Array.isArray(episode.host_person_ids)
          ? episode.host_person_ids
          : []),
        episode.producer_person_id,
      ].filter(Boolean)
    ),
  ];
  const revision = Math.max(1, Math.trunc(Number(responseRevision) || 1));
  return recipients.map((personId) => ({
    dedupe_key: `guest-questionnaire:${episode.episode_id}:submitted:${revision}:${personId}`,
    notification: {
      recipient_person_id: personId,
      type: 'guest_questionnaire_submitted',
      category: 'episode',
      kind: 'event',
      urgency: 'normal',
      intent: 'actionable',
      title: `${episode.title || 'Episode'} guest questionnaire submitted`,
      preview: 'Guest questionnaire submitted.',
      actor_name: 'Episode guest',
      actor_person_id: '',
      entity_kind: 'episode',
      entity_id: episode.episode_id,
      group_entity_kind: 'episode',
      group_entity_id: episode.episode_id,
      group_key: `episode:${episode.episode_id}`,
      deep_link: `/studio/episodes/${episode.episode_id}/questionnaire`,
      audit: {
        source_action: 'guest_questionnaire_submit',
        recipient_reason:
          episode.producer_person_id === personId
            ? 'assigned_episode_producer'
            : 'assigned_episode_host',
      },
    },
  }));
}

export async function publishGuestQuestionnaireSubmissionNotifications(
  context
) {
  return createStudioNotifications(
    buildGuestQuestionnaireSubmissionNotifications(context)
  );
}
