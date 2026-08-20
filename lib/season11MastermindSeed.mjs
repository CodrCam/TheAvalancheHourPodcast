import { CURRENT_SEASON } from './currentSeason.mjs';
import {
  SEASON_11_MASTERMIND_SEASON_ID,
  SEASON_11_SCHEDULE_PLANS,
} from './season11MastermindSchedule.mjs';

const UUID_PREFIX_BY_KIND = Object.freeze({
  guest: '31100000',
  host: '41100000',
  sponsor: '51100000',
});

export function season11SeedUuid(kind, sourceRow, ordinal) {
  const prefix = UUID_PREFIX_BY_KIND[kind];
  if (!prefix) throw new Error(`Unknown Season 11 seed UUID kind: ${kind}`);
  if (!Number.isInteger(sourceRow) || sourceRow < 1 || sourceRow > 999_999_999) {
    throw new Error(`Invalid Season 11 seed source row: ${sourceRow}`);
  }
  if (!Number.isInteger(ordinal) || ordinal < 1 || ordinal > 999) {
    throw new Error(`Invalid Season 11 seed ordinal: ${ordinal}`);
  }
  const suffix = `${String(sourceRow).padStart(9, '0')}${String(ordinal).padStart(3, '0')}`;
  return `${prefix}-0000-4000-8000-${suffix}`;
}

function seedHosts(plan) {
  return plan.hosts.map((host, index) => ({
    episode_host_id: season11SeedUuid(
      'host',
      plan.source_schedule_row,
      index + 1
    ),
    host_person_id: host.host_person_id || null,
    host_display_name: host.host_display_name,
    host_role: host.host_role,
    assignment_status: host.assignment_status,
    sort_order: index,
  }));
}

function seedGuests(plan) {
  return plan.guests.map((guest, index) => ({
    guest_id: season11SeedUuid(
      'guest',
      plan.source_schedule_row,
      index + 1
    ),
    display_name: guest.display_name,
    public_affiliation: guest.public_affiliation,
    public_profile_url: guest.public_profile_url || null,
    public_context: guest.public_context,
    guest_role: guest.guest_role,
    invitation_status: guest.invitation_status,
    public_angle: guest.public_angle,
    sort_order: index,
  }));
}

function seedSponsors(plan) {
  return plan.sponsor_commitments.map((commitment, index) => ({
    commitment_id: season11SeedUuid(
      'sponsor',
      plan.source_schedule_row,
      index + 1
    ),
    sponsor_display_name: commitment.sponsor_display_name,
    commitment_kind: commitment.commitment_kind,
    placement: commitment.placement,
    commitment_status: commitment.commitment_status,
    due_on: commitment.due_on,
    public_copy_note: commitment.public_copy_note,
  }));
}

export const SEASON_11_MASTERMIND_SEED_PAYLOAD = Object.freeze({
  season: Object.freeze({
    season_id: SEASON_11_MASTERMIND_SEASON_ID,
    label: CURRENT_SEASON.label,
    starts_on: CURRENT_SEASON.starts_on,
    ends_on: CURRENT_SEASON.ends_on,
    status: 'planning',
    planning_goal:
      'Build a dependable monthly Slabs n Sluffs rhythm and four regular episodes per core-season month.',
  }),
  plans: Object.freeze(
    SEASON_11_SCHEDULE_PLANS.map((plan) =>
      Object.freeze({
        source_row: plan.source_schedule_row,
        episode_plan_id: plan.episode_plan_id,
        working_title: plan.working_title,
        premise: plan.premise,
        listener_takeaway: plan.listener_takeaway,
        episode_type: plan.episode_type,
        status: plan.status,
        target_air_date: plan.target_air_date,
        hosts: Object.freeze(seedHosts(plan).map(Object.freeze)),
        guests: Object.freeze(seedGuests(plan).map(Object.freeze)),
        topics: Object.freeze([]),
        sources: Object.freeze([]),
        sponsor_commitments: Object.freeze(
          seedSponsors(plan).map(Object.freeze)
        ),
      })
    )
  ),
});
