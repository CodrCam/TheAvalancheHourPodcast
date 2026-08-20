import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MastermindInputError,
  normalizeMastermindListInput,
  normalizeMastermindMutation,
} from '../lib/seasonMastermindRequest.mjs';
import { buildMastermindMutation } from '../lib/seasonMastermindPresentation.mjs';

const SEASON_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_ID = '22222222-2222-4222-8222-222222222222';
const DIRECTORY = [
  { person_id: 'host-one', name: 'Host One' },
  { person_id: 'host-two', name: 'Host Two' },
];

test('does not forward a client-selected host scope', () => {
  const result = normalizeMastermindListInput(
    { host_person_id: 'someone-else', include_archived: 'true' },
    { person_id: 'host-one', can_manage: false }
  );

  assert.equal('host_person_id' in result, false);
  assert.equal(result.include_archived, false);
  assert.equal(result.page_size, 50);
});

test('allows managers to use bounded planning filters', () => {
  const result = normalizeMastermindListInput(
    {
      season_id: SEASON_ID,
      status: 'ready',
      episode_type: 'slabs_and_sluffs',
      query: 'persistent slab',
      include_archived: 'true',
      page: '2',
      page_size: '25',
    },
    { can_manage: true }
  );

  assert.equal(result.season_id, SEASON_ID);
  assert.equal(result.status, 'ready');
  assert.equal(result.include_archived, true);
  assert.equal(result.page, 2);
  assert.equal(result.page_size, 25);
  assert.throws(
    () =>
      normalizeMastermindListInput(
        { page_size: '51' },
        { person_id: 'manager-one', can_manage: true }
      ),
    /Page size/
  );
});

test('forwards only bounded manager relationship and date filters', () => {
  assert.deepEqual(
    normalizeMastermindListInput(
      {
        host_person_id: 'host-one',
        from_date: '2026-10-08',
        to_date: '2026-10-08',
      },
      { person_id: 'manager-one', can_manage: true }
    ),
    {
      include_archived: false,
      page: 1,
      page_size: 50,
      host_person_id: 'host-one',
      from_date: '2026-10-08',
      to_date: '2026-10-08',
    }
  );
  const hostScoped = normalizeMastermindListInput(
    { host_person_id: 'someone-else' },
    { person_id: 'host-one', can_manage: false }
  );
  assert.equal('host_person_id' in hostScoped, false);
});

test('normalizes a safe first season without accepting an invalid range', () => {
  assert.deepEqual(
    normalizeMastermindMutation({
      action: 'create_season',
      input: {
        label: 'Season 11',
        starts_on: '2026-10-01',
        ends_on: '2027-05-01',
        planning_goal: 'Build a coherent season.',
        unexpected_private_field: 'not forwarded',
      },
    }),
    {
      operation: 'create_season',
      input: {
        label: 'Season 11',
        starts_on: '2026-10-01',
        ends_on: '2027-05-01',
        planning_goal: 'Build a coherent season.',
      },
    }
  );

  assert.throws(
    () =>
      normalizeMastermindMutation({
        action: 'create_season',
        input: {
          label: 'Season 11',
          starts_on: '2027-05-01',
          ends_on: '2026-10-01',
        },
      }),
    /on or after/
  );
});

test('normalizes an optimistic season correction', () => {
  assert.deepEqual(
    normalizeMastermindMutation({
      action: 'update_season',
      input: {
        season_id: SEASON_ID,
        revision: 3,
        label: 'Season 12 corrected',
        starts_on: '2026-09-01',
        ends_on: '2027-05-01',
        planning_goal: 'One shared plan.',
      },
    }),
    {
      operation: 'update_season',
      input: {
        season_id: SEASON_ID,
        revision: 3,
        label: 'Season 12 corrected',
        starts_on: '2026-09-01',
        ends_on: '2027-05-01',
        planning_goal: 'One shared plan.',
      },
    }
  );
});

