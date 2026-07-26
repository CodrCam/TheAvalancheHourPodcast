import { createStudioNotifications } from './studioNotificationStore.js';
import { plainTextPreview } from './studioNotificationPresentation.mjs';
import {
  getProductionLeadPersonIds,
} from './productionEscalation.mjs';
import {
  getStudioAdminNotificationPersonIds,
} from './studioNotificationRecipients.mjs';

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
  dedupePrefix,
  recipientReason,
  observerPersonIds = []
) {
  const primaryRecipientIds = new Set(
    (recipientIds || []).filter(Boolean)
  );
  return [
    ...new Set(
      [
        ...(recipientIds || []),
        ...(observerPersonIds || []),
      ].filter(Boolean)
    ),
  ]
    .filter((personId) => personId !== actorPersonId)
    .map((personId) => ({
      dedupe_key: `${dedupePrefix}:${personId}`,
      notification: {
        ...base,
        recipient_person_id: personId,
        audit: {
          ...base.audit,
          recipient_reason: primaryRecipientIds.has(personId)
            ? recipientReason
            : 'studio_admin_observer',
        },
      },
    }));
}

function episodeRole(episode = {}, personId = '') {
  const roles = [];
  if ((episode.host_person_ids || []).includes(personId)) roles.push('host');
  if (episode.producer_person_id === personId) roles.push('producer');
  if (episode.created_by_person_id === personId) roles.push('creator');
  return roles.sort().join('+');
}

