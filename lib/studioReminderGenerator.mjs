import {
  isEpisodeProductionTaskComplete,
} from './episodeProductionPlan.mjs';

function cleanDate(value) {
  const date = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function daysBetween(from, to) {
  const start = new Date(`${cleanDate(from)}T12:00:00Z`);
  const end = new Date(`${cleanDate(to)}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function productionTaskOwnerPersonIds(task = {}, episode = {}) {
  if (task.owner_type === 'hosts') {
    return unique(episode.host_person_ids);
  }
  if (task.owner_type === 'producer') {
    return unique([episode.producer_person_id]);
  }
  if (task.owner_type === 'hosts_and_producer') {
    return unique([
      ...(episode.host_person_ids || []),
      episode.producer_person_id,
    ]);
  }
  return unique(task.assigned_person_ids);
}

function reminderEntry({
  recipientPersonId,
  type,
  category,
  urgency,
  title,
  preview,
  entityKind,
  entityId,
  deepLink,
  dueDate,
  generatedAt,
  groupEntityKind = entityKind,
  groupEntityId = entityId,
  recipientReason = 'scheduled_work_owner',
}) {
  if (!recipientPersonId) return null;
  return {
    dedupe_key: `reminder:${type}:${entityId}:${dueDate}:${recipientPersonId}`,
    notification: {
      recipient_person_id: recipientPersonId,
      type,
      category,
      kind: 'reminder',
      urgency,
      intent: urgency === 'urgent' ? 'urgent' : 'actionable',
      title,
      preview,
      actor_name: '',
      entity_kind: entityKind,
      entity_id: entityId,
      group_entity_kind: groupEntityKind,
      group_entity_id: groupEntityId,
      group_key: `${groupEntityKind}:${groupEntityId}`,
      deep_link: deepLink,
      due_date: dueDate,
      generated_at: generatedAt,
      audit: {
        source_action: 'scheduled_reminder',
        recipient_reason: recipientReason,
      },
    },
  };
}

export function generateEpisodeReminderEntries(
  episodesValue = [],
  options = {}
) {
  const today = cleanDate(options.today) || new Date().toISOString().slice(0, 10);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const adminPersonIds = unique(options.adminPersonIds);
  const entries = [];
  for (const episode of Array.isArray(episodesValue) ? episodesValue : []) {
    if (!episode?.episode_id || episode.deleted_at) continue;
    const deepLink = `/studio/episodes/${episode.episode_id}`;
    const productionDeepLink = `${deepLink}/production`;
    const assignedParticipants = unique([
      ...(episode.host_person_ids || []),
      episode.producer_person_id,
      episode.created_by_person_id,
    ]);
    const participants = unique([
      ...assignedParticipants,
      ...adminPersonIds,
    ]);
    const assetsByExpirationDate = new Map();
    for (const asset of Array.isArray(episode.assets) ? episode.assets : []) {
      const expirationDate = cleanDate(asset.retention_expires_at);
      if (!expirationDate) continue;
      const current = assetsByExpirationDate.get(expirationDate) || [];
      current.push(asset);
      assetsByExpirationDate.set(expirationDate, current);
    }
    for (const [expirationDate, assets] of assetsByExpirationDate) {
      const retentionDaysAway = daysBetween(today, expirationDate);
      if (
        retentionDaysAway === null ||
        retentionDaysAway < 0 ||
        retentionDaysAway > 30
      ) {
        continue;
      }
      for (const personId of participants) {
        const entry = reminderEntry({
          recipientPersonId: personId,
          type: 'episode_assets_expiring',
          category: 'episode',
          urgency: retentionDaysAway <= 7 ? 'high' : 'normal',
          title: `${assets.length} ${
            assets.length === 1 ? 'asset' : 'assets'
          } for ${episode.title} ${
            retentionDaysAway === 0
              ? 'leave storage today'
              : `leave storage in ${retentionDaysAway} days`
          }`,
          preview:
            'Download any permanent masters before the Episode Studio 180-day storage window ends.',
          entityKind: 'episode_asset_group',
          entityId: `${episode.episode_id}-${expirationDate}`,
          groupEntityKind: 'episode',
          groupEntityId: episode.episode_id,
          deepLink: `${deepLink}#final-assets`,
          dueDate: expirationDate,
          generatedAt,
        });
        if (entry) entries.push(entry);
      }
    }

    const productionTasks = Array.isArray(episode.production_tasks)
      ? episode.production_tasks
      : [];
    const hostDraftOpen = ![
      'submitted',
      'submitted_with_gaps',
      'accepted',
    ].includes(episode.status);
    if (productionTasks.length) {
      for (const task of productionTasks) {
        const taskId = String(task?.task_id || task?.id || '').trim();
        const taskComplete =
          ['completed', 'done'].includes(task.status) ||
          isEpisodeProductionTaskComplete(task, episode);
        if (
          !taskId ||
          task.required === false ||
          taskComplete
        ) {
          continue;
        }
        const dueDate = cleanDate(task.due_date);
        const daysAway = dueDate ? daysBetween(today, dueDate) : null;
        if (daysAway === null) continue;

        const taskTitle = String(task.title || task.label || 'Production task')
          .trim()
          .slice(0, 220);
        const taskOwnerIds = productionTaskOwnerPersonIds(
          task,
          episode
        ).filter(
          (personId) =>
            !hostDraftOpen || episode.host_person_ids?.includes(personId)
        );
        if (!taskOwnerIds.length) continue;
        const taskEntityId = `${episode.episode_id}:${taskId}`;
        const reminderRecipients = hostDraftOpen
          ? taskOwnerIds
          : daysAway < 0
            ? unique([...taskOwnerIds, ...participants])
            : unique([...taskOwnerIds, ...adminPersonIds]);
        if (daysAway > 3) continue;

        for (const personId of reminderRecipients) {
          const isAdminObserver = adminPersonIds.includes(personId);
          const isTaskOwner = taskOwnerIds.includes(personId);
          const entry = reminderEntry({
            recipientPersonId: personId,
            type:
              daysAway < 0
                ? 'episode_production_task_overdue'
                : 'episode_production_task_due_soon',
            category: 'episode',
            urgency:
              daysAway < 0 ? 'urgent' : daysAway <= 1 ? 'high' : 'normal',
            title:
              daysAway < 0
                ? `${episode.title}: ${taskTitle} is overdue`
                : `${episode.title}: ${taskTitle} is due ${
                    daysAway === 0 ? 'today' : `in ${daysAway} days`
                  }`,
            preview:
              hostDraftOpen
                ? 'Continue the host research and review draft in Host Studio. The producer queue will stay quiet until the host submits it.'
                : daysAway < 0
                ? 'This episode is automatically off track because a required production step missed its deadline. Open the workflow to complete it or record what is blocking it.'
                : 'Open the Episode Studio production workflow to complete this step before its deadline.',
            entityKind: 'episode_production_task',
            entityId: taskEntityId,
            groupEntityKind: 'episode',
            groupEntityId: episode.episode_id,
            recipientReason: isAdminObserver
              ? 'studio_admin_observer'
              : isTaskOwner
                ? 'production_task_owner'
                : 'assigned_episode_participant',
            deepLink: hostDraftOpen
              ? `${deepLink}#host-research-review`
              : `${productionDeepLink}#production-workflow`,
            dueDate,
            generatedAt,
          });
          if (entry) entries.push(entry);
        }
      }
      // A production workflow replaces the older single host-package
      // deadline so the same episode does not create duplicate reminders.
      continue;
    }

    if (episode.status === 'accepted') continue;
    const dueDate = cleanDate(episode.due_date);
    const daysAway = dueDate ? daysBetween(today, dueDate) : null;
    if (
      daysAway !== null &&
      daysAway >= 0 &&
      daysAway <= 3 &&
      !['submitted', 'submitted_with_gaps'].includes(episode.status)
    ) {
      for (const personId of unique([
        ...(episode.host_person_ids || []),
        ...adminPersonIds,
      ])) {
        const entry = reminderEntry({
          recipientPersonId: personId,
          type: 'episode_host_deadline_approaching',
          category: 'episode',
          urgency: daysAway <= 1 ? 'high' : 'normal',
          title: `${episode.title} host package is due ${
            daysAway === 0 ? 'today' : `in ${daysAway} days`
          }`,
          preview:
            'Open the Episode Studio to finish the episode-specific checklist, sponsor reads, and final asset package.',
          entityKind: 'episode',
          entityId: episode.episode_id,
          groupEntityKind: 'episode',
          groupEntityId: episode.episode_id,
          recipientReason: adminPersonIds.includes(personId)
            ? 'studio_admin_observer'
            : 'assigned_episode_host',
          deepLink,
          dueDate,
          generatedAt,
        });
        if (entry) entries.push(entry);
      }
    }
    if (
      daysAway !== null &&
      daysAway < 0 &&
      !['submitted', 'submitted_with_gaps'].includes(episode.status)
    ) {
      for (const personId of participants) {
        const entry = reminderEntry({
          recipientPersonId: personId,
          type: 'episode_overdue',
          category: 'episode',
          urgency: 'urgent',
          title: `${episode.title} host package is overdue`,
          preview:
            'The planned host-package date has passed and the episode has not reached producer review.',
          entityKind: 'episode',
          entityId: episode.episode_id,
          groupEntityKind: 'episode',
          groupEntityId: episode.episode_id,
          recipientReason: adminPersonIds.includes(personId)
            ? 'studio_admin_observer'
            : 'assigned_episode_participant',
          deepLink,
          dueDate,
          generatedAt,
        });
        if (entry) entries.push(entry);
      }
    }
  }
  return entries;
}

