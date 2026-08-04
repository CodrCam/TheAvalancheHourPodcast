import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

function between(value, start, end) {
  const startIndex = value.indexOf(start);
  const endIndex = value.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return value.slice(startIndex, endIndex);
}

test('questionnaire writes that depend on current Studio state are episode-version guarded', async () => {
  const publicRoute = await source('../pages/api/guest-questionnaire.js');
  const studioRoute = await source(
    '../pages/api/studio/episodes/[episodeId]/guest-questionnaire.js'
  );
  const persistenceRoute = studioRoute.slice(studioRoute.indexOf('let saved;'));

  assert.doesNotMatch(publicRoute, /\bsaveGuestQuestionnaire\s*\(/);
  assert.match(
    between(
      publicRoute,
      'const sentWorkflow =',
      'await publishSubmissionNotification('
    ),
    /saveGuestQuestionnaireWithEpisode\s*\(/
  );
  const submissionBlock = between(
    publicRoute,
    'const sentWorkflow =',
    'await publishSubmissionNotification('
  );
  const project = submissionBlock.indexOf(
    'projectGuestQuestionnaireResponse(nextRecord)'
  );
  const apply = submissionBlock.indexOf(
    'applyGuestQuestionnaireProjectionToEpisode(',
    project
  );
  const save = submissionBlock.indexOf(
    'saveGuestQuestionnaireWithEpisode(',
    apply
  );
  const micKitSync = submissionBlock.indexOf(
    'await syncGuestMicKitRequest(',
    save
  );
  assert.ok(project > 0);
  assert.ok(apply > project);
  assert.ok(save > apply);
  assert.ok(
    micKitSync > save,
    'private mic-kit data must not persist before the guarded questionnaire transaction'
  );
  assert.match(submissionBlock, /questionnaire: autoFilledRecord/);
  assert.match(submissionBlock, /episode: applied\.episode/);

  const applyResponseBlock = between(
    persistenceRoute,
    '} else {',
    '\n\n    logAdminAction('
  );
  const studioApply = applyResponseBlock.indexOf(
    'applyGuestQuestionnaireProjectionToEpisode('
  );
  const studioSave = applyResponseBlock.indexOf(
    'saveGuestQuestionnaireAutofill(',
    studioApply
  );
  const studioMicKitSync = applyResponseBlock.indexOf(
    'await syncGuestMicKitRequest(',
    studioSave
  );
  assert.ok(studioApply > 0);
  assert.ok(studioSave > studioApply);
  assert.ok(
    studioMicKitSync > studioSave,
    'applying a response must commit its episode changes before syncing the secondary mic-kit tracker'
  );
  assert.match(applyResponseBlock, /guestMicKitRequestId\(record\.episode_id\)/);

  for (const [start, end] of [
    ["if (action === 'save_configuration')", "} else if (action === 'issue_link')"],
    ["} else if (action === 'issue_link')", "} else if (action === 'mark_shared')"],
    ["} else if (action === 'revoke_link')", '} else {'],
  ]) {
    const actionBlock = between(persistenceRoute, start, end);
    assert.match(actionBlock, /saveGuestQuestionnaireWithEpisode\s*\(/);
    assert.doesNotMatch(actionBlock, /\bsaveGuestQuestionnaire\s*\(/);
    assert.match(actionBlock, /expectedEpisodeUpdatedAt/);
  }
});

test('questionnaires without a guest kit request do not depend on mic-kit storage', async () => {
  for (const path of [
    '../pages/api/guest-questionnaire.js',
    '../pages/api/studio/episodes/[episodeId]/guest-questionnaire.js',
  ]) {
    const route = await source(path);
    const syncHelper = between(
      route,
      'async function syncGuestMicKitRequest',
      'export default async function handler'
    );
    const choiceGuard = syncHelper.indexOf(
      "['request_kit', 'needs_follow_up'].includes(guestPlan?.choice)"
    );
    const trackerRead = syncHelper.indexOf('await getMicKitTracker()');
    assert.ok(choiceGuard >= 0, `${path} is missing the choice guard`);
    assert.ok(
      trackerRead > choiceGuard,
      `${path} reads mic-kit storage before checking whether it is needed`
    );
  }
});
