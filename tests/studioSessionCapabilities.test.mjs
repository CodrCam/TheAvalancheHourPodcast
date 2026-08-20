import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveStudioSessionCapabilities } from '../lib/studioSessionCapabilities.mjs';

test('episode managers receive Producer Tasks without a linked profile', () => {
  assert.deepEqual(
    deriveStudioSessionCapabilities({ permissions: ['episodes:manage'] }),
    { producer_tasks: true }
  );
});

test('an active producer profile receives Producer Tasks without an assignment', () => {
  assert.deepEqual(
    deriveStudioSessionCapabilities({
      permissions: ['episodes:read'],
      personId: 'producer-one',
      person: {
        person_id: 'producer-one',
        active: true,
        studioRoles: ['producer'],
      },
    }),
    { producer_tasks: true }
  );
});

test('episode assignments do not substitute for an active producer profile', () => {
  const assignedHost = deriveStudioSessionCapabilities({
    permissions: ['episodes:read'],
    personId: 'person-one',
    person: { active: true, studioRoles: ['host'] },
    episodes: [
      {
        producer_person_id: 'person-one',
        production_tasks: [
          { assigned_person_ids: ['person-one', 'another-person'] },
        ],
      },
    ],
  });

  assert.equal(assignedHost.producer_tasks, false);
});

test('an ordinary host receives no Producer Tasks capability', () => {
  assert.deepEqual(
    deriveStudioSessionCapabilities({
      permissions: ['episodes:read'],
      personId: 'host-one',
      person: { active: true, studioRoles: ['host'] },
      episodes: [
        {
          producer_person_id: 'producer-one',
          production_tasks: [{ assigned_person_ids: ['producer-one'] }],
        },
      ],
    }),
    { producer_tasks: false }
  );
});

test('an inactive producer profile does not receive Producer Tasks', () => {
  for (const active of [false, undefined]) {
    assert.deepEqual(
      deriveStudioSessionCapabilities({
        permissions: ['episodes:read'],
        personId: 'producer-one',
        person: {
          person_id: 'producer-one',
          active,
          studioRoles: ['producer'],
        },
      }),
      { producer_tasks: false }
    );
  }
});
