import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { assertGuestQuestionnaireUploadMutationsAllowed } from '../lib/guestQuestionnaireUploadAccess.js';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('the upload access helper returns a stable conflict for response updates', () => {
  assert.throws(
    () =>
      assertGuestQuestionnaireUploadMutationsAllowed({
        response: { status: 'update_requested' },
      }),
    (error) => {
      assert.equal(error.status, 409);
      assert.equal(error.code, 'GUEST_UPLOADS_UPDATE_LOCKED');
      assert.match(error.message, /preserved/i);
      assert.match(error.message, /cannot be added, replaced, or removed/i);
      return true;
    }
  );
  assert.doesNotThrow(() =>
    assertGuestQuestionnaireUploadMutationsAllowed({
      response: { status: 'draft' },
    })
  );
});

test('presign, completion, and delete routes enforce the update upload lock', async () => {
  const [access, presign, complete, remove] = await Promise.all([
    source('../lib/guestQuestionnaireUploadAccess.js'),
    source('../pages/api/guest-questionnaire/uploads/presign.js'),
    source('../pages/api/guest-questionnaire/uploads/complete.js'),
    source('../pages/api/guest-questionnaire/uploads/[assetId].js'),
  ]);

  assert.match(
    access,
    /assertGuestQuestionnaireUploadMutationsAllowed\(questionnaire\);\s*return \{ token, tokenPayload, questionnaire, episode \}/
  );
  assert.doesNotMatch(access, /allowSubmitted/);
  assert.match(presign, /action: 'presign'/);
  assert.match(complete, /action: 'complete'/);
  assert.match(remove, /action: 'delete'/);

  for (const route of [complete, remove]) {
    const currentAccess = route.indexOf(
      'assertGuestQuestionnaireUploadMutationsAllowed(questionnaire);'
    );
    const mutation = Math.min(
      ...[
        route.indexOf('await verifyEpisodeAssetObject('),
        route.indexOf('await sealEpisodeAssetObjectKey('),
      ].filter((index) => index >= 0)
    );
    assert.ok(currentAccess > 0);
    assert.ok(mutation > currentAccess);
  }
});

test('the guest correction form preserves files and disables upload controls', async () => {
  const form = await source('../components/GuestQuestionnaireForm.js');

  assert.match(
    form,
    /const uploadMutationsLocked =\s*submission\?\.status === 'update_requested'/
  );
  assert.match(
    form,
    /Files from your previous\s+submission are preserved and cannot be added, removed, or\s+replaced during this update/
  );
  assert.match(
    form,
    /Files from your previous submission are preserved below and are read-only for this update/
  );
  assert.match(
    form,
    /if \(submitted \|\| uploadMutationsLocked \|\| uploadBusy\[slotKey\]\) return/
  );
  assert.match(form, /disabled=\{[\s\S]*uploadMutationsLocked[\s\S]*\}/);
  assert.match(form, /\? 'Files preserved'/);
  assert.match(form, /\? 'Preserved'/);
});

test('Studio cannot delete a preserved questionnaire file during an open correction', async () => {
  const route = await source(
    '../pages/api/studio/episodes/[episodeId]/assets/[assetId].js'
  );
  const updateGuard = route.indexOf(
    'questionnaireUpdateLocksAsset(currentQuestionnaire, assetId)'
  );
  const seal = route.indexOf('await sealEpisodeAssetObjectKey(');

  assert.ok(updateGuard > 0);
  assert.ok(seal > updateGuard);
  assert.match(route, /code: 'GUEST_UPLOADS_UPDATE_LOCKED'/);
  assert.match(route, /Cancel or complete the guest update before deleting it/);
});
