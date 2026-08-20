import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getHostDraftObserverMutationBlocker,
  getHostDraftViewerCapabilities,
  getHostDraftProducerActionBlocker,
  isHostDraftStatus,
} from '../lib/episodeStudioDraftAccess.mjs';

test('side-route mutations share the producer-only host-draft blocker', () => {
  for (const status of ['planning', 'in_progress', 'needs_changes']) {
    const blocker = getHostDraftObserverMutationBlocker({ status });
    assert.equal(blocker?.status, 409, status);
    assert.equal(blocker?.code, 'HOST_DRAFT_NOT_SUBMITTED', status);
  }
  assert.equal(
    getHostDraftObserverMutationBlocker({
      status: 'planning',
      canHost: true,
    }),
    null
  );
  assert.equal(
    getHostDraftObserverMutationBlocker({
      status: 'needs_changes',
      canManage: true,
    }),
    null
  );
  assert.equal(
    getHostDraftObserverMutationBlocker({ status: 'submitted' }),
    null
  );
});

test('producer work stays server-locked while the host package is a draft', () => {
  for (const action of [
    'update_workflow_task',
    'edit_workflow_task',
    'update_photo_selection',
    'set_delivery_health',
    'review',
    'configure_checklist',
  ]) {
    const blocker = getHostDraftProducerActionBlocker({
      status: 'in_progress',
      action,
    });
    assert.equal(blocker?.status, 409, action);
    assert.equal(blocker?.code, 'HOST_DRAFT_NOT_SUBMITTED', action);
  }
});

test('draft visibility and discussion do not become producer task actions', () => {
  assert.equal(
    getHostDraftProducerActionBlocker({
      status: 'planning',
      action: 'message',
    }),
    null
  );
  assert.equal(isHostDraftStatus('needs_changes'), true);
  assert.equal(isHostDraftStatus('archived'), false);
});

test('hosts can draft, managers can configure, and submitted work unlocks', () => {
  assert.equal(
    getHostDraftProducerActionBlocker({
      status: 'in_progress',
      action: 'update_photo_selection',
      canHost: true,
    }),
    null
  );
  assert.equal(
    getHostDraftProducerActionBlocker({
      status: 'planning',
      action: 'configure_workflow',
      canManage: true,
    }),
    null
  );
  assert.equal(
    getHostDraftProducerActionBlocker({
      status: 'submitted',
      action: 'update_workflow_task',
    }),
    null
  );
  assert.equal(isHostDraftStatus('submitted_with_gaps'), false);
});

test('producer-only draft viewers receive read-only client capabilities', () => {
  const producer = getHostDraftViewerCapabilities(
    {
      canManage: false,
      canHost: false,
      canReview: true,
      canUploadAssets: true,
      canConfigure: true,
      canAdminOverride: false,
      canAdvanceProduction: true,
      canUseHostPreview: true,
    },
    'in_progress'
  );

  assert.equal(producer.hostDraftReadOnly, true);
  assert.equal(producer.canReview, false);
  assert.equal(producer.canUploadAssets, false);
  assert.equal(producer.canConfigure, false);
  assert.equal(producer.canAdvanceProduction, false);
  assert.equal(producer.canUseHostPreview, false);
});

test('hosts, managers, and submitted producer viewers keep their real capabilities', () => {
  const producerCapabilities = {
    canManage: false,
    canHost: false,
    canReview: true,
    canConfigure: true,
  };
  assert.deepEqual(
    getHostDraftViewerCapabilities(
      { ...producerCapabilities, canHost: true },
      'planning'
    ),
    {
      ...producerCapabilities,
      canHost: true,
      hostDraftReadOnly: false,
    }
  );
  assert.equal(
    getHostDraftViewerCapabilities(
      { ...producerCapabilities, canManage: true },
      'needs_changes'
    ).hostDraftReadOnly,
    false
  );
  assert.equal(
    getHostDraftViewerCapabilities(producerCapabilities, 'submitted')
      .canReview,
    true
  );
});
