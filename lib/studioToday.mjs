const ACTIVE_EPISODE_STATUSES = new Set([
  'planning',
  'in_progress',
  'submitted',
  'submitted_with_gaps',
  'needs_changes',
  'accepted',
]);

const ACTIVE_MIC_REQUEST_STATUSES = new Set([
  'requested',
  'approved',
  'waitlisted',
  'assigned',
  'checked_out',
]);

const URGENCY_ORDER = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function cleanDate(value) {
  const date = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function daysBetween(from, to) {
  const start = cleanDate(from);
  const end = cleanDate(to);
  if (!start || !end) return null;
  return Math.round(
    (new Date(`${end}T12:00:00Z`).getTime() -
      new Date(`${start}T12:00:00Z`).getTime()) /
      86400000
  );
}

function priorityForDate(value, today) {
  const days = daysBetween(today, value);
  if (days === null) return { score: 20, urgency: 'low' };
  if (days < 0) return { score: 105, urgency: 'urgent' };
  if (days <= 3) return { score: 85, urgency: 'high' };
  if (days <= 7) return { score: 65, urgency: 'medium' };
  if (days <= 14) return { score: 45, urgency: 'medium' };
  return { score: 20, urgency: 'low' };
}

function episodeAction(episode, options) {
  if (
    !episode?.episode_id ||
    episode.archived ||
    !ACTIVE_EPISODE_STATUSES.has(episode.status)
  ) {
    return null;
  }

  const workflow = episode.workflow || {};
  const packageHref = `/studio/episodes/${episode.episode_id}`;
  const productionHref = `${packageHref}/production#production-workflow`;
  const overdueTasks = Array.isArray(workflow.overdue_tasks)
    ? workflow.overdue_tasks
    : [];
  const nextWorkflowTask = workflow.next_due_task || null;
  const dueDate =
    overdueTasks[0]?.due_date ||
    nextWorkflowTask?.due_date ||
    episode.due_date ||
    episode.target_release_date ||
    '';
  const datePriority = priorityForDate(dueDate, options.today);
  const hostPercent = Math.max(
    0,
    Math.min(100, Number(episode.completion?.host_percent) || 0)
  );
  const myRoles = new Set(episode.my_roles || []);
  const workflowTaskAssignedToViewer = Boolean(
    nextWorkflowTask &&
      options.viewerPersonId &&
      (nextWorkflowTask.assigned_person_ids || []).includes(
        options.viewerPersonId
      )
  );
  const workflowTaskOwnedByRelationship = Boolean(
    nextWorkflowTask &&
      ((nextWorkflowTask.owner_type === 'hosts' && myRoles.has('host')) ||
        (nextWorkflowTask.owner_type === 'producer' &&
          myRoles.has('producer')) ||
        (nextWorkflowTask.owner_type === 'hosts_and_producer' &&
          (myRoles.has('host') || myRoles.has('producer'))))
  );
  let score = datePriority.score;
  let urgency = datePriority.urgency;
  let title = '';
  let detail = '';
  let badge = '';
  let href = packageHref;

  if (
    episode.effective_delivery_health === 'off_track' ||
    workflow.off_track ||
    episode.delivery_health === 'off_track'
  ) {
    score += 80;
    urgency = 'urgent';
    title = options.canManageEpisodes
      ? `Review the recovery plan for “${episode.title}”`
      : `Confirm the recovery plan for “${episode.title}”`;
    detail = overdueTasks.length
      ? `${overdueTasks[0].label} was due ${overdueTasks[0].due_date}. Complete or manager-waive the step.`
      : 'This episode is marked off track and needs a clear next step.';
    badge = workflow.off_track ? 'Deadline missed' : 'Off track';
    href = productionHref;
  } else if (
    nextWorkflowTask &&
    (options.canManageEpisodes ||
      workflowTaskAssignedToViewer ||
      workflowTaskOwnedByRelationship)
  ) {
    score += 35;
    title = `${nextWorkflowTask.label} for “${episode.title}”`;
    detail = `Owned by ${
      nextWorkflowTask.owner_label || 'the assigned production teammate'
    } and due ${nextWorkflowTask.due_date}.`;
    badge = 'Production workflow';
    href = productionHref;
  } else if (
    ['submitted', 'submitted_with_gaps'].includes(episode.status) &&
    (options.canManageEpisodes || myRoles.has('producer'))
  ) {
    score += 70;
    urgency = urgency === 'urgent' ? urgency : 'high';
    title = `Review the host package for “${episode.title}”`;
    detail =
      episode.status === 'submitted_with_gaps'
        ? 'The package is ready for review with acknowledged gaps.'
        : 'The host package is ready for producer review.';
    badge = 'Producer review';
  } else if (episode.status === 'needs_changes') {
    score += 65;
    urgency = urgency === 'urgent' ? urgency : 'high';
    title = `Respond to requested changes for “${episode.title}”`;
    detail = episode.producer_feedback || 'The producer requested an update.';
    badge = 'Changes requested';
  } else if (
    ['planning', 'in_progress'].includes(episode.status) &&
    (!options.canManageEpisodes || myRoles.size > 0)
  ) {
    score += hostPercent >= 100 ? 45 : 25;
    title =
      hostPercent >= 100
        ? `Submit “${episode.title}” to the producer`
        : `${episode.status === 'planning' ? 'Start' : 'Continue'} “${episode.title}”`;
    detail =
      hostPercent >= 100
        ? 'The required host package is ready for handoff.'
        : `${hostPercent}% of the required host package is complete.`;
    badge = hostPercent >= 100 ? 'Ready to submit' : `${hostPercent}% ready`;
  } else if (
    options.canManageEpisodes &&
    ['planning', 'in_progress'].includes(episode.status) &&
    (datePriority.urgency === 'urgent' || datePriority.urgency === 'high')
  ) {
    score += 20;
    title = `Check readiness for “${episode.title}”`;
    detail = `${hostPercent}% of the required host package is complete.`;
    badge = 'Due soon';
  } else {
    return null;
  }

  return {
    id: `episode:${episode.episode_id}`,
    kind: 'episode',
    title,
    detail,
    badge,
    date: dueDate,
    urgency,
    score,
    href,
  };
}

function micKitActions(payload = {}, canManageMicKits = false) {
  if (canManageMicKits) {
    return (payload.automation?.actions || []).slice(0, 5).map((action) => ({
      id: `mic-kit:${action.action_id}`,
      kind: 'mic_kit',
      title: action.title,
      detail: action.detail,
      badge: 'Mic kit',
      date: '',
      urgency: action.urgency || 'medium',
      score:
        action.urgency === 'urgent'
          ? 120
          : action.urgency === 'high'
            ? 85
            : 45,
      href: '/admin/mic-kits',
    }));
  }

  return (payload.tracker?.requests || [])
    .filter(
      (request) =>
        request.is_mine && ACTIVE_MIC_REQUEST_STATUSES.has(request.status)
    )
    .map((request) => {
      const copy = {
        requested: ['Mic kit request received', 'Awaiting coordinator review'],
        approved: ['Mic kit request approved', 'A kit can now be assigned'],
        waitlisted: ['Mic kit request waitlisted', 'Open the board for details'],
        assigned: ['Mic kit assigned', 'Review the handoff and shipping plan'],
        checked_out: ['Mic kit checked out', 'Review its return plan'],
      }[request.status] || ['Review mic kit request', 'Open the mic kit board'];

      return {
        id: `mic-kit:${request.request_id}`,
        kind: 'mic_kit',
        title: copy[0],
        detail: request.admin_response || copy[1],
        badge: request.status.replace(/_/g, ' '),
        date:
          request.planned_due_back ||
          request.recording_date ||
          request.need_by ||
          '',
        urgency: ['assigned', 'checked_out'].includes(request.status)
          ? 'medium'
          : 'low',
        score: ['assigned', 'checked_out'].includes(request.status) ? 40 : 15,
        href: '/studio/mic-kits',
      };
    });
}

function operationsActions(overview = null) {
  if (!overview) return [];
  const actions = [];
  const unshipped = Number(overview.orders?.unshipped) || 0;
  const inventoryAttention =
    (Number(overview.inventory?.low_stock) || 0) +
    (Number(overview.inventory?.sold_out) || 0);

  if (unshipped) {
    actions.push({
      id: 'operations:orders',
      kind: 'operations',
      title: `${unshipped} ${unshipped === 1 ? 'order needs' : 'orders need'} shipping follow-up`,
      detail: 'Review new and processing orders that have not shipped.',
      badge: 'Orders',
      date: '',
      urgency: 'high',
      score: 90,
      href: '/admin/orders',
    });
  }

  if (inventoryAttention) {
    const inventoryItems = [
      ...(overview.inventory?.sold_out_rows || []),
      ...(overview.inventory?.low_stock_rows || []),
    ];
    actions.push({
      id: 'operations:inventory',
      kind: 'operations',
      title: `${inventoryAttention} inventory ${inventoryAttention === 1 ? 'item needs' : 'items need'} attention`,
      detail: 'Review live products that are low or sold out.',
      badge: 'Inventory',
      date: '',
      urgency: 'medium',
      score: 60,
      href: '/admin/products?view=stock',
      inventory_items: inventoryItems,
    });
  }

  return actions;
}

function intakeActions(
  payload = {},
  { canManageIntake = false, viewerPersonId = '' } = {}
) {
  const items = Array.isArray(payload.items) ? payload.items : [];
  return items
    .filter((item) => {
      if (!item?.item_id || item.archived || item.status === 'resolved') {
        return false;
      }
      if (canManageIntake) {
        return (
          item.kind === 'blocker' ||
          item.status === 'new' ||
          item.priority === 'urgent' ||
          !item.assigned_to_person_id
        );
      }
      return (
        viewerPersonId &&
        (item.assigned_to_person_id === viewerPersonId ||
          (item.created_by_person_id === viewerPersonId &&
            item.status === 'waiting'))
      );
    })
    .slice(0, 5)
    .map((item) => {
      const blocker = item.kind === 'blocker';
      const isNew = item.status === 'new';
      const assignedToViewer =
        viewerPersonId &&
        item.assigned_to_person_id === viewerPersonId;
      const urgency =
        blocker || item.priority === 'urgent'
          ? 'urgent'
          : isNew || item.priority === 'high'
            ? 'high'
            : 'medium';
      return {
        id: `intake:${item.item_id}`,
        kind: 'intake',
        title: blocker
          ? `Unblock “${item.title}”`
          : isNew && canManageIntake
            ? `Triage “${item.title}”`
            : assignedToViewer
              ? `Follow up on “${item.title}”`
              : `Add context to “${item.title}”`,
        detail: item.assigned_to_name
          ? `Owned by ${item.assigned_to_name}.`
          : `Submitted by ${item.created_by_name || 'a teammate'} and still unassigned.`,
        badge: blocker
          ? 'Blocker'
          : isNew
            ? 'Follow-up · new'
            : 'Follow-up',
        date: item.target_date || '',
        urgency,
        score:
          urgency === 'urgent' ? 115 : urgency === 'high' ? 78 : 48,
        href: `/studio/inbox?item=${encodeURIComponent(item.item_id)}`,
      };
    });
}

export function buildStudioToday(
  {
    episodes = [],
    canManageEpisodes = false,
    micKitPayload = null,
    canManageMicKits = false,
    operations = null,
    intakePayload = null,
    canManageIntake = false,
    viewerPersonId = '',
  } = {},
  options = {}
) {
  const today = cleanDate(options.today) || new Date().toISOString().slice(0, 10);
  const episodeActions = (Array.isArray(episodes) ? episodes : [])
    .map((episode) =>
      episodeAction(episode, {
        today,
        canManageEpisodes,
        viewerPersonId,
      })
    )
    .filter(Boolean);
  const micActions = micKitActions(
    micKitPayload || {},
    canManageMicKits
  );
  const operationActions = operationsActions(operations);
  const teamInboxActions = intakeActions(intakePayload || {}, {
    canManageIntake,
    viewerPersonId:
      viewerPersonId || intakePayload?.viewer_person_id || '',
  });
  const actions = [
    ...episodeActions,
    ...micActions,
    ...operationActions,
    ...teamInboxActions,
  ].sort(
    (a, b) =>
      (URGENCY_ORDER[a.urgency] ?? 9) -
        (URGENCY_ORDER[b.urgency] ?? 9) ||
      b.score - a.score ||
      String(a.date || '9999').localeCompare(String(b.date || '9999')) ||
      a.title.localeCompare(b.title)
  );
  const activeEpisodes = episodes.filter(
    (episode) =>
      !episode.archived &&
      ACTIVE_EPISODE_STATUSES.has(episode.status) &&
      (episode.status !== 'accepted' ||
        episode.workflow?.next_due_task ||
        episode.workflow?.off_track)
  );

  return {
    actions: actions.slice(0, 8),
    episode_actions: episodeActions,
    mic_kit_actions: micActions,
    operations_actions: operationActions,
    intake_actions: teamInboxActions,
    metrics: {
      active_episodes: activeEpisodes.length,
      due_this_week: activeEpisodes.filter((episode) => {
        const days = daysBetween(
          today,
          episode.workflow?.next_due_task?.due_date ||
            episode.due_date ||
            episode.target_release_date
        );
        return days !== null && days >= 0 && days <= 7;
      }).length,
      off_track: activeEpisodes.filter(
        (episode) =>
          episode.effective_delivery_health === 'off_track' ||
          episode.workflow?.off_track ||
          episode.delivery_health === 'off_track'
      ).length,
      action_count: actions.length,
      intake_open: Number(intakePayload?.summary?.open) || 0,
    },
  };
}
