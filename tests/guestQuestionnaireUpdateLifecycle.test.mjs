import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('the Studio exposes one audited corrected-response action and a one-time new link', async () => {
  const route = await source(
    '../pages/api/studio/episodes/[episodeId]/guest-questionnaire.js'
  );

  assert.match(route, /'request_update'/);
  assert.match(route, /can_request_update: canRequestUpdate/);
  assert.match(route, /reopenGuestQuestionnaireResponse\(record/);
  assert.match(route, /reopenGuestQuestionnaireWorkflowForUpdate/);
  assert.match(route, /share_path: `\/studio\/guest-questionnaire#token=/);
  assert.match(route, /guest_questionnaire\.\$\{action\}/);
  assert.match(
    route,
    /record\.response\.status === 'update_requested'[\s\S]*status: 'submitted'/
  );
});

test('the private update link exposes only the bounded correction draft to its guest', async () => {
  const [publicRoute, form] = await Promise.all([
    source('../pages/api/guest-questionnaire.js'),
    source('../components/GuestQuestionnaireForm.js'),
  ]);

  assert.match(publicRoute, /guestQuestionnaireUpdateDraft\(record\)/);
  assert.match(publicRoute, /update_draft: updateDraft/);
  assert.match(form, /data\.update_draft/);
  assert.match(form, /The episode team requested an updated response/);
  assert.match(form, /re-enter restricted shipping details/);
});
