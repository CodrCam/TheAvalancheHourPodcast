import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStudioNotification,
  plainTextPreview,
  safeStudioDeepLink,
} from '../lib/studioNotificationPresentation.mjs';
import {
  buildEpisodeNotificationEntries,
} from '../lib/episodeStudioEvents.js';
import {
  buildMicKitNotificationEntries,
} from '../lib/micKitEvents.js';

test('notification previews are plain text and deep links stay same-origin', () => {
  assert.equal(
    plainTextPreview('<img src=x onerror=alert(1)> Hello <b>team</b>'),
    'Hello team'
  );
  assert.equal(safeStudioDeepLink('/studio/episodes/one#discussion'), '/studio/episodes/one#discussion');
  assert.equal(safeStudioDeepLink('https://evil.example'), '');
  assert.equal(safeStudioDeepLink('//evil.example'), '');

  const notification = normalizeStudioNotification({
    notification_id: 'notice-1',
    recipient_person_id: 'host-1',
    type: 'episode_discussion_message',
    title: '<script>bad()</script> Update',
    preview: '<b>Safe preview</b>',
    deep_link: '/studio/episodes/one',
  });
  assert.equal(notification.title, 'bad() Update');
  assert.equal(notification.preview, 'Safe preview');
});

test('discussion events notify episode participants but exclude the author', () => {
  const entries = buildEpisodeNotificationEntries({
    previousEpisode: {
      episode_id: 'one',
      host_person_ids: ['host-1', 'host-2'],
      producer_person_id: 'producer-1',
      created_by_person_id: 'creator-1',
    },
    episode: {
      episode_id: 'one',
      title: 'Episode One',
      host_person_ids: ['host-1', 'host-2'],
      producer_person_id: 'producer-1',
      created_by_person_id: 'creator-1',
      updated_at: '2026-07-25T12:00:00.000Z',
      messages: [
        {
          message_id: 'message-1',
          body: '<b>Question</b> about the ad read',
        },
      ],
    },
    action: 'message',
    actorPersonId: 'host-1',
    actorName: 'Host One',
  });
  assert.deepEqual(
    entries.map((entry) => entry.notification.recipient_person_id).sort(),
    ['creator-1', 'host-2', 'producer-1']
  );
  assert.equal(entries[0].notification.preview.includes('<'), false);
});

test('mic kit tracking events never include tracking data in previews', () => {
  const entries = buildMicKitNotificationEntries({
    previousTracker: {
      requests: [
        {
          request_id: 'request-1',
          requester_person_id: 'host-1',
        },
      ],
      kits: [
        {
          kit_id: 'kit-1',
          next_request_id: 'request-1',
          tracking_number: '',
          tracking_url: '',
        },
      ],
    },
    tracker: {
      updated_at: '2026-07-25T12:00:00.000Z',
      requests: [
        {
          request_id: 'request-1',
          requester_person_id: 'host-1',
        },
      ],
      kits: [
        {
          kit_id: 'kit-1',
          label: 'Kit One',
          next_request_id: 'request-1',
          tracking_number: 'SECRET-TRACKING',
          tracking_url: 'https://carrier.example/SECRET-TRACKING',
        },
      ],
    },
    action: 'update_kit',
  });
  assert.equal(entries.length, 1);
  assert.equal(
    JSON.stringify(entries[0].notification).includes('SECRET-TRACKING'),
    false
  );
});
