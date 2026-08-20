import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  episodeStudioIdForMastermindPlan,
  findManagerMastermindPlan,
  handoffReadyPlanToEpisodeStudio,
  handoffStudioIntakeToMastermind,
  mastermindPlanIdForIntake,
  normalizeIntakeMastermindHandoff,
  SeasonMastermindHandoffError,
} from '../lib/seasonMastermindHandoffs.mjs';
import {
  ensureEpisodeStudioFromMastermindPlan,
  EpisodeStudioCreationError,
} from '../lib/episodeStudioCreation.js';
import { normalizeEpisodeStudio } from '../lib/episodeStudioPresentation.mjs';

const SEASON_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_ID = '22222222-2222-4222-8222-222222222222';
const ACTOR = { person_id: 'manager-one', can_manage: true };
const HOST = {
  person_id: 'host-one',
  name: 'Host One',
  active: true,
  capabilities: { host: true, producer: false },
};

function readyPlan(overrides = {}) {
  return {
    episode_plan_id: PLAN_ID,
    season_id: SEASON_ID,
    working_title: 'Wind slabs after rapid loading',
    premise: 'Explain the decisions that matter after rapid loading.',
    listener_takeaway: 'Recognize when the avalanche problem changes.',
    episode_type: 'regular',
    status: 'ready',
    target_air_date: '2026-12-10',
    linked_episode_id: null,
    revision: 4,
    hosts: [
      {
        person_id: HOST.person_id,
        display_name: HOST.name,
        assignment_status: 'confirmed',
      },
    ],
    ...overrides,
  };
}

test('derives stable non-colliding handoff identifiers', () => {
  const first = mastermindPlanIdForIntake('wind-slabs-12345678');
  const repeated = mastermindPlanIdForIntake('wind-slabs-12345678');
  const second = mastermindPlanIdForIntake('wind-slabs-87654321');

  assert.equal(first, repeated);
  assert.notEqual(first, second);
  assert.match(
    first,
    /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
  );
  assert.equal(
    episodeStudioIdForMastermindPlan(PLAN_ID),
    `mastermind-${PLAN_ID}`
  );
});

test('intake handoff forwards only manager-reviewed planning fields', async () => {
  const source = {
    item_id: 'wind-slabs-12345678',
    status: 'reviewing',
    title: 'Private source title must not be copied automatically',
    details: 'Private planning discussion',
    comments: [{ body: 'Private comment' }],
  };
  const approved = {
    season_id: SEASON_ID,
    working_title: 'Reviewed public working title',
    premise: 'A reviewed editorial premise for the shared planning graph.',
    listener_takeaway: 'A reviewed takeaway.',
    episode_type: 'special',
    target_air_date: '2026-12-10',
    owner_person_id: HOST.person_id,
    host_person_ids: [HOST.person_id, HOST.person_id],
    details: 'attempted private copy',
    comments: ['attempted private copy'],
    status: 'published',
  };
  let payload;
  const result = await handoffStudioIntakeToMastermind(
    {
      sourceItem: source,
      approved,
      actor: ACTOR,
      directory: [HOST],
    },
    {
      invokeMastermind: async (value) => {
        payload = value;
        return {
          ok: true,
          created: true,
          plan: { episode_plan_id: value.input.episode_plan_id },
        };
      },
    }
  );

  assert.equal(payload.operation, 'create_plan');
  assert.equal(payload.input.working_title, approved.working_title);
  assert.equal(payload.input.source_intake_item_id, source.item_id);
  assert.equal(payload.input.status, 'researching');
  assert.deepEqual(payload.input.hosts, [
    { person_id: HOST.person_id, display_name: HOST.name },
  ]);
  assert.equal('details' in payload.input, false);
  assert.equal('comments' in payload.input, false);
  assert.equal('title' in payload.input, false);
  assert.equal(source.status, 'reviewing');
  assert.equal(result.created, true);
  assert.equal(result.requested_plan_id, payload.input.episode_plan_id);
});

test('intake normalization requires reviewed fields and a current owner', () => {
  assert.throws(
    () =>
      normalizeIntakeMastermindHandoff(
        { item_id: 'source-one' },
        {
          season_id: SEASON_ID,
          working_title: 'Reviewed title',
          premise: 'A sufficiently detailed reviewed premise.',
          owner_person_id: 'former-host',
        },
        { directory: [HOST] }
      ),
    (error) =>
      error instanceof SeasonMastermindHandoffError &&
      error.code === 'MASTERMIND_HANDOFF_INPUT_INVALID'
  );
});

