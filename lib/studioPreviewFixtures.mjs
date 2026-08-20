import { CURRENT_SEASON } from './currentSeason.mjs';

export const STUDIO_PREVIEW_SESSION = Object.freeze({
  display_name: 'Caleb Merrill',
  username: 'caleb@example.com',
  groups: ['studio_manager'],
  features: { season_mastermind: true },
  capabilities: { producer_tasks: true },
  permissions: [
    'studio:read',
    'resources:read',
    'episodes:read',
    'episodes:update',
    'episodes:submit',
    'episodes:manage',
    'profile:self:read',
    'profile:self:update',
    'mic_kits:read',
    'intake:read',
    'intake:create',
    'intake:manage',
    'mastermind:read',
    'mastermind:manage',
  ],
});

export const STUDIO_PREVIEW_HREF_MAP = Object.freeze({
  '/studio': '/dev/today-preview',
  '/studio/mastermind': '/dev/season-mastermind-preview',
  '/studio/questionnaires': '/dev/studio-questionnaires-preview',
  '/studio/episodes': '/dev/episode-studio-usability-preview',
  '/studio/inbox': '/dev/inbox-preview',
  '/studio/manage/episodes#production-queue': '/dev/studio-production-preview',
  '/studio/production': '/dev/studio-production-preview',
});

export const STUDIO_PREVIEW_EPISODES = Object.freeze([
  {
    episode_id: 'season-opener',
    title: 'Slabs n Sluffs: Season opener',
    season: CURRENT_SEASON.label,
    status: 'in_progress',
    due_date: '2026-09-21',
    target_release_date: '2026-10-01',
    delivery_health: 'on_track',
    completion: { host_percent: 72 },
    host_names: ['Sara Boilen', 'Dom Baker'],
    producer_name: 'Caleb Merrill',
    producer_person_id: 'caleb-merrill',
    my_roles: ['producer'],
    workflow: {
      required_task_count: 10,
      completed_required_task_count: 4,
      completion_percent: 40,
      overdue_count: 0,
      next_due_task: {
        task_id: 'guest-prep-received',
        label: 'Review guest questionnaire',
        due_date: '2026-09-10',
      },
      task_states: [
        { task_id: 'guest-prep-sent', complete: true },
        { task_id: 'guest-prep-received', complete: false },
      ],
    },
  },
  {
    episode_id: 'first-storm',
    title: 'Reading the first storm of the season',
    season: CURRENT_SEASON.label,
    status: 'submitted',
    due_date: '2026-09-27',
    target_release_date: '2026-10-07',
    delivery_health: 'off_track',
    completion: { host_percent: 100 },
    host_names: ['Caleb Merrill'],
    producer_name: 'Molly Baker',
    producer_person_id: 'molly-baker',
    my_roles: ['host', 'workflow_assignee'],
    workflow: {
      required_task_count: 10,
      completed_required_task_count: 7,
      completion_percent: 70,
      overdue_count: 1,
      next_due_task: {
        task_id: 'edit-package-delivered',
        label: 'Upload raw tracks',
        due_date: '2026-09-29',
      },
      task_states: [
        { task_id: 'guest-prep-sent', complete: true },
        { task_id: 'guest-prep-received', complete: true },
      ],
    },
  },
  {
    episode_id: 'early-season-coverage',
    title: 'Early-season coverage and consequence',
    season: CURRENT_SEASON.label,
    status: 'planning',
    due_date: '2026-10-04',
    target_release_date: '2026-10-14',
    delivery_health: 'on_track',
    completion: { host_percent: 18 },
    host_names: ['Morgan Dinsdale'],
    producer_name: 'Caleb Merrill',
    producer_person_id: 'caleb-merrill',
    my_roles: ['creator'],
    workflow: {
      required_task_count: 10,
      completed_required_task_count: 1,
      completion_percent: 10,
      overdue_count: 0,
      next_due_task: {
        task_id: 'guest-prep-sent',
        label: 'Send guest questionnaire',
        due_date: '2026-09-20',
      },
      task_states: [
        { task_id: 'guest-prep-sent', complete: false },
        { task_id: 'guest-prep-received', complete: false },
      ],
    },
  },
]);

export const STUDIO_PREVIEW_SEASON = Object.freeze({
  ...CURRENT_SEASON,
  episode_studios: STUDIO_PREVIEW_EPISODES.length,
  by_status: {
    planning: 1,
    in_progress: 1,
    submitted: 1,
    submitted_with_gaps: 0,
    needs_changes: 0,
    accepted: 0,
  },
  next_releases: STUDIO_PREVIEW_EPISODES.map((episode) => ({
    title: episode.title,
    target_release_date: episode.target_release_date,
  })),
});

export const STUDIO_PREVIEW_MASTERMIND_OVERVIEW = Object.freeze({
  season: {
    label: CURRENT_SEASON.label,
    starts_on: CURRENT_SEASON.starts_on,
    ends_on: CURRENT_SEASON.ends_on,
    status: CURRENT_SEASON.status,
    planning_goal:
      'Build a dependable monthly Slabs n Sluffs rhythm and four regular episodes per core-season month.',
  },
  planning: {
    total: 38,
    undated: 0,
    by_status: {
      idea: 21,
      researching: 9,
      ready: 5,
      scheduled: 3,
      recording: 0,
      published: 0,
    },
    by_type: { regular: 29, slabs_and_sluffs: 9, special: 0 },
  },
});
