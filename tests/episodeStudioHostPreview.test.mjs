import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canPreviewEpisodeAsHost,
  getEpisodeStudioViewCapabilities,
} from '../lib/episodeStudioHostPreview.mjs';

test('allows managers and assigned producers to enter host preview', () => {
  assert.equal(canPreviewEpisodeAsHost({ canManage: true }), true);
  assert.equal(canPreviewEpisodeAsHost({ canReview: true }), true);
  assert.equal(canPreviewEpisodeAsHost({ canConfigure: true }), true);
  assert.equal(canPreviewEpisodeAsHost({ canHost: true }), false);
});

test('host preview exposes the host surface but remains read only', () => {
  const preview = getEpisodeStudioViewCapabilities(
    {
      canManage: true,
      canHost: false,
      canReview: true,
      canUploadAssets: true,
      canConfigure: true,
      canAdminOverride: true,
      canAdvanceProduction: true,
    },
    'host'
  );

  assert.equal(preview.hostPreview, true);
  assert.equal(preview.hostPreviewReadOnly, true);
  assert.equal(preview.canHost, true);
  assert.equal(preview.canManage, false);
  assert.equal(preview.canReview, false);
  assert.equal(preview.canConfigure, false);
  assert.equal(preview.canUploadAssets, false);
  assert.equal(preview.canAdvanceProduction, false);
});

test('unauthorized host preview requests retain actual capabilities', () => {
  const capabilities = getEpisodeStudioViewCapabilities(
    { canHost: true, canManage: false },
    'host'
  );

  assert.equal(capabilities.hostPreview, false);
  assert.equal(capabilities.canUseHostPreview, false);
  assert.equal(capabilities.canHost, true);
});
