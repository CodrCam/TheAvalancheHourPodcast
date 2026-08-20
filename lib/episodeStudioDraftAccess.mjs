const PRODUCER_ACTIONS_LOCKED_DURING_HOST_DRAFT = new Set([
  'set_delivery_health',
  'review',
  'configure_checklist',
  'add_workflow_task',
  'edit_workflow_task',
  'move_workflow_task',
  'configure_workflow',
  'update_workflow_task',
  'update_photo_selection',
  'advance_production',
]);

const HOST_DRAFT_STATUSES = new Set([
  'planning',
  'in_progress',
  'needs_changes',
]);

export function getHostDraftObserverMutationBlocker({
  status,
  canHost = false,
  canManage = false,
} = {}) {
  if (!isHostDraftStatus(status) || canHost || canManage) return null;
  return {
    status: 409,
    code: 'HOST_DRAFT_NOT_SUBMITTED',
    error:
      'This episode is still a host research draft. It is visible for context, but producer work stays locked until the host submits it.',
  };
}

export function getHostDraftProducerActionBlocker({
  status,
  action,
  canHost = false,
  canManage = false,
} = {}) {
  if (!PRODUCER_ACTIONS_LOCKED_DURING_HOST_DRAFT.has(String(action || ''))) {
    return null;
  }
  return getHostDraftObserverMutationBlocker({ status, canHost, canManage });
}

export function isHostDraftStatus(status) {
  return HOST_DRAFT_STATUSES.has(String(status || ''));
}

export function getHostDraftViewerCapabilities(
  capabilities = {},
  status = ''
) {
  const hostDraftReadOnly = Boolean(
    isHostDraftStatus(status) &&
      capabilities.canHost !== true &&
      capabilities.canManage !== true
  );
  if (!hostDraftReadOnly) {
    return { ...capabilities, hostDraftReadOnly: false };
  }
  return {
    ...capabilities,
    canReview: false,
    canUploadAssets: false,
    canConfigure: false,
    canAdminOverride: false,
    canAdvanceProduction: false,
    canUseHostPreview: false,
    hostDraftReadOnly: true,
  };
}
