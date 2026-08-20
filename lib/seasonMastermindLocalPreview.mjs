import { CURRENT_SEASON } from './currentSeason.mjs';
import {
  SEASON_11_MASTERMIND_SEASON_ID,
  SEASON_11_SCHEDULE_HOSTS,
  SEASON_11_SCHEDULE_PLANS,
  SEASON_11_SCHEDULE_SOURCE,
} from './season11MastermindSchedule.mjs';
import { SEASON_11_MASTERMIND_WORKBOOK_INDEX } from './season11MastermindWorkbookIndex.mjs';

export function shouldUseLocalSeasonMastermindPreview({
  nodeEnv = '',
  configured = false,
} = {}) {
  return nodeEnv !== 'production' && configured !== true;
}

export const LOCAL_SEASON_MASTERMIND_PREVIEW = Object.freeze({
  featureEnabled: true,
  configured: true,
  preview_state: 'ready',
  canManage: true,
  viewer_person_id: 'local-planning-manager',
  selected_season_id: SEASON_11_MASTERMIND_SEASON_ID,
  source: SEASON_11_SCHEDULE_SOURCE,
  workbook_index: SEASON_11_MASTERMIND_WORKBOOK_INDEX,
  directory: {
    hosts: SEASON_11_SCHEDULE_HOSTS,
    producers: [
      { person_id: 'caleb-merrill', name: 'Caleb Merrill' },
      { person_id: 'angie-link', name: 'Angie Lake' },
    ],
  },
  seasons: [
    {
      season_id: SEASON_11_MASTERMIND_SEASON_ID,
      label: CURRENT_SEASON.label,
      starts_on: CURRENT_SEASON.starts_on,
      ends_on: CURRENT_SEASON.ends_on,
      status: 'planning',
      planning_goal:
        'Build a dependable monthly Slabs n Sluffs rhythm and four regular episodes per core-season month.',
      revision: 1,
    },
  ],
  plans: SEASON_11_SCHEDULE_PLANS,
});
