import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  SEASON_11_CURATED_GUEST_IDEAS,
  SEASON_11_HISTORICAL_PRODUCTION_LEADS,
  SEASON_11_HOST_GOALS,
  SEASON_11_HOST_TAB_ORPHANS,
  SEASON_11_INTAKE_SUBMISSIONS,
  SEASON_11_MASTERMIND_WORKBOOK_INDEX,
  SEASON_11_PUBLIC_GUEST_SUGGESTIONS,
  SEASON_11_SZW_RESOURCES,
  SEASON_11_WORKBOOK_COVERAGE,
  SEASON_11_WORKBOOK_SHEET_COVERAGE,
} from '../lib/season11MastermindWorkbookIndex.mjs';

function countBy(items, key) {
  return Object.fromEntries(
    items.reduce((counts, item) => {
      const value = key(item);
      counts.set(value, (counts.get(value) || 0) + 1);
      return counts;
    }, new Map())
  );
}

test('indexes every privacy-safe non-schedule workbook record', () => {
  assert.equal(SEASON_11_HOST_GOALS.length, 21);
  assert.equal(SEASON_11_HISTORICAL_PRODUCTION_LEADS.length, 25);
  assert.equal(SEASON_11_CURATED_GUEST_IDEAS.length, 35);
  assert.equal(SEASON_11_PUBLIC_GUEST_SUGGESTIONS.length, 3);
  assert.equal(SEASON_11_INTAKE_SUBMISSIONS.length, 12);

  assert.deepEqual(
    countBy(
      SEASON_11_HISTORICAL_PRODUCTION_LEADS,
      (lead) => lead.source.normalizedSheet
    ),
    {
      Caleb: 12,
      Dom: 2,
      SZW: 1,
      Shiny: 2,
      'Brooke M': 6,
      Jason: 2,
    }
  );

  assert.equal(
    SEASON_11_HISTORICAL_PRODUCTION_LEADS.reduce(
      (total, lead) => total + lead.source.columns.length,
      0
    ),
    67
  );
  assert.equal(
    SEASON_11_INTAKE_SUBMISSIONS.reduce(
      (total, submission) => total + submission.completedFieldCount,
      0
    ),
    199
  );
});

test('preserves workbook-only rows and restricted presence flags safely', () => {
  const hiddenIdea = SEASON_11_CURATED_GUEST_IDEAS.find(
    (idea) => idea.source.row === 18
  );
  assert.equal(hiddenIdea.displayName, 'Aleph Johnston Bloom');
  assert.equal(hiddenIdea.hiddenInWorkbook, true);

  assert.deepEqual(
    SEASON_11_HOST_TAB_ORPHANS.map((item) => [
      item.source.normalizedSheet,
      item.source.row,
      item.kind,
    ]),
    [
      ['Dom', 4, 'release_date_without_guest'],
      ['SZW', 17, 'merged_area_marker'],
    ]
  );

  const restrictedLink = SEASON_11_SZW_RESOURCES.find(
    (resource) => resource.source.row === 29
  );
  assert.equal(restrictedLink.hasRestrictedAdminLink, true);
  assert.equal(Object.hasOwn(restrictedLink, 'url'), false);

  const publicSuggestion = SEASON_11_PUBLIC_GUEST_SUGGESTIONS.find(
    (suggestion) => suggestion.source.row === 5
  );
  assert.equal(publicSuggestion.suggestion, 'Keith Robine');
  assert.equal(publicSuggestion.hasRestrictedContact, true);
  assert.equal(publicSuggestion.hasRestrictedMessage, true);
});

test('handles the trailing-space Jason worksheet without dropping its cells', () => {
  const coverage = SEASON_11_WORKBOOK_SHEET_COVERAGE.find(
    (sheet) => sheet.normalizedSheet === 'Jason'
  );
  const leads = SEASON_11_HISTORICAL_PRODUCTION_LEADS.filter(
    (lead) => lead.source.normalizedSheet === 'Jason'
  );

  assert.equal(coverage.sourceSheet, 'Jason ');
  assert.equal(coverage.nonemptyCellCount, 17);
  assert.deepEqual(
    leads.map((lead) => [lead.source.sheet, lead.source.row]),
    [
      ['Jason ', 2],
      ['Jason ', 3],
    ]
  );
});

test('reconciles the full 649-cell workbook coverage manifest', () => {
  assert.equal(SEASON_11_WORKBOOK_COVERAGE.sheetCount, 13);
  assert.equal(
    SEASON_11_WORKBOOK_COVERAGE.expectedNonemptyCellCount,
    649
  );
  assert.equal(SEASON_11_WORKBOOK_COVERAGE.indexedNonemptyCellCount, 649);
  assert.equal(
    SEASON_11_WORKBOOK_SHEET_COVERAGE.reduce(
      (total, sheet) => total + sheet.nonemptyCellCount,
      0
    ),
    649
  );

  for (const sheet of SEASON_11_WORKBOOK_SHEET_COVERAGE) {
    assert.equal(
      Object.values(sheet.partitions).reduce(
        (total, count) => total + count,
        0
      ),
      sheet.nonemptyCellCount,
      `${sheet.sourceSheet} partitions should cover its nonempty cells`
    );
  }

  assert.deepEqual(
    SEASON_11_WORKBOOK_SHEET_COVERAGE.find(
      (sheet) => sheet.sourceSheet === 'Guest Ideas'
    ).hiddenNonemptyRows,
    [18]
  );
  assert.equal(SEASON_11_MASTERMIND_WORKBOOK_INDEX.coverage, SEASON_11_WORKBOOK_COVERAGE);
});

test('commits no direct contact, shipping, questionnaire-answer, or admin-link values', async () => {
  const moduleSource = await fs.readFile(
    new URL('../lib/season11MastermindWorkbookIndex.mjs', import.meta.url),
    'utf8'
  );
  const serializedIndex = JSON.stringify(SEASON_11_MASTERMIND_WORKBOOK_INDEX);

  assert.doesNotMatch(
    moduleSource,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  );
  assert.doesNotMatch(moduleSource, /https?:\/\/|www\./i);
  assert.doesNotMatch(
    moduleSource,
    /(?:docs|drive)\.google\.com|forms\.gle|calendly\.com/i
  );
  assert.doesNotMatch(
    moduleSource,
    /\b\d{2,6}\s+[A-Za-z][A-Za-z .'-]{1,60}\s(?:Street|St\.?|Road|Rd\.?|Avenue|Ave\.?|Drive|Dr\.?|Lane|Ln\.?|PO Box)\b/i
  );
  assert.doesNotMatch(serializedIndex, /@|https?:\/\//i);

  for (const submission of SEASON_11_INTAKE_SUBMISSIONS) {
    assert.deepEqual(Object.keys(submission).sort(), [
      'completedFieldCount',
      'completionPercent',
      'displayName',
      'missingFields',
      'presentFields',
      'source',
      'totalFieldCount',
    ]);
  }
});
