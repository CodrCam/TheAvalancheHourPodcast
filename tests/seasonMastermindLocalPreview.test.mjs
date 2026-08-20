import test from 'node:test';
import assert from 'node:assert/strict';
import { CURRENT_SEASON } from '../lib/currentSeason.mjs';
import { LOCAL_SEASON_MASTERMIND_PREVIEW } from '../lib/seasonMastermindLocalPreview.mjs';
import {
  buildMastermindCalendarDays,
  groupMastermindBoard,
  normalizeSeasonMastermindData,
} from '../lib/seasonMastermindPresentation.mjs';

test('loads every privacy-safe Season 11 Schedule row into the local Mastermind', () => {
  const sourcePlans = LOCAL_SEASON_MASTERMIND_PREVIEW.plans;
  const workspace = normalizeSeasonMastermindData(
    LOCAL_SEASON_MASTERMIND_PREVIEW,
    { preview: true }
  );

  assert.equal(sourcePlans.length, 38);
  assert.equal(workspace.plans.length, 38);
  assert.equal(
    workspace.plans.filter((plan) => plan.episode_type === 'regular').length,
    29
  );
  assert.equal(
    workspace.plans.filter(
      (plan) => plan.episode_type === 'slabs_and_sluffs'
    ).length,
    9
  );
  assert.equal(new Set(workspace.plans.map((plan) => plan.episode_plan_id)).size, 38);
  assert.equal(
    workspace.plans.every(
      (plan) =>
        plan.target_air_date >= CURRENT_SEASON.starts_on &&
        plan.target_air_date <= CURRENT_SEASON.ends_on
    ),
    true
  );

  const boardTotal = groupMastermindBoard(workspace.plans).reduce(
    (total, column) => total + column.plans.length,
    0
  );
  assert.equal(boardTotal, 38);
  assert.equal(
    workspace.plans.filter((plan) => plan.status === 'researching').length,
    37
  );
  assert.equal(
    workspace.plans.every((plan) => plan.linked_episode_id === ''),
    true
  );

  const months = [
    '2026-10-01',
    '2026-11-01',
    '2026-12-01',
    '2027-01-01',
    '2027-02-01',
    '2027-03-01',
    '2027-04-01',
    '2027-05-01',
  ];
  const calendarTotal = months.reduce(
    (total, month) =>
      total +
      buildMastermindCalendarDays(month, workspace.plans)
        .filter((day) => day.inMonth)
        .reduce((monthTotal, day) => monthTotal + day.plans.length, 0),
    0
  );
  assert.equal(calendarTotal, 38);
});

test('records the explicit spreadsheet corrections and schedule commitments', () => {
  const plans = LOCAL_SEASON_MASTERMIND_PREVIEW.plans;
  const januaryCorrections = plans.filter((plan) =>
    plan.source_quality_flags.includes(
      'air_date_year_corrected_from_2026_to_2027'
    )
  );

  assert.equal(januaryCorrections.length, 5);
  assert.deepEqual(
    januaryCorrections.map((plan) => plan.target_air_date),
    [
      '2027-01-05',
      '2027-01-07',
      '2027-01-14',
      '2027-01-21',
      '2027-01-28',
    ]
  );
  assert.equal(
    plans.some((plan) => plan.source_episode_number === '11.10'),
    true
  );
  assert.equal(
    plans.some((plan) => plan.source_episode_number === '11.20'),
    true
  );
  assert.equal(
    plans.flatMap((plan) => plan.sponsor_commitments).length,
    4
  );
  assert.equal(
    plans
      .flatMap((plan) => plan.sponsor_commitments)
      .filter((commitment) => commitment.date_locked).length,
    1
  );
  assert.equal(
    plans.filter((plan) => plan.source_status_note === 'RECORDING FINISHED')
      .length,
    1
  );
  assert.equal(
    plans
      .flatMap((plan) => plan.hosts)
      .find((host) => host.host_display_name === 'Brooke Edwards')
      ?.host_person_id,
    'brooke-edwards'
  );
  assert.equal(
    plans
      .flatMap((plan) => plan.hosts)
      .find((host) => host.host_display_name === 'Pascal Haegli')
      ?.host_person_id,
    ''
  );
  assert.equal(
    plans.some((plan) =>
      plan.source_quality_flags.includes('host_not_mapped_to_current_roster')
    ),
    true
  );
});