export function generateMicKitReminderEntries(
  trackerValue = {},
  options = {}
) {
  const today = cleanDate(options.today) || new Date().toISOString().slice(0, 10);
  const generatedAt = options.generatedAt || new Date().toISOString();
  const managerPersonIds = unique(options.managerPersonIds);
  const tracker = trackerValue || {};
  const requests = Array.isArray(tracker.requests) ? tracker.requests : [];
  const requestsById = new Map(
    requests.map((request) => [request.request_id, request])
  );
  const entries = [];

  for (const kit of Array.isArray(tracker.kits) ? tracker.kits : []) {
    const nextRequest = requestsById.get(kit.next_request_id);
    const currentRequest = requestsById.get(kit.checked_out_request_id);
    const shipBy = cleanDate(kit.ship_by);
    const shipDays = shipBy ? daysBetween(today, shipBy) : null;
    if (
      nextRequest?.requester_person_id &&
      shipDays !== null &&
      shipDays >= 0 &&
      shipDays <= 3
    ) {
      for (const personId of unique([
        nextRequest.requester_person_id,
        ...managerPersonIds,
      ])) {
        const entry = reminderEntry({
          recipientPersonId: personId,
          type: 'mic_kit_ship_by_approaching',
          category: 'mic_kit',
          urgency: shipDays <= 1 ? 'high' : 'normal',
          title: `${kit.label} ship-by date is approaching`,
          preview:
            'Open Mic Kits for the authorized shipment or direct-handoff plan.',
          entityKind: 'mic_kit_request',
          entityId: nextRequest.request_id,
          groupEntityKind: 'mic_kit_request',
          groupEntityId: nextRequest.request_id,
          recipientReason: managerPersonIds.includes(personId)
            ? 'mic_kit_manager'
            : 'mic_kit_request_owner',
          deepLink: managerPersonIds.includes(personId)
            ? `/admin/mic-kits#${nextRequest.request_id}`
            : `/studio/mic-kits#${nextRequest.request_id}`,
          dueDate: shipBy,
          generatedAt,
        });
        if (entry) entries.push(entry);
      }
    }

    if (
      nextRequest?.requester_person_id &&
      kit.status === 'in_transit' &&
      kit.tracking_number
    ) {
      const entry = reminderEntry({
        recipientPersonId: nextRequest.requester_person_id,
        type: 'mic_kit_confirm_receipt',
        category: 'mic_kit',
        urgency: 'high',
        title: `Confirm when ${kit.label} arrives`,
        preview:
          'Use the receipt confirmation in Mic Kits so the shared inventory stays accurate.',
        entityKind: 'mic_kit_request',
        entityId: nextRequest.request_id,
        groupEntityKind: 'mic_kit_request',
        groupEntityId: nextRequest.request_id,
        recipientReason: 'mic_kit_request_owner',
        deepLink: `/studio/mic-kits#${nextRequest.request_id}`,
        dueDate: shipBy || today,
        generatedAt,
      });
      if (entry) entries.push(entry);
    }

    const returnDate = cleanDate(kit.due_back);
    const returnDays = returnDate ? daysBetween(today, returnDate) : null;
    if (currentRequest?.requester_person_id && returnDays !== null) {
      if (returnDays >= 0 && returnDays <= 3) {
        const entry = reminderEntry({
          recipientPersonId: currentRequest.requester_person_id,
          type: 'mic_kit_return_approaching',
          category: 'mic_kit',
          urgency: returnDays <= 1 ? 'high' : 'normal',
          title: `${kit.label} return is due ${
            returnDays === 0 ? 'today' : `in ${returnDays} days`
          }`,
          preview:
            'Open Mic Kits to review the return or direct-handoff plan.',
          entityKind: 'mic_kit_request',
          entityId: currentRequest.request_id,
          groupEntityKind: 'mic_kit_request',
          groupEntityId: currentRequest.request_id,
          recipientReason: 'mic_kit_request_owner',
          deepLink: `/studio/mic-kits#${currentRequest.request_id}`,
          dueDate: returnDate,
          generatedAt,
        });
        if (entry) entries.push(entry);
      } else if (returnDays < 0) {
        const entry = reminderEntry({
          recipientPersonId: currentRequest.requester_person_id,
          type: 'mic_kit_return_overdue',
          category: 'mic_kit',
          urgency: 'urgent',
          title: `${kit.label} return is overdue`,
          preview:
            'The shared inventory still shows this kit with you after its planned return date.',
          entityKind: 'mic_kit_request',
          entityId: currentRequest.request_id,
          groupEntityKind: 'mic_kit_request',
          groupEntityId: currentRequest.request_id,
          recipientReason: 'mic_kit_request_owner',
          deepLink: `/studio/mic-kits#${currentRequest.request_id}`,
          dueDate: returnDate,
          generatedAt,
        });
        if (entry) entries.push(entry);
      }
    }
  }
  return entries;
}

export function generateStudioReminderEntries(
  { episodes = [], micKitTracker = {} } = {},
  options = {}
) {
  return [
    ...generateEpisodeReminderEntries(episodes, options),
    ...generateMicKitReminderEntries(micKitTracker, options),
  ];
}