test('manager plan lookup is bounded and uses authoritative season pages', async () => {
  const calls = [];
  const found = await findManagerMastermindPlan(
    { episodePlanId: PLAN_ID, seasonId: SEASON_ID, actor: ACTOR },
    {
      invokeMastermind: async (payload) => {
        calls.push(payload);
        return payload.input.page === 1
          ? { plans: [], seasons: [], page: { has_more: true } }
          : {
              plans: [readyPlan()],
              seasons: [{ season_id: SEASON_ID, label: 'Season 11' }],
              page: { has_more: false },
            };
      },
    }
  );

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].input, {
    season_id: SEASON_ID,
    include_archived: true,
    page: 1,
    page_size: 50,
  });
  assert.equal(found.plan.episode_plan_id, PLAN_ID);
  assert.equal(found.season.label, 'Season 11');
});

test('Episode Studio ensure is idempotent for the persisted source marker', async () => {
  const existing = normalizeEpisodeStudio({
    episode_id: episodeStudioIdForMastermindPlan(PLAN_ID),
    source_mastermind_plan_id: PLAN_ID,
    source_mastermind_plan_revision: 4,
    title: readyPlan().working_title,
    season: 'Season 11',
    target_release_date: '2026-12-10',
    due_date: '2026-11-30',
    host_person_ids: [HOST.person_id],
  });
  let saveCalls = 0;
  const result = await ensureEpisodeStudioFromMastermindPlan(
    {
      plan: readyPlan(),
      seasonLabel: 'Season 11',
      principal: { username: 'manager@example.test' },
      creatorBinding: { person_id: 'manager-one' },
      directory: {
        peopleById: new Map([[HOST.person_id, HOST]]),
      },
      expectedEpisodeId: existing.episode_id,
    },
    {
      getEpisodeStudioImpl: async () => ({
        configured: true,
        episode: existing,
      }),
      saveEpisodeStudioImpl: async () => {
        saveCalls += 1;
      },
    }
  );

  assert.equal(result.created, false);
  assert.equal(result.idempotent, true);
  assert.equal(saveCalls, 0);
  assert.equal(result.episode.source_mastermind_plan_id, PLAN_ID);
  assert.equal(result.episode.source_mastermind_plan_revision, 4);
});

test('Episode Studio ensure writes the deterministic source marker before linking', async () => {
  let savedValue;
  const result = await ensureEpisodeStudioFromMastermindPlan(
    {
      plan: readyPlan(),
      seasonLabel: 'Season 11',
      principal: {
        username: 'manager@example.test',
        displayName: 'Manager One',
      },
      creatorBinding: { person_id: 'manager-one' },
      directory: {
        peopleById: new Map([
          [HOST.person_id, HOST],
          [
            'manager-one',
            {
              person_id: 'manager-one',
              name: 'Manager One',
              active: true,
              capabilities: {},
            },
          ],
        ]),
      },
      expectedEpisodeId: episodeStudioIdForMastermindPlan(PLAN_ID),
      now: new Date('2026-08-19T12:00:00.000Z'),
    },
    {
      getEpisodeStudioImpl: async () => ({
        configured: true,
        episode: null,
      }),
      saveEpisodeStudioImpl: async (value, options) => {
        savedValue = { value, options };
        return { episode: normalizeEpisodeStudio(value) };
      },
      isEpisodeAssetStorageConfiguredImpl: () => true,
      getDefaultStudioProducerEmailImpl: () => 'producer@example.test',
    }
  );

  assert.equal(result.created, true);
  assert.equal(savedValue.options.create, true);
  assert.equal(savedValue.value.source_mastermind_plan_id, PLAN_ID);
  assert.equal(savedValue.value.source_mastermind_plan_revision, 4);
  assert.equal(
    savedValue.value.episode_id,
    episodeStudioIdForMastermindPlan(PLAN_ID)
  );
  assert.deepEqual(savedValue.value.host_person_ids, [HOST.person_id]);
  assert.equal(savedValue.value.target_release_date, '2026-12-10');
  assert.equal(savedValue.value.producer_email, 'manager@example.test');
});