test('maps host IDs to reviewed directory names and drops unknown fields', () => {
  const result = normalizeMastermindMutation(
    {
      action: 'create_plan',
      input: {
        season_id: SEASON_ID,
        working_title: 'Wind slabs after a rapid loading event',
        premise: 'Explain the decisions that matter after rapid loading.',
        listener_takeaway: 'Recognize when the problem changes quickly.',
        episode_type: 'regular',
        status: 'researching',
        owner_person_id: 'host-one',
        host_person_ids: ['host-two', 'host-two'],
        guest_email: 'must-not-leave-the-server@example.test',
      },
    },
    { directory: DIRECTORY }
  );

  assert.deepEqual(result.input.hosts, [
    { person_id: 'host-two', display_name: 'Host Two' },
  ]);
  assert.equal('guest_email' in result.input, false);
});

test('requires optimistic revisions and valid UUIDs for updates', () => {
  assert.throws(
    () =>
      normalizeMastermindMutation(
        {
          action: 'update_plan',
          input: {
            episode_plan_id: PLAN_ID,
            revision: 0,
            season_id: SEASON_ID,
            working_title: 'A valid title',
            premise: 'A valid premise for the episode plan.',
          },
        },
        { directory: DIRECTORY }
      ),
    (error) =>
      error instanceof MastermindInputError &&
      /revision/.test(error.message)
  );

  assert.throws(
    () =>
      normalizeMastermindMutation(
        {
          action: 'create_plan',
          input: {
            season_id: 'not-a-uuid',
            working_title: 'A valid title',
            premise: 'A valid premise for the episode plan.',
          },
        },
        { directory: DIRECTORY }
      ),
    /invalid format/
  );
});

test('does not erase host relationships when an update form omits host editing', () => {
  const result = normalizeMastermindMutation(
    {
      action: 'update_plan',
      input: {
        episode_plan_id: PLAN_ID,
        revision: 2,
        season_id: SEASON_ID,
        working_title: 'A valid title',
        premise: 'A valid premise for the episode plan.',
      },
    },
    { directory: DIRECTORY }
  );

  assert.equal('hosts' in result.input, false);
});

test('keeps Episode Studio linking out of the generic browser proxy', () => {
  assert.throws(
    () =>
      normalizeMastermindMutation({
        action: 'link_episode',
        input: {
          episode_plan_id: PLAN_ID,
          linked_episode_id: 'episode-2026-wind-slabs',
          revision: 3,
        },
      }),
    /valid Season Mastermind action/
  );
  assert.throws(
    () =>
      normalizeMastermindMutation({ action: 'delete_everything' }),
    /valid Season Mastermind action/
  );
});

test('keeps the browser, proxy, and Lambda update contract aligned', async () => {
  const browserMutation = buildMastermindMutation(
    'update_plan',
    {
      season_id: SEASON_ID,
      working_title: 'A reviewed title',
      premise: 'A sufficiently complete editorial premise.',
      listener_takeaway: 'A useful listener takeaway.',
      episode_type: 'regular',
      status: 'researching',
      target_air_date: '2026-10-08',
      host_person_ids: ['host-one'],
    },
    { episode_plan_id: PLAN_ID, revision: 7 }
  );
  const proxyMutation = normalizeMastermindMutation(browserMutation, {
    directory: DIRECTORY,
  });

  assert.equal(proxyMutation.operation, 'update_plan');
  const fixture = JSON.parse(
    await readFile(
      new URL('./fixtures/season-mastermind-update-contract.json', import.meta.url),
      'utf8'
    )
  );
  assert.deepEqual(proxyMutation.input, fixture);
  assert.equal('plan_id' in proxyMutation.input, false);
  assert.equal('owner_person_id' in proxyMutation.input, false);
  assert.equal('source_intake_item_id' in proxyMutation.input, false);
});

test('requires a target date once an episode enters the scheduled workflow', () => {
  assert.throws(
    () =>
      normalizeMastermindMutation(
        {
          action: 'create_plan',
          input: {
            season_id: SEASON_ID,
            working_title: 'A reviewed title',
            premise: 'A sufficiently complete editorial premise.',
            status: 'scheduled',
            target_air_date: '',
          },
        },
        { directory: DIRECTORY }
      ),
    /target air date is required/i
  );
});
