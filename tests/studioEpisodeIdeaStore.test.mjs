import assert from 'node:assert/strict';
import test from 'node:test';
import { createEpisodeIdeaRecord } from '../lib/episodeIdea.mjs';

test('replays one owner-scoped creation request without duplicating a pitch', async () => {
  const previousEnv = {
    table: process.env.DYNAMODB_SITE_CONTENT_TABLE,
    accessKey: process.env.DYNAMODB_ACCESS_KEY_ID,
    secretKey: process.env.DYNAMODB_SECRET_ACCESS_KEY,
  };
  const previousFetch = globalThis.fetch;
  let storedRow = null;
  let putCount = 0;

  process.env.DYNAMODB_SITE_CONTENT_TABLE = 'TestSiteContent';
  process.env.DYNAMODB_ACCESS_KEY_ID = 'test-access-key';
  process.env.DYNAMODB_SECRET_ACCESS_KEY = 'test-secret-key';
  globalThis.fetch = async (_url, options = {}) => {
    const target = options.headers?.['x-amz-target'] || '';
    const body = JSON.parse(options.body || '{}');
    if (target.endsWith('.PutItem')) {
      putCount += 1;
      if (!storedRow) {
        storedRow = body.Item;
        return { ok: true, text: async () => '{}' };
      }
      return {
        ok: false,
        status: 400,
        text: async () =>
          JSON.stringify({
            __type: 'ConditionalCheckFailedException',
            message: 'The conditional request failed',
          }),
      };
    }
    if (target.endsWith('.GetItem')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ Item: storedRow }),
      };
    }
    throw new Error(`Unexpected DynamoDB target: ${target}`);
  };

  try {
    const store = await import(
      `../lib/studioEpisodeIdeaStore.js?idempotency=${Date.now()}`
    );
    const requestId = '11111111-1111-4111-8111-111111111111';
    const actor = { person_id: 'Host A', name: 'Host A' };
    const ideaId = store.createDeterministicStudioEpisodeIdeaId({
      ownerPersonId: actor.person_id,
      requestId,
    });
    const idea = store.bindStudioEpisodeIdeaCreation(
      createEpisodeIdeaRecord(
        {
          working_title: 'Wind loading decisions',
          premise: 'Explore the observations that changed a terrain decision.',
          planning_horizon: 'current_season',
        },
        actor,
        {
          ideaId,
          submit: true,
          now: '2026-08-19T12:00:00.000Z',
        }
      ),
      { requestId }
    );

    const created = await store.createStudioEpisodeIdea(idea);
    const replayed = await store.createStudioEpisodeIdea(idea);

    assert.equal(created.idempotent, false);
    assert.equal(replayed.idempotent, true);
    assert.equal(replayed.idea.idea_id, created.idea.idea_id);
    assert.equal(putCount, 2);

    const changed = store.bindStudioEpisodeIdeaCreation(
      createEpisodeIdeaRecord(
        {
          working_title: 'Different pitch with reused key',
          premise: 'This should never replace the original creation request.',
          planning_horizon: 'future',
        },
        actor,
        {
          ideaId,
          submit: true,
          now: '2026-08-19T12:00:00.000Z',
        }
      ),
      { requestId }
    );
    await assert.rejects(
      () => store.createStudioEpisodeIdea(changed),
      /creation request was already used/i
    );
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of Object.entries({
      DYNAMODB_SITE_CONTENT_TABLE: previousEnv.table,
      DYNAMODB_ACCESS_KEY_ID: previousEnv.accessKey,
      DYNAMODB_SECRET_ACCESS_KEY: previousEnv.secretKey,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
