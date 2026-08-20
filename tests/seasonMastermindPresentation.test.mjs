import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMastermindCalendarDays,
  buildMastermindMutation,
  buildMastermindSeasonMutation,
  filterMastermindPlans,
  groupMastermindBoard,
  groupMastermindResearch,
  listMastermindHostOptions,
  listMastermindProducerOptions,
  mastermindHostKey,
  normalizeSeasonMastermindData,
  summarizeMastermindPlans,
} from '../lib/seasonMastermindPresentation.mjs';
import { LOCAL_SEASON_MASTERMIND_PREVIEW } from '../lib/seasonMastermindLocalPreview.mjs';

const SEASON_ID = '11111111-1111-4111-8111-111111111111';
const PLAN_ID = '22222222-2222-4222-8222-222222222222';

function workspace() {
  return normalizeSeasonMastermindData({
    configured: true,
    canManage: true,
    directory: [{ person_id: 'host-one', name: 'Host One' }],
    seasons: [
      {
        season_id: SEASON_ID,
        label: 'Season 12',
        starts_on: '2026-09-01',
        ends_on: '2027-04-30',
      },
    ],
    plans: [
      {
        episode_plan_id: PLAN_ID,
        season_id: SEASON_ID,
        working_title: 'Wind slabs after rapid loading',
        premise: 'Explain the observations that matter after rapid loading.',
        listener_takeaway: 'Recognize when the problem changes quickly.',
        episode_type: 'regular',
        status: 'researching',
        target_air_date: '2026-10-08',
        revision: 3,
        hosts: [
          {
            host_person_id: 'host-one',
            host_display_name: 'Host One',
          },
        ],
        guests: [{ guest_id: 'guest-one', display_name: 'Guest One' }],
        topics: [{ topic_id: 'topic-wind', label: 'Wind slabs' }],
        sources: [{ source_id: 'source-one', title: 'Forecast archive' }],
      },
      {
        episode_plan_id: '33333333-3333-4333-8333-333333333333',
        season_id: SEASON_ID,
        working_title: 'An unscheduled field-note episode',
        premise: 'Turn field observations into a concise listener story.',
        episode_type: 'slabs_and_sluffs',
        status: 'ready',
        target_air_date: '',
        revision: 1,
        hosts: [],
        guests: [],
        topics: [],
        sources: [],
      },
    ],
    page: { number: 1, size: 2, total_plans: 3, has_more: true },
  });
}

test('normalizes only identified live records and round-trips calendar dates', () => {
  const live = normalizeSeasonMastermindData({
    seasons: [
      { label: 'Missing ID' },
      {
        season_id: SEASON_ID,
        label: 'Season 12',
        starts_on: '2026-02-30',
        ends_on: '2027-04-30',
      },
    ],
    plans: [
      { episode_plan_id: PLAN_ID, premise: 'Missing title' },
      {
        episode_plan_id: PLAN_ID,
        season_id: SEASON_ID,
        working_title: 'A real plan',
        premise: 'A complete editorial premise.',
        target_air_date: '2026-02-30',
      },
    ],
  });

  assert.equal(live.seasons.length, 1);
  assert.equal(live.seasons[0].starts_on, '');
  assert.equal(live.plans.length, 1);
  assert.equal(live.plans[0].target_air_date, '');
  assert.equal(live.plans[0].working_title, 'A real plan');
});

test('preserves safe workbook provenance without making it editable', () => {
  const result = normalizeSeasonMastermindData({
    plans: [
      {
        episode_plan_id: PLAN_ID,
        season_id: SEASON_ID,
        working_title: 'Imported schedule row',
        premise: 'Imported from the reviewed Season 11 schedule.',
        target_air_date: '2027-01-07',
        source_episode_number: '11.10',
        recording_note: 'Record after ISSW',
        source_status_note: 'RECORDING FINISHED',
        source_sheet: 'Schedule',
        source_row: 17,
        source_quality_flags: [
          'inferred_january_2027',
          'inferred_january_2027',
          '',
        ],
        sponsor_commitments: [
          { sponsor_display_name: 'Peak Visor', date_locked: true },
        ],
      },
    ],
  });

  assert.equal(result.plans[0].source_episode_number, '11.10');
  assert.equal(result.plans[0].source_row, 17);
  assert.deepEqual(result.plans[0].source_quality_flags, [
    'inferred_january_2027',
  ]);
  assert.equal(result.plans[0].sponsor_commitments[0].date_locked, true);
  assert.equal(
    Object.hasOwn(
      buildMastermindMutation(
        'update_plan',
        result.plans[0],
        result.plans[0]
      ).input,
      'source_episode_number'
    ),
    false
  );
});

