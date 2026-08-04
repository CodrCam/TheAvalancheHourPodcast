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
  assert.ok(project > 0);
  assert.ok(apply > project);
  assert.ok(save > apply);
  assert.match(submissionBlock, /questionnaire: autoFilledRecord/);
  assert.match(submissionBlock, /episode: applied\.episode/);

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
