import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateEpisodeReminderEntries,
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

test('does not generate reminders for a deleted episode', () => {
  const entries = generateEpisodeReminderEntries(
    [
      {
        episode_id: 'deleted-episode',
        title: 'Deleted Episode',
        status: 'in_progress',
        deleted_at: '2026-08-01T08:00:00.000Z',
        due_date: '2026-08-02',
        host_person_ids: ['host-1'],
        producer_person_id: 'producer-1',
        assets: [
          {
            asset_id: 'asset-one',
            retention_expires_at: '2026-08-10T12:00:00.000Z',
          },
        ],
        production_tasks: [
          {
            task_id: 'overdue-task',
            label: 'Overdue production task',
            owner_type: 'hosts',
            due_date: '2026-08-02',
            required: true,
            status: 'not_started',
          },
        ],
      },
    ],
    {
      today: '2026-08-04',
      generatedAt: '2026-08-04T08:00:00.000Z',
      adminPersonIds: ['admin-1'],
    }
  );

  assert.deepEqual(entries, []);
});

test('includes configured admins in episode reminders with grouped observer records', () => {
  const entries = generateStudioReminderEntries(
    {
      episodes: [
        {
          episode_id: 'admin-reminder',
          title: 'Admin Reminder',
          status: 'in_progress',
          due_date: '2026-07-26',
          host_person_ids: ['host-1'],
          producer_person_id: 'producer-1',
        },
      ],
    },
    {
      today: '2026-07-25',
      generatedAt: '2026-07-25T08:00:00.000Z',
      adminPersonIds: ['cam-griffin', 'caleb-merrill'],
    }
  );

  assert.deepEqual(
    entries
      .map((entry) => entry.notification.recipient_person_id)
      .sort(),
    ['caleb-merrill', 'cam-griffin', 'host-1']
  );
  assert.ok(
    entries
      .filter((entry) =>
        ['cam-griffin', 'caleb-merrill'].includes(
          entry.notification.recipient_person_id
        )
      )
      .every(
        (entry) =>
          entry.notification.audit.recipient_reason ===
          'studio_admin_observer'
      )
  );
});

test('uses task deadlines for configured production workflows without legacy duplicate reminders', () => {
  const entries = generateStudioReminderEntries(
    {
      episodes: [
        {
          episode_id: 'workflow-episode',
          title: 'Workflow Episode',
          status: 'accepted',
          due_date: '2026-08-03',
          host_person_ids: ['host-1'],
          producer_person_id: 'producer-1',
          created_by_person_id: 'creator-1',
          production_tasks: [
            {
              task_id: 'intro-ready',
              label: 'Introduction ready',
              owner_type: 'hosts',
              assigned_person_ids: [],
              due_date: '2026-08-03',
              required: true,
              status: 'not_started',
            },
            {
              task_id: 'producer-proof-upload',
              label: 'Private producer proof uploaded',
              owner_type: 'person',
              assigned_person_ids: ['angie-link'],
              due_date: '2026-08-02',
              required: true,
              status: 'in_progress',
            },
            {
              task_id: 'already-done',
              label: 'Already done',
              owner_type: 'producer',
              assigned_person_ids: [],
              due_date: '2026-08-01',
              required: true,
              status: 'completed',
            },
            {
              task_id: 'proof-listen-approval',
              label: 'Proof approval missing its proof',
              owner_type: 'hosts',
              assigned_person_ids: [],
              due_date: '2026-08-02',
              required: true,
              status: 'complete',
              kind: 'proof',
              proof_decision: 'approved',
              completed_at: '2026-08-01T08:00:00.000Z',
            },
          ],
        },
      ],
    },
    {
      today: '2026-08-03',
      generatedAt: '2026-08-03T08:00:00.000Z',
      adminPersonIds: ['admin-1'],
    }
  );

  assert.equal(
    entries.some((entry) =>
      ['episode_host_deadline_approaching', 'episode_overdue'].includes(
        entry.notification.type
      )
    ),
    false
  );
  assert.deepEqual(
    entries
      .filter(
        (entry) =>
          entry.notification.entity_id ===
          'workflow-episode:intro-ready'
      )
      .map((entry) => entry.notification.recipient_person_id)
      .sort(),
    ['admin-1', 'host-1']
  );
  const overdue = entries.filter(
    (entry) =>
      entry.notification.entity_id ===
      'workflow-episode:producer-proof-upload'
  );
  assert.deepEqual(
    overdue
      .map((entry) => entry.notification.recipient_person_id)
      .sort(),
    ['admin-1', 'angie-link', 'creator-1', 'host-1', 'producer-1']
  );
  assert.ok(
    overdue.every(
      (entry) =>
        entry.notification.type ===
          'episode_production_task_overdue' &&
        entry.notification.urgency === 'urgent' &&
        /automatically off track/i.test(entry.notification.preview) &&
        entry.notification.deep_link ===
          '/studio/episodes/workflow-episode/production#production-workflow'
    )
  );
  assert.equal(
    entries.some((entry) =>
      entry.notification.entity_id.endsWith(':already-done')
    ),
    false
  );
  assert.equal(
    entries.some(
      (entry) =>
        entry.notification.entity_id ===
          'workflow-episode:proof-listen-approval' &&
        entry.notification.type === 'episode_production_task_overdue'
    ),
    true
  );
});
