import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('authenticated asset deletion seals the upload key before metadata and data removal', async () => {
  const route = await source(
    '../pages/api/studio/episodes/[episodeId]/assets/[assetId].js'
  );
  const seal = route.indexOf('await sealEpisodeAssetObjectKey(');
  const metadata = route.indexOf(
    'saved = await saveAssetMetadataRemoval(',
    seal
  );
  const objectDelete = route.indexOf(
    'await deleteEpisodeAssetObject(',
    metadata
  );
  assert.ok(seal > 0);
  assert.ok(metadata > seal);
  assert.ok(objectDelete > metadata);
});

test('guest asset deletion seals the upload key before its atomic metadata save and data removal', async () => {
  const route = await source(
    '../pages/api/guest-questionnaire/uploads/[assetId].js'
  );
  const seal = route.indexOf('await sealEpisodeAssetObjectKey(');
  const metadata = route.indexOf(
    'saved = await saveGuestQuestionnaireUploadCompletion(',
    seal
  );
  const objectDelete = route.indexOf(
    'await deleteEpisodeAssetObject(',
    metadata
  );
  assert.ok(seal > 0);
  assert.ok(metadata > seal);
  assert.ok(objectDelete > metadata);
});

test('both upload screens reconcile uncertain storage results before failing', async () => {
  const [studio, guest] = await Promise.all([
    source('../components/EpisodeStudioWorkspace.js'),
    source('../components/GuestQuestionnaireForm.js'),
  ]);
  for (const value of [studio, guest]) {
    const upload = value.indexOf('await uploadAuthorizedFile(');
    const reconcile = value.indexOf(
      'shouldReconcileEpisodeAssetUpload(',
      upload
    );
    const complete = value.indexOf(
      studio === value
        ? 'await completeEpisodeAssetUpload('
        : 'await completeGuestQuestionnaireAssetUpload({',
      reconcile
    );
    assert.ok(upload > 0);
    assert.ok(reconcile > upload);
    assert.ok(complete > reconcile);
  }
  const guestClient = await source(
    '../lib/guestQuestionnaireUploadClient.mjs'
  );
  const guestCompletion = guestClient.indexOf(
    'completeGuestQuestionnaireAssetUpload('
  );
  const guestReload = guestClient.indexOf(
    "fetchImpl('/api/guest-questionnaire'",
    guestCompletion
  );
  const finalFailure = guestClient.indexOf('throw lastError;', guestReload);
  assert.ok(guestReload > guestCompletion);
  assert.ok(finalFailure > guestReload);
});

test('Studio and guest presign routes record grant expiry before returning a URL', async () => {
  const routes = await Promise.all([
    source(
      '../pages/api/studio/episodes/[episodeId]/assets/presign.js'
    ).then((route) => ({ route, saveCall: 'await saveEpisodeStudio(' })),
    source('../pages/api/guest-questionnaire/uploads/presign.js').then(
      (route) => ({
        route,
        saveCall: 'await saveGuestQuestionnaireWithEpisode(',
      })
    ),
  ]);
  for (const { route, saveCall } of routes) {
    const create = route.indexOf('createEpisodeAssetUpload({');
    const record = route.indexOf('recordEpisodeAssetUploadGrant(', create);
    const save = route.indexOf(saveCall, create);
    const respond = route.indexOf('return res.status(200).json(', save);
    assert.ok(create > 0);
    assert.ok(record > create);
    assert.ok(save > create);
    assert.ok(respond > save);
  }
});

test('before submission, a reissued active guest link can manage questionnaire-owned files', async () => {
  const route = await source(
    '../pages/api/guest-questionnaire/uploads/[assetId].js'
  );
  const handler = route.indexOf('export default async function handler');
  const lock = route.indexOf('assertCurrentGuestAccess(', handler);
  const ownership = route.indexOf('isGuestQuestionnaireUploaderId(', handler);
  assert.ok(lock > handler);
  assert.ok(ownership > lock);
  assert.match(route, /isGuestQuestionnaireUploaderId\(/);
  assert.match(
    route,
    /episodeAsset\.deliverable_id !== configuredSlot\.deliverable_id/
  );
});

test('photo previews are authenticated re-encoded thumbnails while raw assets stay attachments', async () => {
  const [route, storage] = await Promise.all([
    source('../pages/api/studio/episodes/[episodeId]/assets/[assetId].js'),
    source('../lib/episodeAssetStorage.js'),
  ]);
  const previewBranch = route.indexOf(
    "String(req.query.preview || '') === 'thumbnail'"
  );
  const sourceDownload = route.indexOf(
    'createEpisodeAssetDownloadUrl(asset.object_key',
    previewBranch
  );
  const reencode = route.indexOf(
    'createEpisodeAssetThumbnail(',
    sourceDownload
  );
  const ordinaryDownload = route.indexOf(
    'return res.redirect(',
    reencode
  );

  assert.ok(previewBranch > 0);
  assert.ok(sourceDownload > previewBranch);
  assert.ok(reencode > sourceDownload);
  assert.ok(ordinaryDownload > reencode);
  assert.match(route, /X-Content-Type-Options', 'nosniff'/);
  assert.match(route, /Cache-Control', 'no-store, private'/);
  assert.match(storage, /return `attachment; filename=/);
  assert.doesNotMatch(storage, /response-content-disposition',\s*['"]inline/);
});