test('summarizes complete workbook coverage without exposing private cells', () => {
  const workspace = normalizeSeasonMastermindData(
    LOCAL_SEASON_MASTERMIND_PREVIEW,
    { preview: true }
  );

  assert.deepEqual(workspace.workbook_index_summary, {
    workbook: 'The Avalanche Hour Season 11 Mastermind.xlsx',
    expected_nonempty_cells: 649,
    indexed_nonempty_cells: 649,
    sheet_count: 13,
    host_goal_count: 21,
    historical_production_lead_count: 25,
    guest_idea_count: 38,
    intake_submission_count: 12,
  });
  assert.doesNotMatch(JSON.stringify(workspace.workbook_index_summary), /@|https?:\/\//i);
});

test('normalizes the API directory array for manager host filters', () => {
  const result = workspace();

  assert.deepEqual(result.page, {
    number: 1,
    size: 2,
    total_plans: 3,
    has_more: true,
  });

  assert.deepEqual(result.directory.hosts, [
    {
      host_person_id: 'host-one',
      host_display_name: 'Host One',
      host_role: 'host',
      assignment_status: 'proposed',
    },
  ]);
  assert.deepEqual(listMastermindHostOptions(result.plans, result.directory), [
    {
      id: 'person:host-one',
      label: 'Host One',
      personId: 'host-one',
    },
  ]);
});

test('uses reviewed directory names for host assignment options', () => {
  assert.deepEqual(
    listMastermindHostOptions(
      [
        {
          hosts: [
            {
              host_person_id: 'host-one',
              host_display_name: 'Old plan snapshot',
            },
          ],
        },
      ],
      {
        hosts: [
          {
            host_person_id: 'host-one',
            host_display_name: 'Reviewed Host Name',
          },
        ],
      }
    ),
    [
      {
        id: 'person:host-one',
        label: 'Reviewed Host Name',
        personId: 'host-one',
      },
    ]
  );
});

test('normalizes only identified producers into sorted handoff options', () => {
  const result = normalizeSeasonMastermindData({
    directory: {
      producers: [
        { person_id: 'producer-two', name: 'Zoe Producer' },
        { person_id: 'producer-one', name: 'Alex Producer' },
        { person_id: '', name: 'Missing profile' },
        { person_id: 'missing-name', name: '' },
      ],
    },
  });

  assert.deepEqual(listMastermindProducerOptions(result.directory), [
    { id: 'producer-one', label: 'Alex Producer' },
    { id: 'producer-two', label: 'Zoe Producer' },
  ]);
});

test('filters the shared plan graph without changing source rows', () => {
  const result = workspace();
  const source = structuredClone(result.plans);
  const hostKey = mastermindHostKey(result.plans[0].hosts[0]);

  assert.deepEqual(
    filterMastermindPlans(result.plans, {
      seasonId: SEASON_ID,
      hostKey,
      status: 'researching',
      episodeType: 'regular',
      targetDate: '2026-10-08',
      query: 'forecast archive',
    }).map((plan) => plan.episode_plan_id),
    [PLAN_ID]
  );
  assert.deepEqual(result.plans, source);
});

test('builds board, calendar, summary, and research-gap views', () => {
  const { plans } = workspace();
  const board = groupMastermindBoard(plans);
  const calendar = buildMastermindCalendarDays('2026-10-01', plans);
  const research = groupMastermindResearch(plans, 'sources');
  const summary = summarizeMastermindPlans(plans);

  assert.equal(board.find((column) => column.id === 'researching').plans.length, 1);
  assert.equal(calendar.length, 42);
  assert.equal(
    calendar.find((day) => day.key === '2026-10-08').plans[0]
      .episode_plan_id,
    PLAN_ID
  );
  assert.equal(research.at(-1).id, 'needs-sources');
  assert.equal(summary.ready, 1);
  assert.equal(summary.gaps, 1);
});

test('emits the exact action-input mutation contract and preserves relationships', () => {
  const { plans } = workspace();
  const plan = plans[0];
  const draft = {
    ...plan,
    working_title: 'Updated wind slab plan',
  };

  assert.deepEqual(buildMastermindSeasonMutation({
    label: 'Season 12',
    starts_on: '2026-09-01',
    ends_on: '2027-04-30',
    planning_goal: 'Build one shared season.',
  }), {
    action: 'create_season',
    input: {
      label: 'Season 12',
      starts_on: '2026-09-01',
      ends_on: '2027-04-30',
      planning_goal: 'Build one shared season.',
    },
  });

  assert.deepEqual(
    buildMastermindSeasonMutation(
      {
        label: 'Season 12 revised',
        starts_on: '2026-09-01',
        ends_on: '2027-05-01',
        planning_goal: 'Keep one corrected season.',
      },
      { season_id: SEASON_ID, revision: 4 }
    ),
    {
      action: 'update_season',
      input: {
        label: 'Season 12 revised',
        starts_on: '2026-09-01',
        ends_on: '2027-05-01',
        planning_goal: 'Keep one corrected season.',
        season_id: SEASON_ID,
        revision: 4,
      },
    }
  );

  const mutation = buildMastermindMutation('update_plan', draft, plan);
  assert.equal(mutation.action, 'update_plan');
  assert.equal(mutation.input.episode_plan_id, PLAN_ID);
  assert.equal(mutation.input.revision, 3);
  assert.deepEqual(mutation.input.host_person_ids, ['host-one']);
  assert.equal('plan' in mutation, false);
  assert.equal('expected_revision' in mutation, false);
});
