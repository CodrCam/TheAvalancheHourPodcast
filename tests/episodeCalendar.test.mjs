import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEpisodeCalendarFile,
  episodeCalendarFilename,
  formatRecordingSchedule,
  normalizeRecordingDate,
  normalizeRecordingTime,
  normalizeRecordingTimeZone,
  recordingStartDate,
  validateRecordingSchedule,
} from '../lib/episodeCalendar.mjs';

const scheduledEpisode = {
  episode_id: 'persistent-slab-forecast',
  title: 'Persistent Slab, Forecast & Field Notes',
  recording_date: '2026-08-01',
  recording_time: '10:30',
  recording_time_zone: 'America/Denver',
  recording_duration_minutes: 60,
  recording_location: 'Riverside; Room 1',
};

test('normalizes valid recording schedule fields', () => {
  assert.equal(normalizeRecordingDate('2026-08-01'), '2026-08-01');
  assert.equal(normalizeRecordingDate('2026-02-30'), '');
  assert.equal(normalizeRecordingTime('10:30'), '10:30');
  assert.equal(normalizeRecordingTime('25:00'), '');
  assert.equal(
    normalizeRecordingTimeZone('America/Denver'),
    'America/Denver'
  );
  assert.equal(normalizeRecordingTimeZone('Mars/Olympus_Mons'), '');
});

test('converts local recording time to the correct UTC instant', () => {
  assert.equal(
    recordingStartDate(scheduledEpisode)?.toISOString(),
    '2026-08-01T16:30:00.000Z'
  );
  assert.match(
    formatRecordingSchedule(scheduledEpisode),
    /Sat, August 1, 2026 at 10:30 AM MDT/
  );
});

test('requires a complete schedule once scheduling has started', () => {
  assert.deepEqual(validateRecordingSchedule({}), { complete: false });
  assert.throws(
    () =>
      validateRecordingSchedule({
        recording_date: '2026-08-01',
        recording_time: '10:30',
      }),
    /time zone/
  );
});

test('builds an escaped, downloadable UTC calendar event', () => {
  const calendar = buildEpisodeCalendarFile(scheduledEpisode, {
    now: new Date('2026-07-26T12:00:00.000Z'),
  });
  const unfolded = calendar.replace(/\r\n /g, '');

  assert.match(unfolded, /DTSTAMP:20260726T120000Z/);
  assert.match(unfolded, /DTSTART:20260801T163000Z/);
  assert.match(unfolded, /DTEND:20260801T173000Z/);
  assert.match(
    unfolded,
    /SUMMARY:The Avalanche Hour recording: Persistent Slab\\, Forecast & Field Notes/
  );
  assert.match(unfolded, /LOCATION:Riverside\\; Room 1/);
  assert.match(
    unfolded,
    /URL:https:\/\/www\.theavalanchehour\.com\/studio\/episodes\/persistent-slab-forecast/
  );
  assert.ok(
    calendar
      .split('\r\n')
      .every((line) => new TextEncoder().encode(line).length <= 75)
  );
  assert.ok(calendar.endsWith('END:VCALENDAR\r\n'));
});

test('creates a safe calendar filename', () => {
  assert.equal(
    episodeCalendarFilename(scheduledEpisode),
    'persistent-slab-forecast-field-notes-recording.ics'
  );
});
