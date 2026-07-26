import test from 'node:test';
import assert from 'node:assert/strict';

test('notification storage suppresses duplicates and uses indexed cursor queries', async () => {
  const previousEnv = {
    table: process.env.DYNAMODB_SITE_CONTENT_TABLE,
    index: process.env.DYNAMODB_STUDIO_NOTIFICATIONS_INDEX,
    accessKey: process.env.DYNAMODB_ACCESS_KEY_ID,
    secretKey: process.env.DYNAMODB_SECRET_ACCESS_KEY,
  };
  const previousFetch = globalThis.fetch;
  const requests = [];
  let putCount = 0;
  let pageCount = 0;
  const content = {
    notification_id: 'notice-one',
    recipient_person_id: 'host-1',
    type: 'episode_package_submitted',
    category: 'episode',
    title: 'Episode One is ready',
    preview: 'Review the package.',
    entity_kind: 'episode',
    entity_id: 'episode-one',
    group_entity_kind: 'episode',
    group_entity_id: 'episode-one',
    deep_link: '/studio/episodes/episode-one',
    created_at: '2026-07-25T12:00:00.000Z',
  };
  const item = {
    content_key: { S: 'studio_notification#host-1#notice-one' },
    content_json: { S: JSON.stringify(content) },
    notification_recipient: { S: 'recipient#host-1' },
    notification_sort: {
      S: '2026-07-25T12:00:00.000Z#notice-one',
    },
    notification_unread: { N: '1' },
  };

  process.env.DYNAMODB_SITE_CONTENT_TABLE = 'TestSiteContent';
  process.env.DYNAMODB_STUDIO_NOTIFICATIONS_INDEX =
    'studio-notifications-index';
  process.env.DYNAMODB_ACCESS_KEY_ID = 'test-access-key';
  process.env.DYNAMODB_SECRET_ACCESS_KEY = 'test-secret-key';

  globalThis.fetch = async (_url, options = {}) => {
    const target = options.headers?.['x-amz-target'] || '';
    const body = JSON.parse(options.body || '{}');
    requests.push({ target, body });
    if (target.endsWith('.PutItem')) {
      putCount += 1;
      if (putCount > 1) {
        return {
          ok: false,
          text: async () =>
            JSON.stringify({
              message: 'ConditionalCheckFailedException',
            }),
        };
      }
      return { ok: true, text: async () => '{}' };
    }
    if (target.endsWith('.Query') && body.Select === 'COUNT') {
      return {
        ok: true,
        text: async () => JSON.stringify({ Count: 1 }),
      };
    }
    if (target.endsWith('.Query')) {
      pageCount += 1;
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            Items: pageCount === 1 ? [item] : [],
            ...(pageCount === 1
              ? {
                  LastEvaluatedKey: {
                    content_key: item.content_key,
                    notification_recipient: item.notification_recipient,
                    notification_sort: item.notification_sort,
                  },
                }
              : {}),
          }),
      };
    }
    if (target.endsWith('.UpdateItem')) {
      const markingRead = body.UpdateExpression.includes('REMOVE #unread');
      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            Attributes: {
              ...item,
              read_at: {
                S: markingRead
                  ? body.ExpressionAttributeValues[':read_at'].S
                  : '',
              },
            },
          }),
      };
    }
    return { ok: true, text: async () => '{}' };
  };

  try {
    const store = await import(
      `../lib/studioNotificationStore.js?test=${Date.now()}`
    );
    const entry = {
      recipient_person_id: 'host-1',
      type: 'episode_package_submitted',
      category: 'episode',
      title: 'Episode One is ready',
      preview: 'Review the package.',
      entity_kind: 'episode',
      entity_id: 'episode-one',
      group_entity_kind: 'episode',
      group_entity_id: 'episode-one',
      deep_link: '/studio/episodes/episode-one',
    };
    const first = await store.createStudioNotification(entry, {
      dedupeKey: 'episode:submitted:episode-one:version-1:host-1',
    });
    const retry = await store.createStudioNotification(entry, {
      dedupeKey: 'episode:submitted:episode-one:version-1:host-1',
    });
    assert.equal(first.created, true);
    assert.equal(retry.duplicate, true);
    assert.equal(
      requests.filter((request) => request.target.endsWith('.Scan')).length,
      0
    );
    const put = requests.find((request) =>
      request.target.endsWith('.PutItem')
    ).body;
    assert.equal(
      put.Item.notification_recipient.S,
      'recipient#host-1'
    );
    assert.equal(put.Item.notification_unread.N, '1');
    assert.match(
      put.Item.content_json.S,
      /"idempotency_key_hash":"[a-f0-9]{64}"/
    );

    const page = await store.listStudioNotifications('host-1', {
      limit: 20,
    });
    assert.equal(page.notifications.length, 1);
    assert.equal(page.unread_count, 1);
    assert.ok(page.next_cursor);
    await store.listStudioNotifications('host-1', {
      limit: 20,
      cursor: page.next_cursor,
    });
    const listQueries = requests.filter(
      (request) =>
        request.target.endsWith('.Query') &&
        request.body.Select !== 'COUNT'
    );
    assert.equal(listQueries.length, 2);
    assert.deepEqual(
      listQueries[1].body.ExclusiveStartKey,
      {
        content_key: {
          S: 'studio_notification#host-1#notice-one',
        },
        notification_recipient: { S: 'recipient#host-1' },
        notification_sort: {
          S: '2026-07-25T12:00:00.000Z#notice-one',
        },
      }
    );
    assert.equal(
      listQueries.every(
        (request) =>
          request.body.IndexName === 'studio-notifications-index'
      ),
      true
    );
    assert.throws(
      () =>
        store.decodeStudioNotificationCursor(
          page.next_cursor,
          'different-host'
        ),
      /invalid/
    );

    const read = await store.markStudioNotificationRead(
      'host-1',
      'notice-one',
      true
    );
    assert.ok(read.read_at);
    const unread = await store.markStudioNotificationRead(
      'host-1',
      'notice-one',
      false
    );
    assert.equal(unread.read_at, '');
    const updates = requests.filter((request) =>
      request.target.endsWith('.UpdateItem')
    );
    assert.match(updates[0].body.UpdateExpression, /REMOVE #unread/);
    assert.equal(
      updates[1].body.ExpressionAttributeValues[':unread'].N,
      '1'
    );
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of Object.entries({
      DYNAMODB_SITE_CONTENT_TABLE: previousEnv.table,
      DYNAMODB_STUDIO_NOTIFICATIONS_INDEX: previousEnv.index,
      DYNAMODB_ACCESS_KEY_ID: previousEnv.accessKey,
      DYNAMODB_SECRET_ACCESS_KEY: previousEnv.secretKey,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test('notification setup errors distinguish missing GSI access from ordinary failures', async () => {
  const store = await import(
    `../lib/studioNotificationStore.js?setup=${Date.now()}`
  );
  assert.deepEqual(
    store.getStudioNotificationSetupIssue(
      new Error(
        'User is not authorized to perform: dynamodb:Query on resource: arn:aws:dynamodb:us-east-2:123:table/SiteContent/index/studio-notifications-index'
      )
    ),
    {
      code: 'NOTIFICATION_INDEX_QUERY_NOT_AUTHORIZED',
      reason: 'notification_index_query_permission_missing',
    }
  );
  assert.deepEqual(
    store.getStudioNotificationSetupIssue(
      new Error('The table does not have the specified index')
    ),
    {
      code: 'NOTIFICATION_INDEX_NOT_READY',
      reason: 'notification_index_missing_or_inactive',
    }
  );
  assert.equal(
    store.getStudioNotificationSetupIssue(
      new Error('Connection timed out')
    ),
    null
  );
});
