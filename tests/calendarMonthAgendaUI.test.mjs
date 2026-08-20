import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [
  mastermindSource,
  mastermindStyles,
  scheduleSource,
  scheduleStyles,
] = await Promise.all([
  readFile(
    new URL('../components/SeasonMastermindWorkspace.js', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../styles/SeasonMastermind.module.css', import.meta.url),
    'utf8'
  ),
  readFile(new URL('../pages/admin/studios/index.js', import.meta.url), 'utf8'),
  readFile(
    new URL('../styles/EpisodeStudio.module.css', import.meta.url),
    'utf8'
  ),
]);

test('Mastermind pairs its calendar with a clickable selected-month lineup', () => {
  assert.match(mastermindSource, /className=\{styles\.calendarLayout\}/);
  assert.match(mastermindSource, /Month lineup/);
  assert.match(mastermindSource, /className=\{styles\.calendarAgendaList\}/);
  assert.match(mastermindSource, /onClick=\{\(\) => onOpen\(plan\)\}/);
  assert.match(
    mastermindStyles,
    /@container mastermind-calendar \(min-width: 920px\)/
  );
  assert.match(
    mastermindStyles,
    /\.calendarLayout \{[\s\S]*grid-template-columns:[\s\S]*\.calendarAgenda/
  );
  assert.match(mastermindSource, /<details className=\{styles\.filterDisclosure\}>/);
  assert.match(mastermindSource, /Filters active/);
  assert.match(mastermindStyles, /\.filterDisclosure\[open\] \.filters/);
  assert.match(mastermindSource, /className=\{styles\.filterStateOpen\}>Hide/);
  assert.match(mastermindSource, /role="region"/);
});

test('Schedule & assignments adds a month-specific linked agenda beside the calendar', () => {
  assert.match(scheduleSource, /listEpisodeScheduleMonth\(episodes, viewMonth\)/);
  assert.match(scheduleSource, /Selected month/);
  assert.match(scheduleSource, /className=\{styles\.scheduleMonthLayout\}/);
  assert.match(scheduleSource, /styles\.monthAgendaRow/);
  assert.match(scheduleSource, /<section id="production-queue"/);
  assert.match(scheduleSource, /previewData = null/);
  assert.match(scheduleSource, /episodeScheduleHref/);
  assert.match(scheduleSource, /hrefFor\('\/studio\/mastermind'\)/);
  assert.match(scheduleSource, /disabled=\{preview\}/);
  assert.match(
    scheduleStyles,
    /@container schedule-month \(min-width: 920px\)/
  );
});
