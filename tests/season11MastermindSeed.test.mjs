import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  SEASON_11_MASTERMIND_SEED_PAYLOAD,
  season11SeedUuid,
} from '../lib/season11MastermindSeed.mjs';

const seedSqlUrl = new URL(
  '../infra/aws/aurora/002_seed_season_11.sql',
  import.meta.url
);
const seedSql = await readFile(seedSqlUrl, 'utf8');
const payloadMatch = seedSql.match(
  /\$season11\$\n([\s\S]*?)\n\$season11\$::jsonb/
);

assert.ok(payloadMatch, 'seed SQL must contain one dollar-quoted JSON payload');
const committedPayload = JSON.parse(payloadMatch[1]);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sortedKeys(value) {
  return Object.keys(value).sort();
}

test('committed SQL payload exactly matches the reviewed Season 11 fixture', () => {
  assert.deepEqual(committedPayload, SEASON_11_MASTERMIND_SEED_PAYLOAD);
});

test('seed has the exact live relationship counts and deterministic UUIDs', () => {
  const plans = committedPayload.plans;
  const hosts = plans.flatMap((plan) => plan.hosts);
  const guests = plans.flatMap((plan) => plan.guests);
  const sponsors = plans.flatMap((plan) => plan.sponsor_commitments);
  const ids = [
    committedPayload.season.season_id,
    ...plans.map((plan) => plan.episode_plan_id),
    ...hosts.map((host) => host.episode_host_id),
    ...guests.map((guest) => guest.guest_id),
    ...sponsors.map((sponsor) => sponsor.commitment_id),
  ];

  assert.equal(plans.length, 38);
  assert.equal(hosts.length, 35);
  assert.equal(guests.length, 18);
  assert.equal(sponsors.length, 4);
  assert.equal(plans.flatMap((plan) => plan.topics).length, 0);
  assert.equal(plans.flatMap((plan) => plan.sources).length, 0);
  assert.equal(new Set(ids).size, ids.length);
  ids.forEach((id) => assert.match(id, UUID_PATTERN));

  assert.equal(
    hosts.filter((host) => host.host_person_id).length,
    26
  );
  assert.equal(
    hosts.filter((host) => host.host_person_id === null).length,
    9
  );
  assert.equal(
    hosts.filter((host) => host.assignment_status === 'confirmed').length,
    24
  );
  assert.equal(
    hosts.filter((host) => host.assignment_status === 'proposed').length,
    11
  );
  assert.equal(
    guests.filter((guest) => guest.invitation_status === 'recorded').length,
    2
  );
  assert.equal(
    guests.filter((guest) => guest.invitation_status === 'approved').length,
    12
  );
  assert.equal(
    guests.filter((guest) => guest.invitation_status === 'candidate').length,
    4
  );

  for (const plan of plans) {
    plan.hosts.forEach((host, index) => {
      assert.equal(
        host.episode_host_id,
        season11SeedUuid('host', plan.source_row, index + 1)
      );
    });
    plan.guests.forEach((guest, index) => {
      assert.equal(
        guest.guest_id,
        season11SeedUuid('guest', plan.source_row, index + 1)
      );
    });
    plan.sponsor_commitments.forEach((sponsor, index) => {
      assert.equal(
        sponsor.commitment_id,
        season11SeedUuid('sponsor', plan.source_row, index + 1)
      );
    });
  }
});

test('seed keeps January corrections and restored episode numbers', () => {
  const byRow = new Map(
    committedPayload.plans.map((plan) => [plan.source_row, plan])
  );
  assert.deepEqual(
    [16, 17, 18, 19, 20].map((row) => byRow.get(row).target_air_date),
    [
      '2027-01-05',
      '2027-01-07',
      '2027-01-14',
      '2027-01-21',
      '2027-01-28',
    ]
  );
  assert.match(byRow.get(17).working_title, /^Episode 11\.10 · /);
  assert.match(byRow.get(29).working_title, /^Episode 11\.20 · /);
});

test('seed payload is restricted to the Aurora public-planning allowlist', () => {
  assert.deepEqual(sortedKeys(committedPayload), ['plans', 'season']);
  assert.deepEqual(sortedKeys(committedPayload.season), [
    'ends_on',
    'label',
    'planning_goal',
    'season_id',
    'starts_on',
    'status',
  ]);

  for (const plan of committedPayload.plans) {
    assert.deepEqual(sortedKeys(plan), [
      'episode_plan_id',
      'episode_type',
      'guests',
      'hosts',
      'listener_takeaway',
      'premise',
      'source_row',
      'sources',
      'sponsor_commitments',
      'status',
      'target_air_date',
      'topics',
      'working_title',
    ]);
    plan.hosts.forEach((host) =>
      assert.deepEqual(sortedKeys(host), [
        'assignment_status',
        'episode_host_id',
        'host_display_name',
        'host_person_id',
        'host_role',
        'sort_order',
      ])
    );
    plan.guests.forEach((guest) => {
      assert.deepEqual(sortedKeys(guest), [
        'display_name',
        'guest_id',
        'guest_role',
        'invitation_status',
        'public_affiliation',
        'public_angle',
        'public_context',
        'public_profile_url',
        'sort_order',
      ]);
      assert.equal(guest.public_profile_url, null);
    });
    plan.sponsor_commitments.forEach((sponsor) =>
      assert.deepEqual(sortedKeys(sponsor), [
        'commitment_id',
        'commitment_kind',
        'commitment_status',
        'due_on',
        'placement',
        'public_copy_note',
        'sponsor_display_name',
      ])
    );
  }

  const serialized = JSON.stringify(committedPayload).toLowerCase();
  for (const prohibited of [
    'contact_email',
    'phone_number',
    'shipping_destination',
    'incident_details',
    'questionnaire',
    'resume_cv',
    'access_key',
    'session_token',
    'private_message',
    'object_storage',
  ]) {
    assert.doesNotMatch(serialized, new RegExp(prohibited));
  }
});

test('SQL fails closed, is retry-safe, and enforces the storage guardrail', () => {
  assert.match(seedSql, /^-- Reviewed, privacy-allowlisted Season 11 seed/);
  assert.match(seedSql, /\nBEGIN;\n/);
  assert.match(seedSql, /\nCOMMIT;\s*$/);
  assert.equal((seedSql.match(/ON CONFLICT DO NOTHING;/g) || []).length, 6);
  assert.match(seedSql, /SET LOCAL lock_timeout = '5s'/);
  assert.match(seedSql, /IN SHARE ROW EXCLUSIVE MODE/);
  assert.match(seedSql, /total_size_bytes >= 858993459/g);
  assert.match(seedSql, /Season 11 January year corrections are missing/);
  assert.match(seedSql, /Season 11 persisted counts mismatch/);
  assert.doesNotMatch(seedSql, /^\s*(?:DELETE|TRUNCATE|UPDATE)\b/im);
});