test('an unlinked Studio cannot attach to a subsequently edited plan', async () => {
  const existing = normalizeEpisodeStudio({
    episode_id: episodeStudioIdForMastermindPlan(PLAN_ID),
    source_mastermind_plan_id: PLAN_ID,
    source_mastermind_plan_revision: 4,
    title: 'Original reviewed title',
    season: 'Season 11',
    target_release_date: '2026-12-10',
    due_date: '2026-11-30',
    host_person_ids: [HOST.person_id],
  });

  await assert.rejects(
    () =>
      ensureEpisodeStudioFromMastermindPlan(
        {
          plan: readyPlan({ revision: 5, working_title: 'Changed title' }),
          seasonLabel: 'Season 11',
          principal: { username: 'manager@example.test' },
          creatorBinding: { person_id: 'manager-one' },
          directory: {
            peopleById: new Map([[HOST.person_id, HOST]]),
          },
          expectedEpisodeId: existing.episode_id,
        },
        {
          getEpisodeStudioImpl: async () => ({
            configured: true,
            episode: existing,
          }),
          saveEpisodeStudioImpl: async () => {
            throw new Error('must not save');
          },
        }
      ),
    (error) =>
      error instanceof EpisodeStudioCreationError &&
      error.code === 'EPISODE_HANDOFF_SOURCE_CHANGED' &&
      error.status === 409
  );
});

test('an unlinked Studio cannot silently switch producers on retry', async () => {
  const producerA = {
    person_id: 'producer-a',
    name: 'Producer A',
    active: true,
    capabilities: { producer: true },
  };
  const producerB = {
    person_id: 'producer-b',
    name: 'Producer B',
    active: true,
    capabilities: { producer: true },
  };
  const existing = normalizeEpisodeStudio({
    episode_id: episodeStudioIdForMastermindPlan(PLAN_ID),
    source_mastermind_plan_id: PLAN_ID,
    source_mastermind_plan_revision: 4,
    title: readyPlan().working_title,
    season: 'Season 11',
    target_release_date: '2026-12-10',
    due_date: '2026-11-30',
    host_person_ids: [HOST.person_id],
    producer_person_id: producerA.person_id,
  });

  await assert.rejects(
    () =>
      ensureEpisodeStudioFromMastermindPlan(
        {
          plan: readyPlan(),
          seasonLabel: 'Season 11',
          producerPersonId: producerB.person_id,
          principal: { username: 'manager@example.test' },
          creatorBinding: { person_id: 'manager-one' },
          directory: {
            peopleById: new Map([
              [HOST.person_id, HOST],
              [producerA.person_id, producerA],
              [producerB.person_id, producerB],
            ]),
          },
          expectedEpisodeId: existing.episode_id,
        },
        {
          getEpisodeStudioImpl: async () => ({ configured: true, episode: existing }),
          saveEpisodeStudioImpl: async () => {
            throw new Error('must not save');
          },
        }
      ),
    (error) =>
      error instanceof EpisodeStudioCreationError &&
      error.code === 'EPISODE_HANDOFF_SNAPSHOT_CHANGED'
  );
});

test('a confirmed existing link tolerates the revision consumed by linking', async () => {
  const existing = normalizeEpisodeStudio({
    episode_id: episodeStudioIdForMastermindPlan(PLAN_ID),
    source_mastermind_plan_id: PLAN_ID,
    source_mastermind_plan_revision: 4,
    title: 'Original reviewed title',
    season: 'Season 11',
    target_release_date: '2026-12-10',
    due_date: '2026-11-30',
    host_person_ids: [HOST.person_id],
  });
  const result = await ensureEpisodeStudioFromMastermindPlan(
    {
      plan: readyPlan({
        status: 'scheduled',
        revision: 5,
        linked_episode_id: existing.episode_id,
      }),
      seasonLabel: 'Season 11',
      principal: { username: 'manager@example.test' },
      creatorBinding: { person_id: 'manager-one' },
      directory: { peopleById: new Map([[HOST.person_id, HOST]]) },
      expectedEpisodeId: existing.episode_id,
      sourceAlreadyLinked: true,
    },
    {
      getEpisodeStudioImpl: async () => ({ configured: true, episode: existing }),
      saveEpisodeStudioImpl: async () => {
        throw new Error('must not save');
      },
    }
  );

  assert.equal(result.idempotent, true);
});

test('a confirmed link never recreates a missing Episode Studio', async () => {
  const expectedEpisodeId = episodeStudioIdForMastermindPlan(PLAN_ID);
  let saveCalls = 0;

  await assert.rejects(
    () =>
      ensureEpisodeStudioFromMastermindPlan(
        {
          plan: readyPlan({
            status: 'scheduled',
            revision: 5,
            linked_episode_id: expectedEpisodeId,
          }),
          seasonLabel: 'Season 11',
          principal: { username: 'manager@example.test' },
          creatorBinding: { person_id: 'manager-one' },
          directory: { peopleById: new Map([[HOST.person_id, HOST]]) },
          expectedEpisodeId,
          sourceAlreadyLinked: true,
        },
        {
          getEpisodeStudioImpl: async () => ({
            configured: true,
            episode: null,
          }),
          saveEpisodeStudioImpl: async () => {
            saveCalls += 1;
          },
        }
      ),
    (error) =>
      error instanceof EpisodeStudioCreationError &&
      error.code === 'EPISODE_HANDOFF_LINK_TARGET_MISSING' &&
      error.status === 409
  );
  assert.equal(saveCalls, 0);
});

