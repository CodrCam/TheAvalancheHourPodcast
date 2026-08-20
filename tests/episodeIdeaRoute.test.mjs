import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(
  path.join(root, 'pages/api/studio/episode-ideas.js'),
  'utf8'
);
const storeSource = fs.readFileSync(
  path.join(root, 'lib/studioEpisodeIdeaStore.js'),
  'utf8'
);

test('episode idea API derives ownership and keeps private drafts out of the team projection', () => {
  assert.match(source, /getStudioBindingForSubject\(principal\.subject\)/);
  assert.match(source, /canViewEpisodeIdea\(idea/);
  assert.match(source, /canViewTeam: context\.canViewTeam/);
  assert.doesNotMatch(source, /owner_person_id:\s*req\.body/);
});

test('episode idea creation requires and safely replays an owner-scoped request key', () => {
  assert.match(source, /normalizeStudioEpisodeIdeaRequestId/);
  assert.match(source, /createDeterministicStudioEpisodeIdeaId/);
  assert.match(source, /bindStudioEpisodeIdeaCreation/);
  assert.match(source, /EPISODE_IDEA_REQUEST_ID_REQUIRED/);
  assert.match(source, /saved\.idempotent \? 200 : 201/);
  assert.match(storeSource, /creation_fingerprint/);
});

test('episode idea API separates owner mutations from manager decisions', () => {
  assert.match(source, /OWNER_ACTIONS/);
  assert.match(source, /MANAGER_ACTIONS/);
  assert.match(source, /current\.idea\.owner_person_id !== viewer\.person_id/);
  assert.match(source, /ADMIN_PERMISSIONS\.INTAKE_MANAGE/);
  assert.match(source, /expectedUpdatedAt: req\.body\?\.expected_updated_at/);
  assert.match(source, /EPISODE_IDEA_STORAGE_UNAVAILABLE/);
});

test('approval validates the transition before atomically creating the planning Follow-up', () => {
  assert.match(source, /buildEpisodeIdeaIntakeItem\(current\.idea\)/);
  assert.match(source, /reviewEpisodeIdea\(current\.idea, action, viewer/);
  assert.match(source, /approveStudioEpisodeIdea\(next, intake/);
  assert.match(storeSource, /dynamoDbRequest\('TransactWriteItems'/);
  assert.match(storeSource, /attribute_not_exists\(#key\)/);
  assert.match(storeSource, /#updated_at = :expected_updated_at/);
  assert.match(source, /episodeIdeaApprovalReplayState/);
  assert.match(source, /episodeIdeaPlanningFollowUpMatches/);
  assert.match(source, /outcome: 'idempotent'/);
  assert.match(source, /EPISODE_IDEA_APPROVAL_REPAIR_REQUIRED/);
});
