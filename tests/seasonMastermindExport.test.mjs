import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildSeasonMastermindCsv,
  SEASON_MASTERMIND_EXPORT_COLUMNS,
} from '../lib/seasonMastermindExport.mjs';

test('exports only reviewed planning fields and neutralizes spreadsheet formulas', () => {
  const csv = buildSeasonMastermindCsv({
    seasons: [{ season_id: 'season-1', label: 'Season 12' }],
    plans: [
      {
        episode_plan_id: 'private-internal-id',
        season_id: 'season-1',
        status: 'ready',
        source_episode_number: '11.10',
        episode_type: 'special',
        target_air_date: '2026-10-08',
        working_title: '=IMPORTXML("https://tracker.test")',
        premise: 'Reviewed public premise',
        listener_takeaway: 'Reviewed listener takeaway',
        source_intake_item_id: 'private-intake-id',
        linked_episode_id: 'private-episode-id',
        created_by_person_id: 'private-person-id',
        hosts: [
          { host_display_name: 'Host One', host_role: 'lead_host' },
        ],
        guests: [
          { display_name: 'Guest One', invitation_status: 'confirmed' },
        ],
        topics: [{ label: 'Decision making' }],
        sources: [
          {
            title: 'Public research',
            publisher: 'Public publisher',
            canonical_url: 'https://example.test/research',
          },
        ],
        sponsor_commitments: [
          {
            sponsor_display_name: 'Community partner',
            commitment_status: 'confirmed',
            placement: 'mid_roll',
            date_locked: true,
          },
        ],
        recording_note: 'Record after ISSW',
        source_status_note: 'RECORDING FINISHED',
        source_quality_flags: ['air_date_year_corrected'],
      },
    ],
  });

  assert.equal(csv.split('\r\n')[0].split(',').length, SEASON_MASTERMIND_EXPORT_COLUMNS.length);
  assert.match(csv, /"'=IMPORTXML/);
  assert.match(csv, /"Host One; \(lead host\)"/);
  assert.match(csv, /https:\/\/example\.test\/research/);
  assert.match(csv, /"11\.10"/);
  assert.match(csv, /date locked/);
  assert.match(csv, /Record after ISSW/);
  assert.match(csv, /air date year corrected/);
  assert.doesNotMatch(csv, /private-internal-id|private-intake-id|private-episode-id|private-person-id/);
});

test('export route is manager-only, bounded, audited, and non-cacheable', async () => {
  const route = await readFile(
    new URL('../pages/api/studio/mastermind/export.js', import.meta.url),
    'utf8'
  );
  assert.match(route, /MASTERMIND_MANAGE/);
  assert.match(route, /MAX_EXPORT_PAGES = 10/);
  assert.match(route, /MAX_EXPORT_BYTES = 2 \* 1024 \* 1024/);
  assert.match(route, /private, no-store/);
  assert.match(route, /X-Content-Type-Options/);
  assert.match(route, /studio\.mastermind\.export/);
  assert.doesNotMatch(route, /source_intake_item_id|linked_episode_id/);
});
