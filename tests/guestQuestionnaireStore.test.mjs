import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultGuestQuestionnaire } from '../lib/guestQuestionnairePresentation.mjs';
import { createDefaultEpisodeDeliverables } from '../lib/episodeStudioPresentation.mjs';

test('stores, atomically applies, and conditionally deletes questionnaire PII under a separate content key', async () => {
  const previousEnv = {
    table: process.env.DYNAMODB_SITE_CONTENT_TABLE,
    accessKey: process.env.DYNAMODB_ACCESS_KEY_ID,
    secretKey: process.env.DYNAMODB_SECRET_ACCESS_KEY,
  };
  const previousFetch = globalThis.fetch;
  const requests = [];

  process.env.DYNAMODB_SITE_CONTENT_TABLE = 'TestSiteContent';
  process.env.DYNAMODB_ACCESS_KEY_ID = 'test-access-key';
  process.env.DYNAMODB_SECRET_ACCESS_KEY = 'test-secret-key';
  globalThis.fetch = async (_url, options = {}) => {
    const target = options.headers?.['x-amz-target'] || '';
    const body = JSON.parse(options.body || '{}');
    requests.push({ target, body });
    return {
      ok: true,
      text: async () =>
        JSON.stringify(
          target.endsWith('.DeleteItem')
            ? {
                Attributes: {
                  content_key: {
                    S: 'guest_questionnaire#episode-one',
                  },
                },
              }
            : {}
        ),
    };
  };

  try {
    const store = await import(
      `../lib/guestQuestionnaireStore.js?test=${Date.now()}`
    );
    const record = createDefaultGuestQuestionnaire('episode-one');
    record.response = {
      ...record.response,
      status: 'submitted',
      response_id: 'response-one',
      revision: 1,
      answers: {
        guest_name: 'Alex Guest',
        shipping_address_line_1: '123 Private Lane',
        shipping_postal_code: '99999',
      },
      submitted_at: '2026-08-04T12:00:00.000Z',
      updated_at: '2026-08-04T12:00:00.000Z',
    };
    const created = await store.saveGuestQuestionnaire(record, {
      expectedUpdatedAt: '',
    });
    const episode = {
      episode_id: 'episode-one',
      title: 'Episode One',
      target_release_date: '2026-09-01',
      host_person_ids: ['host-one'],
      deliverables: createDefaultEpisodeDeliverables(),
      created_at: '2026-08-01T12:00:00.000Z',
      updated_at: '2026-08-03T12:00:00.000Z',
    };
    const applied = await store.saveGuestQuestionnaireWithEpisode(
      { questionnaire: created.questionnaire, episode },
      {
        expectedQuestionnaireUpdatedAt: created.questionnaire.updated_at,
        expectedEpisodeUpdatedAt: episode.updated_at,
      }
    );
    const batch = await store.getGuestQuestionnairesByEpisodeIds([
      'episode-one',
      'episode-one',
      'episode-two',
    ]);
    const deleted = await store.deleteGuestQuestionnaire('episode-one', {
      expectedUpdatedAt: applied.questionnaire.updated_at,
    });
    const deletedTogether =
      await store.deleteGuestQuestionnaireWithEpisode('episode-one', {
        expectedQuestionnaireUpdatedAt: applied.questionnaire.updated_at,
        expectedEpisodeUpdatedAt: episode.updated_at,
      });
    const finalized =
      await store.finalizeGuestQuestionnaireDeletionWithEpisodeTombstone(
        {
          ...episode,
          title: 'Private Guest Name',
          deleted_at: '2026-08-04T13:00:00.000Z',
          asset_upload_grants_expire_at: '2026-08-04T14:00:00.000Z',
          messages: [{ body: 'private production note' }],
        },
        {
          expectedQuestionnaireUpdatedAt: applied.questionnaire.updated_at,
          expectedEpisodeUpdatedAt: episode.updated_at,
          finalizedAt: '2026-08-04T14:01:00.000Z',
        }
      );

    assert.equal(deleted.deleted, true);
    assert.equal(deletedTogether.deleted, true);
    assert.equal(finalized.questionnaire_deleted, true);
    assert.equal(finalized.episode.title, 'Deleted Episode Studio');
    assert.equal(batch.configured, true);
    const batchRequest = requests.find((request) =>
      request.target.endsWith('.BatchGetItem')
    ).body;
    assert.deepEqual(
      batchRequest.RequestItems.TestSiteContent.Keys.map(
        (key) => key.content_key.S
      ),
      [
        'guest_questionnaire#episode-one',
        'guest_questionnaire#episode-two',
      ]
    );
    assert.equal(
      batchRequest.RequestItems.TestSiteContent.ConsistentRead,
      true
    );
    const createRequest = requests.find((request) =>
      request.target.endsWith('.PutItem')
    ).body;
    assert.equal(
      createRequest.Item.content_key.S,
      'guest_questionnaire#episode-one'
    );
    assert.equal(
      createRequest.ConditionExpression,
      'attribute_not_exists(#key)'
    );

    const transaction = requests.find((request) =>
      request.target.endsWith('.TransactWriteItems')
    ).body;
    const episodePut = transaction.TransactItems[0].Put;
    const questionnairePut = transaction.TransactItems[1].Put;
    assert.equal(
      episodePut.Item.content_key.S,
      'episode_studio#episode-one'
    );
    assert.equal(
      episodePut.ConditionExpression,
      '#updated_at = :expected_updated_at'
    );
    assert.equal(
      episodePut.ExpressionAttributeValues[':expected_updated_at'].S,
      episode.updated_at
    );
    assert.equal(
      questionnairePut.Item.content_key.S,
      'guest_questionnaire#episode-one'
    );
    assert.doesNotMatch(
      episodePut.Item.content_json.S,
      /123 Private Lane|99999/
    );
    assert.match(
      questionnairePut.Item.content_json.S,
      /123 Private Lane/
    );
    const deleteRequest = requests.find((request) =>
      request.target.endsWith('.DeleteItem')
    ).body;
    assert.equal(
      deleteRequest.Key.content_key.S,
      'guest_questionnaire#episode-one'
    );
    assert.equal(
      deleteRequest.ExpressionAttributeValues[':expected_updated_at'].S,
      applied.questionnaire.updated_at
    );
    const deleteTransaction = requests
      .filter((request) =>
        request.target.endsWith('.TransactWriteItems')
      )
      .map((request) => request.body)
      .find((body) => body.TransactItems.every((item) => item.Delete));
    assert.deepEqual(
      deleteTransaction.TransactItems.map(
        (item) => item.Delete.Key.content_key.S
      ),
      [
        'guest_questionnaire#episode-one',
        'episode_studio#episode-one',
      ]
    );
    assert.equal(
      deleteTransaction.TransactItems[1].Delete.ExpressionAttributeValues[
        ':expected_updated_at'
      ].S,
      episode.updated_at
    );
    const tombstoneTransaction = requests
      .filter((request) =>
        request.target.endsWith('.TransactWriteItems')
      )
      .map((request) => request.body)
      .find(
        (body) =>
          body.TransactItems[0]?.Delete &&
          body.TransactItems[1]?.Put
      );
    const tombstoneJson =
      tombstoneTransaction.TransactItems[1].Put.Item.content_json.S;
    assert.match(tombstoneJson, /Deleted Episode Studio/);
    assert.doesNotMatch(
      tombstoneJson,
      /Private Guest Name|private production note|123 Private Lane/
    );
    assert.ok(tombstoneJson.length < 1000);
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