export function buildEpisodeNotificationEntries({
  previousEpisode = null,
  episode,
  action,
  actorPersonId = '',
  actorName = 'Studio team',
  event = {},
  productionLeadPersonIds = getProductionLeadPersonIds(),
  adminPersonIds = [],
}) {
  if (!episode?.episode_id) return [];
  const deepLink = `/studio/episodes/${episode.episode_id}`;
  const base = {
    category: 'episode',
    kind: 'event',
    urgency: 'normal',
    intent: 'informational',
    actor_name: actorName,
    actor_person_id: actorPersonId,
    entity_kind: 'episode',
    entity_id: episode.episode_id,
    group_entity_kind: 'episode',
    group_entity_id: episode.episode_id,
    group_key: `episode:${episode.episode_id}`,
    deep_link: deepLink,
    audit: {
      source_action: action,
    },
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
        `episode:discussion:${episode.episode_id}:${message?.message_id || eventToken}`,
        'assigned_episode_participant',
        adminPersonIds
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
          title: `${episode.title} was added to Episode Studio`,
          preview:
            'Open the Episode Studio to review the assigned roles, dates, checklist, sponsor reads, and discussion.',
          intent: 'actionable',
        },
        `episode:assignment:${episode.episode_id}:${eventToken}`,
        'new_episode_assignment',
        adminPersonIds
      )
    );
  }

  if (previousEpisode && action === 'update') {
    const changedRoleParticipants = participants(episode).filter(
      (personId) =>
        !addedParticipants.includes(personId) &&
        episodeRole(previousEpisode, personId) !==
          episodeRole(episode, personId)
    );
    if (changedRoleParticipants.length) {
      entries.push(
        ...recipientEntries(
          changedRoleParticipants,
          actorPersonId,
          {
            ...base,
            type: 'episode_assignment_changed',
            title: `Assignments changed for ${episode.title}`,
            preview:
              'Review the current host, producer, and creator responsibilities in the Episode Studio.',
            intent: 'actionable',
          },
          `episode:assignment-changed:${episode.episode_id}:${eventToken}`,
          'changed_episode_assignment',
          adminPersonIds
        )
      );
    }

    if (
      previousEpisode.due_date !== episode.due_date ||
      previousEpisode.target_release_date !==
        episode.target_release_date
    ) {
      entries.push(
        ...recipientEntries(
          participants(episode),
          actorPersonId,
          {
            ...base,
            type: 'episode_deadline_changed',
            title: `Schedule updated for ${episode.title}`,
            preview: episode.due_date
              ? `The host package is now due ${episode.due_date}. Open the Episode Studio to review the release plan.`
              : 'The host-package deadline or release plan changed. Open the Episode Studio to review it.',
            intent: 'actionable',
            due_date: episode.due_date,
          },
          `episode:deadline:${episode.episode_id}:${eventToken}`,
          'assigned_episode_participant',
          adminPersonIds
        )
      );
    }
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
        `episode:sponsor-read:${episode.episode_id}:${eventToken}`,
        'assigned_episode_participant',
        adminPersonIds
      )
    );
  }

  if (action === 'update_sponsor_read_assignment') {
    const previousAssignments = new Map(
      (previousEpisode?.sponsor_read_assignments || []).map((assignment) => [
        assignment.assignment_id,
        assignment,
      ])
    );
    for (const assignment of episode.sponsor_read_assignments || []) {
      const previous = previousAssignments.get(assignment.assignment_id);
      if (!previous || previous.completed === assignment.completed) continue;
      if (assignment.completed) {
        entries.push(
          ...recipientEntries(
            [episode.producer_person_id],
            actorPersonId,
            {
              ...base,
              type: 'sponsor_read_evidence_attached',
              title: `Sponsor-read evidence is ready for ${episode.title}`,
              preview: `${assignment.sponsor_name || 'A sponsor'} evidence was attached and is ready for producer review.`,
              deep_link: `${deepLink}#sponsor-reads`,
              intent: 'actionable',
            },
            `episode:sponsor-evidence:${episode.episode_id}:${assignment.assignment_id}:${assignment.completed_at || eventToken}`,
            'assigned_episode_producer',
            adminPersonIds
          )
        );
      } else {
        entries.push(
          ...recipientEntries(
            episode.host_person_ids,
            actorPersonId,
            {
              ...base,
              type: 'sponsor_read_reopened',
              title: `Sponsor read reopened for ${episode.title}`,
              preview:
                'The sponsor-read evidence is no longer complete. Review the assignment before the episode package is submitted.',
              deep_link: `${deepLink}#sponsor-reads`,
              urgency: 'high',
              intent: 'actionable',
            },
            `episode:sponsor-reopened:${episode.episode_id}:${assignment.assignment_id}:${eventToken}`,
            'assigned_episode_host',
            adminPersonIds
          )
        );
      }
    }
  }

  if (action === 'configure_checklist') {
    entries.push(
      ...recipientEntries(
        episode.host_person_ids,
        actorPersonId,
        {
          ...base,
          type: 'episode_checklist_changed',
          title: `Checklist updated for ${episode.title}`,
          preview:
            'Required episode deliverables changed. Review the current checklist before submitting the host package.',
          deep_link: `${deepLink}#checklist`,
          intent: 'actionable',
        },
        `episode:checklist:${episode.episode_id}:${eventToken}`,
        'assigned_episode_host',
        adminPersonIds
      )
    );
  }

  if (action === 'asset_uploaded' && event.asset?.asset_id) {
    entries.push(
      ...recipientEntries(
        participants(episode),
        actorPersonId,
        {
          ...base,
          type: 'episode_required_file_uploaded',
          title: `${actorName} uploaded a file to ${episode.title}`,
          preview: event.asset.deliverable_id
            ? 'A file linked to a required deliverable is now available in the final asset package.'
            : `${event.asset.category || 'Production'} material is now available in the final asset package.`,
          entity_kind: 'episode_asset',
          entity_id: event.asset.asset_id,
          deep_link: `${deepLink}#final-assets`,
        },
        `episode:asset-uploaded:${episode.episode_id}:${event.asset.asset_id}`,
        'assigned_episode_participant',
        adminPersonIds
      )
    );
  }

  if (action === 'asset_deleted' && event.asset?.asset_id) {
    entries.push(
      ...recipientEntries(
        participants(episode),
        actorPersonId,
        {
          ...base,
          type: 'episode_file_removed',
          title: `A file was removed from ${episode.title}`,
          preview: event.asset.deliverable_id
            ? 'A file linked to a required deliverable was removed. Confirm the host package is still complete.'
            : 'The Episode Studio final asset package changed.',
          entity_kind: 'episode_asset',
          entity_id: event.asset.asset_id,
          deep_link: `${deepLink}#final-assets`,
          urgency: event.asset.deliverable_id ? 'high' : 'normal',
          intent: event.asset.deliverable_id
            ? 'actionable'
            : 'informational',
        },
        `episode:asset-deleted:${episode.episode_id}:${event.asset.asset_id}:${eventToken}`,
        'assigned_episode_participant',
        adminPersonIds
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
          intent: 'actionable',
        },
        `episode:${resubmitted ? 'resubmitted' : 'submitted'}:${episode.episode_id}:${eventToken}`,
        'assigned_episode_producer',
        adminPersonIds
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
          intent: 'actionable',
        },
        `episode:changes-requested:${episode.episode_id}:${eventToken}`,
        'assigned_episode_host',
        adminPersonIds
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
        `episode:approved:${episode.episode_id}:${eventToken}`,
        'assigned_episode_participant',
        adminPersonIds
      )
    );

    if (
      episode.production_stage === 'lead_review' &&
      episode.production_lead_person_id
    ) {
      entries.push(
        ...recipientEntries(
          [episode.production_lead_person_id],
          actorPersonId,
          {
            ...base,
            type: 'episode_ready_for_production_lead',
            title: `${episode.title} is ready for your production check`,
            preview: episode.staged_episode_url
              ? 'The assigned producer accepted the host package and attached a staged Spotify listen. Review it in the Episode Studio, then advance the handoff.'
              : 'The assigned producer accepted the host package. Review the Episode Studio and advance the handoff when it is ready.',
            urgency: 'high',
            intent: 'actionable',
          },
          `episode:production-lead:${episode.episode_id}:${eventToken}`,
          'next_production_lead',
          adminPersonIds
        )
      );
    } else if (episode.production_stage === 'complete') {
      entries.push(
        ...recipientEntries(
          productionLeadPersonIds,
          actorPersonId,
          {
            ...base,
            type: 'episode_production_chain_complete',
            title: `${episode.title} completed production review`,
            preview:
              'The host-to-producer escalation chain is complete and the episode is ready for its next operational stage.',
            intent: 'informational',
          },
          `episode:production-complete:${episode.episode_id}:${eventToken}`,
          'production_lead',
          adminPersonIds
        )
      );
    }
  }

  if (action === 'advance_production') {
    if (
      episode.production_stage === 'lead_review' &&
      episode.production_lead_person_id
    ) {
      entries.push(
        ...recipientEntries(
          [episode.production_lead_person_id],
          actorPersonId,
          {
            ...base,
            type: 'episode_advanced_to_production_lead',
            title: `${actorName} advanced ${episode.title} to you`,
            preview: episode.staged_episode_url
              ? 'The previous production lead completed their check. A staged Spotify listen is available inside the Episode Studio.'
              : 'The previous production lead completed their check. Review the handoff and advance it when ready.',
            urgency: 'high',
            intent: 'actionable',
          },
          `episode:production-advanced:${episode.episode_id}:${eventToken}`,
          'next_production_lead',
          adminPersonIds
        )
      );
    } else if (episode.production_stage === 'complete') {
      entries.push(
        ...recipientEntries(
          [
            ...productionLeadPersonIds,
            ...participants(episode),
          ],
          actorPersonId,
          {
            ...base,
            type: 'episode_production_chain_complete',
            title: `${episode.title} completed production review`,
            preview:
              'The host package, producer review, and production-lead handoff are complete.',
          },
          `episode:production-complete:${episode.episode_id}:${eventToken}`,
          'episode_participant_or_production_lead',
          adminPersonIds
        )
      );
    }
  }

  if (
    action === 'set_delivery_health' &&
    episode.delivery_health === 'off_track' &&
    previousEpisode?.delivery_health !== 'off_track'
  ) {
    entries.push(
      ...recipientEntries(
        [...participants(episode), ...productionLeadPersonIds],
        actorPersonId,
        {
          ...base,
          type: 'episode_off_track',
          title: `${episode.title} was marked off track`,
          preview:
            'The production team flagged the current delivery outlook. Open the episode discussion for context.',
          urgency: 'high',
          intent: 'urgent',
        },
        `episode:off-track:${episode.episode_id}:${eventToken}`,
        'episode_participant_or_production_lead',
        adminPersonIds
      )
    );
  }

  return entries;
}

export async function publishEpisodeNotifications(context) {
  const entries = buildEpisodeNotificationEntries({
    ...context,
    adminPersonIds:
      context?.adminPersonIds === undefined
        ? getStudioAdminNotificationPersonIds()
        : context.adminPersonIds,
  });
  return createStudioNotifications(entries);
}