test('Episode Studio ensure rejects missing dates and unmapped hosts', async () => {
  const base = {
    seasonLabel: 'Season 11',
    principal: { username: 'manager@example.test' },
    creatorBinding: { person_id: 'manager-one' },
    directory: { peopleById: new Map([[HOST.person_id, HOST]]) },
    expectedEpisodeId: episodeStudioIdForMastermindPlan(PLAN_ID),
  };
  await assert.rejects(
    () =>
      ensureEpisodeStudioFromMastermindPlan(
        { ...base, plan: readyPlan({ target_air_date: '' }) },
        { getEpisodeStudioImpl: async () => ({ configured: true }) }
      ),
    (error) =>
      error instanceof EpisodeStudioCreationError &&
      error.code === 'MASTERMIND_PLAN_DATE_REQUIRED'
  );
  await assert.rejects(
    () =>
      ensureEpisodeStudioFromMastermindPlan(
        {
          ...base,
          plan: readyPlan({
            hosts: [{ display_name: 'Unmapped Host', person_id: '' }],
          }),
        },
        { getEpisodeStudioImpl: async () => ({ configured: true }) }
      ),
    (error) =>
      error instanceof EpisodeStudioCreationError &&
      error.code === 'MASTERMIND_HOSTS_NOT_MAPPED'
  );
});

test('ready plan handoff creates Dynamo first and returns partial success when linking fails', async () => {
  const calls = [];
  const episode = {
    episode_id: episodeStudioIdForMastermindPlan(PLAN_ID),
    source_mastermind_plan_id: PLAN_ID,
  };
  const result = await handoffReadyPlanToEpisodeStudio(
    {
      episodePlanId: PLAN_ID,
      seasonId: SEASON_ID,
      actor: ACTOR,
      principal: { username: 'manager@example.test' },
      creatorBinding: { person_id: ACTOR.person_id },
      directory: {},
    },
    {
      invokeMastermind: async (payload) => {
        calls.push(payload.operation);
        if (payload.operation === 'list_mastermind') {
          return {
            data: {
              plans: [readyPlan()],
              seasons: [{ season_id: SEASON_ID, label: 'Season 11' }],
              page: { has_more: false },
            },
          };
        }
        const error = new Error('Aurora is waking');
        error.code = 'MASTERMIND_WAKING';
        throw error;
      },
      ensureEpisodeStudio: async () => {
        calls.push('ensure_episode');
        return { episode, created: true, idempotent: false };
      },
    }
  );

  assert.deepEqual(calls, [
    'list_mastermind',
    'ensure_episode',
    'link_episode',
  ]);
  assert.equal(result.outcome, 'link_pending');
  assert.equal(result.episode_created, true);
  assert.equal(result.link_error_code, 'MASTERMIND_WAKING');
  assert.equal(result.link_retryable, true);
});

test('ready plan handoff does not invite an unsafe retry after a soft-link conflict', async () => {
  const episode = {
    episode_id: episodeStudioIdForMastermindPlan(PLAN_ID),
    source_mastermind_plan_id: PLAN_ID,
  };
  const result = await handoffReadyPlanToEpisodeStudio(
    {
      episodePlanId: PLAN_ID,
      seasonId: SEASON_ID,
      actor: ACTOR,
      principal: { username: 'manager@example.test' },
      creatorBinding: { person_id: ACTOR.person_id },
      directory: {},
    },
    {
      invokeMastermind: async (payload) => {
        if (payload.operation === 'list_mastermind') {
          return {
            plans: [readyPlan()],
            seasons: [{ season_id: SEASON_ID, label: 'Season 11' }],
            page: { has_more: false },
          };
        }
        const error = new Error('Plan is linked elsewhere');
        error.code = 'soft_link_conflict';
        error.status = 409;
        throw error;
      },
      ensureEpisodeStudio: async () => ({
        episode,
        created: false,
        idempotent: true,
      }),
    }
  );

  assert.equal(result.outcome, 'link_pending');
  assert.equal(result.link_error_code, 'soft_link_conflict');
  assert.equal(result.link_retryable, false);
});

