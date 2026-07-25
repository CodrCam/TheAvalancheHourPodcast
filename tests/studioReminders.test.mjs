import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateStudioReminderEntries,
} from '../lib/studioReminderGenerator.mjs';

test('generates deterministic episode and mic kit reminders without private data', () => {
  const input = {
    episodes: [
      {
        episode_id: 'episode-one',
        title: 'Episode One',
        due_date: '2026-07-27',
        status: 'in_progress',
        host_person_ids: ['host-1'],
        producer_person_id: 'producer-1',
      },
    ],
    micKitTracker: {
      requests: [
        {
          request_id: 'request-current',
          requester_person_id: 'host-1',
          shipping: { address_line_1: 'PRIVATE ADDRESS' },
        },
      ],
      kits: [
        {
          kit_id: 'kit-1',
          label: 'Kit One',
          checked_out_request_id: 'request-current',
          due_back: '2026-07-24',
        },
      ],
    },
  };
  const options = {
    today: '2026-07-25',
    generatedAt: '2026-07-25T08:00:00.000Z',
  };
  const first = generateStudioReminderEntries(input, options);
  const retry = generateStudioReminderEntries(input, options);

  assert.deepEqual(
    first.map((entry) => entry.dedupe_key),
    retry.map((entry) => entry.dedupe_key)
  );
  assert.ok(
    first.some(
      (entry) =>
        entry.notification.type === 'episode_host_deadline_approaching'
    )
  );
  assert.ok(
    first.some(
      (entry) => entry.notification.type === 'mic_kit_return_overdue'
    )
  );
  assert.equal(JSON.stringify(first).includes('PRIVATE ADDRESS'), false);
});

test('warns episode participants before accepted-episode assets expire', () => {
  const entries = generateStudioReminderEntries(
    {
      episodes: [
        {
          episode_id: 'accepted-episode',
          title: 'Accepted Episode',
          status: 'accepted',
          host_person_ids: ['host-1'],
          producer_person_id: 'producer-1',
          assets: [
            {
              asset_id: 'asset-one',
              file_name: 'private-master.wav',
              retention_expires_at: '2027-01-21T12:00:00.000Z',
            },
          ],
        },
      ],
    },
    {
      today: '2027-01-01',
      generatedAt: '2027-01-01T08:00:00.000Z',
    }
  );

  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => entry.notification.recipient_person_id).sort(),
    ['host-1', 'producer-1']
  );
  assert.ok(
    entries.every(
      (entry) =>
        entry.notification.type === 'episode_assets_expiring' &&
        entry.notification.due_date === '2027-01-21' &&
        entry.notification.deep_link ===
          '/studio/episodes/accepted-episode#final-assets'
    )
  );
  assert.equal(JSON.stringify(entries).includes('private-master.wav'), false);
});
