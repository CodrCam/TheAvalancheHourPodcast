import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('asset create, completion, and deletion lock producer-only host drafts before mutation', async () => {
  const routes = await Promise.all([
    source('../pages/api/studio/episodes/[episodeId]/assets/presign.js'),
    source('../pages/api/studio/episodes/[episodeId]/assets/complete.js'),
    source('../pages/api/studio/episodes/[episodeId]/assets/[assetId].js'),
  ]);
  const mutationMarkers = [
    'createEpisodeAssetUpload({',
    'verifyEpisodeAssetUploadToken(',
    'await sealEpisodeAssetObjectKey(',
  ];

  routes.forEach((route, index) => {
    const handler = route.indexOf('export default async function handler');
    const guard = route.indexOf(
      'getHostDraftObserverMutationBlocker({',
      handler
    );
    const mutation = route.indexOf(mutationMarkers[index], handler);
    assert.ok(guard > handler);
    assert.ok(mutation > guard);
    assert.match(route.slice(guard, mutation), /canHost:/);
    assert.match(route.slice(guard, mutation), /canManage:/);
    assert.match(route.slice(guard, mutation), /HOST_DRAFT_NOT_SUBMITTED|hostDraftBlocker/);
  });

  const deletionBranch = routes[2].indexOf("if (req.method === 'DELETE')");
  const deletionGuard = routes[2].indexOf(
    'getHostDraftObserverMutationBlocker({',
    deletionBranch
  );
  const deletionAuthorization = routes[2].indexOf(
    'canDeleteEpisodeAsset({',
    deletionBranch
  );
  assert.ok(deletionGuard > deletionBranch);
  assert.ok(deletionAuthorization > deletionGuard);
});

test('questionnaire and mic-kit routes lock producer-only draft writes directly', async () => {
  const [questionnaire, micKit] = await Promise.all([
    source(
      '../pages/api/studio/episodes/[episodeId]/guest-questionnaire.js'
    ),
    source('../pages/api/studio/episodes/[episodeId]/mic-kit.js'),
  ]);

  const questionnaireHandler = questionnaire.indexOf(
    'export default async function handler'
  );
  const questionnaireGuard = questionnaire.indexOf(
    'getHostDraftObserverMutationBlocker({',
    questionnaire.indexOf("if (!req.headers['content-type']", questionnaireHandler)
  );
  const questionnaireWrite = questionnaire.indexOf(
    'saveGuestQuestionnaireWithEpisode(',
    questionnaireGuard
  );
  assert.ok(questionnaireGuard > questionnaireHandler);
  assert.ok(questionnaireWrite > questionnaireGuard);
  assert.match(questionnaire, /host_draft_read_only: hostDraftReadOnly/);
  assert.match(
    questionnaire,
    /const canViewShipping =\s*!hostDraftReadOnly/
  );

  const micKitPost = micKit.indexOf("if (req.method === 'POST')");
  const micKitGuard = micKit.indexOf(
    'getHostDraftObserverMutationBlocker({',
    micKitPost
  );
  const micKitWrite = micKit.indexOf(
    'upsertEpisodeMicKitEquipmentReviewRequest({',
    micKitPost
  );
  assert.ok(micKitGuard > micKitPost);
  assert.ok(micKitWrite > micKitGuard);
  assert.match(micKit, /host_draft_read_only: hostDraftReadOnly/);
  assert.match(micKit, /!hostDraftReadOnly && canRequestForGuest\(access\)/);
});
