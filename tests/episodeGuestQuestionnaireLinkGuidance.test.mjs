import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [workspaceSource, stylesheetSource, routeSource, tokenSource] =
  await Promise.all([
    readFile(
      new URL(
        '../components/EpisodeGuestQuestionnaireWorkspace.js',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL(
        '../styles/EpisodeGuestQuestionnaire.module.css',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL(
        '../pages/api/studio/episodes/[episodeId]/guest-questionnaire.js',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL('../lib/guestQuestionnaireToken.mjs', import.meta.url),
      'utf8'
    ),
  ]);

function between(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return source.slice(startIndex, endIndex);
}

test('questionnaire detail clearly separates resend from replacement access', () => {
  assert.match(workspaceSource, /Copy or resend/);
  assert.match(workspaceSource, /Keep the current link/);
  assert.match(workspaceSource, /Copying keeps this same link/);
  assert.match(workspaceSource, /Studio does not message the\s+guest for you/);
  assert.match(workspaceSource, /New or reissue/);
  assert.match(workspaceSource, /Issue a replacement link/);
  assert.match(workspaceSource, /current link\s+stops working immediately/);
  assert.match(
    workspaceSource,
    /revoke first, edit and save, then issue\s+the new link/
  );
  assert.match(workspaceSource, /Mark as sent to guest/);

  const copyAction = between(
    workspaceSource,
    'async function copyShareLink()',
    'async function markLinkShared()'
  );
  const issueAction = between(
    workspaceSource,
    'async function issueLink(',
    'async function revokeLink()'
  );
  assert.match(copyAction, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(copyAction, /action: 'issue_link'/);
  assert.match(issueAction, /action: 'issue_link'/);
});

test('replacement and revoke guidance matches the current token lifecycle', () => {
  assert.match(
    workspaceSource,
    /current link will stop working immediately[\s\S]*Responses already saved in Studio will be preserved/
  );
  assert.match(workspaceSource, /wrong recipient, a compromised link/);
  assert.match(workspaceSource, /access that is no longer needed/);
  assert.match(
    workspaceSource,
    /Revoking the link does\s+not delete responses already saved in Studio/
  );
  assert.match(
    workspaceSource,
    /Guest access will stop immediately[\s\S]*will not be deleted/
  );

  const issueBranch = between(
    routeSource,
    "} else if (action === 'issue_link')",
    "} else if (action === 'mark_shared')"
  );
  const revokeBranch = between(
    routeSource,
    "} else if (action === 'revoke_link')",
    '} else {'
  );
  assert.match(issueBranch, /token_jti_hash: issued\.token_jti_hash/);
  assert.match(tokenSource, /safeEqual\(tokenPayload\.token_jti_hash, link\.token_jti_hash\)/);
  assert.match(revokeBranch, /status: 'revoked'/);
  assert.match(revokeBranch, /token_jti_hash: ''/);
  assert.match(revokeBranch, /record\.response\.status === 'update_requested'/);
  assert.match(
    revokeBranch,
    /\? \{ \.\.\.record\.response, status: 'submitted' \}/
  );
});

test('submitted responses offer the authorized corrected-response lifecycle', () => {
  const requestUpdateAction = between(
    workspaceSource,
    'async function requestResponseUpdate()',
    'async function revokeLink()'
  );

  assert.match(requestUpdateAction, /if \(!canRequestUpdate\) return/);
  assert.match(requestUpdateAction, /action: 'request_update'/);
  assert.match(requestUpdateAction, /expires_in_days: expiresInDays/);
  assert.match(
    requestUpdateAction,
    /previous submission remains current until the guest submits the update/
  );
  assert.match(workspaceSource, /Need a corrected guest response\?/);
  assert.match(workspaceSource, /can_request_update/);
  assert.match(workspaceSource, /Request update \+ create link/);
  assert.match(workspaceSource, /Only the assigned producer or a Studio manager/);
  assert.match(
    workspaceSource,
    /Non-shipping answers are prefilled[\s\S]*restricted shipping details must[\s\S]*be entered again/
  );
});

test('an update request keeps the previous response review visible and explains cancellation', () => {
  assert.match(
    workspaceSource,
    /const responseReceived = \['submitted', 'update_requested'\]\.includes/
  );
  assert.match(workspaceSource, /\{responseReceived \? \(/);
  assert.match(workspaceSource, /Previous response remains current/);
  assert.match(workspaceSource, /Waiting for the corrected response/);
  assert.match(
    workspaceSource,
    /Revoking access[\s\S]*cancels this update request[\s\S]*restores the previous[\s\S]*submitted state/
  );

  const revokeAction = between(
    workspaceSource,
    'async function revokeLink()',
    'async function copyShareLink()'
  );
  assert.match(revokeAction, /responseRecord\?\.status === 'update_requested'/);
  assert.match(revokeAction, /previous submitted response will remain current/);
});

test('new guidance keeps existing capability checks and has dedicated styling', () => {
  assert.match(workspaceSource, /\{canIssue \? \(/);
  assert.match(workspaceSource, /activeLink && canIssue/);
  assert.match(workspaceSource, /activeLink && canRevoke/);
  assert.match(workspaceSource, /!canIssue && canRevoke && activeLink/);
  assert.match(stylesheetSource, /\.linkChoiceGuide/);
  assert.match(stylesheetSource, /\.linkChoiceReplacement/);
  assert.match(stylesheetSource, /\.revokeGuidance/);
  assert.match(stylesheetSource, /\.submittedUpdateNote/);
  assert.match(stylesheetSource, /\.requestUpdateButton/);
  assert.match(stylesheetSource, /\.updateRequestedNote/);
});