test('ready plan handoff links with the authoritative revision', async () => {
  const payloads = [];
  const episode = {
    episode_id: episodeStudioIdForMastermindPlan(PLAN_ID),
    source_mastermind_plan_id: PLAN_ID,
  };
  const result = await handoffReadyPlanToEpisodeStudio(
    {
      episodePlanId: PLAN_ID,
      seasonId: SEASON_ID,
      actor: ACTOR,
      principal: { username: 'manager@example.test' },
      creatorBinding: { person_id: ACTOR.person_id },
      directory: {},
    },
    {
      invokeMastermind: async (payload) => {
        payloads.push(payload);
        return payload.operation === 'list_mastermind'
          ? {
              plans: [readyPlan({ revision: 9 })],
              seasons: [{ season_id: SEASON_ID, label: 'Season 11' }],
              page: { has_more: false },
            }
          : { plan: { ...readyPlan(), linked_episode_id: episode.episode_id } };
      },
      ensureEpisodeStudio: async () => ({
        episode,
        created: false,
        idempotent: true,
      }),
    }
  );

  const link = payloads.find((payload) => payload.operation === 'link_episode');
  assert.deepEqual(link.input, {
    episode_plan_id: PLAN_ID,
    linked_episode_id: episode.episode_id,
    revision: 9,
  });
  assert.equal(result.outcome, 'linked');
});

test('a completed scheduled handoff can be retried idempotently', async () => {
  const episodeId = episodeStudioIdForMastermindPlan(PLAN_ID);
  const episode = {
    episode_id: episodeId,
    source_mastermind_plan_id: PLAN_ID,
  };
  const payloads = [];
  const result = await handoffReadyPlanToEpisodeStudio(
    {
      episodePlanId: PLAN_ID,
      seasonId: SEASON_ID,
      actor: ACTOR,
      principal: { username: 'manager@example.test' },
      creatorBinding: { person_id: ACTOR.person_id },
      directory: {},
    },
    {
      invokeMastermind: async (payload) => {
        payloads.push(payload);
        return payload.operation === 'list_mastermind'
          ? {
              plans: [
                readyPlan({
                  status: 'scheduled',
                  linked_episode_id: episodeId,
                  revision: 5,
                }),
              ],
              seasons: [{ season_id: SEASON_ID, label: 'Season 11' }],
              page: { has_more: false },
            }
          : {
              plan: readyPlan({
                status: 'scheduled',
                linked_episode_id: episodeId,
                revision: 5,
              }),
              idempotent: true,
            };
      },
      ensureEpisodeStudio: async ({ sourceAlreadyLinked }) => {
        assert.equal(sourceAlreadyLinked, true);
        return { episode, created: false, idempotent: true };
      },
    }
  );

  assert.deepEqual(
    payloads.map((payload) => payload.operation),
    ['list_mastermind', 'link_episode']
  );
  assert.equal(result.outcome, 'linked');
  assert.equal(result.episode_created, false);
  assert.equal(result.link_idempotent, true);
});

test('dedicated routes enforce both sides of each manager handoff', async () => {
  const [intakeRoute, episodeRoute] = await Promise.all([
    readFile(
      new URL(
        '../pages/api/studio/mastermind/handoffs/intake.js',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL(
        '../pages/api/studio/mastermind/handoffs/episode.js',
        import.meta.url
      ),
      'utf8'
    ),
  ]);

  assert.match(intakeRoute, /MASTERMIND_MANAGE/);
  assert.match(intakeRoute, /INTAKE_MANAGE/);
  assert.match(intakeRoute, /getStudioIntakeItem/);
  assert.match(intakeRoute, /isEpisodeRequestItem\(source\.item\)/);
  assert.match(intakeRoute, /EPISODE_REQUEST_REQUIRED/);
  assert.doesNotMatch(intakeRoute, /saveStudioIntakeItem/);
  assert.match(intakeRoute, /private, no-store/);
  assert.match(episodeRoute, /MASTERMIND_MANAGE/);
  assert.match(episodeRoute, /EPISODES_MANAGE/);
  assert.match(episodeRoute, /EPISODE_CREATED_LINK_PENDING/);
  assert.match(episodeRoute, /EPISODE_PRODUCER_REQUIRED/);
  assert.match(episodeRoute, /producerPersonId/);
  assert.match(episodeRoute, /result\.link_retryable !== false/);
  assert.doesNotMatch(episodeRoute, /deleteEpisodeStudio/);
});
