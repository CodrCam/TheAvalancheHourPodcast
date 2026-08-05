import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EMPTY_EPISODE_REQUEST_FORM,
  buildEpisodeRequestItem,
  normalizeEpisodeRequestForm,
  validateEpisodeRequestForm,
} from '../lib/episodeRequest.mjs';

const completeRequest = {
  working_title: 'Forecasting the Human Factor',
  pitch:
    'Explore how backcountry partners recognize and interrupt risky group decisions.',
  proposed_guest: 'Dr. Taylor Morgan',
  preferred_air_date: '2026-09-17',
};

test('normalizes episode-request form fields without truncating them', () => {
  assert.deepEqual(
    normalizeEpisodeRequestForm({
      working_title: '  Storm slabs and uncertainty  ',
      pitch: '  A practical listener takeaway.\r\nSecond paragraph.  ',
      proposed_guest: '  Jordan Lee  ',
      preferred_air_date: '  2026-10-08  ',
    }),
    {
      working_title: 'Storm slabs and uncertainty',
      pitch: 'A practical listener takeaway.\nSecond paragraph.',
      proposed_guest: 'Jordan Lee',
      preferred_air_date: '2026-10-08',
    }
  );
  assert.deepEqual(
    normalizeEpisodeRequestForm(),
    EMPTY_EPISODE_REQUEST_FORM
  );
});

test('builds the exact Team Inbox request item with readable details', () => {
  assert.deepEqual(buildEpisodeRequestItem(completeRequest), {
    kind: 'request',
    priority: 'normal',
    title: 'Episode request: Forecasting the Human Factor',
    details: [
      'Working title: Forecasting the Human Factor',
      'Proposed guest: Dr. Taylor Morgan',
      'Preferred air date: 2026-09-17',
      'Pitch / listener takeaway:',
      'Explore how backcountry partners recognize and interrupt risky group decisions.',
    ].join('\n'),
  });
});

test('omits blank optional fields from the Team Inbox details', () => {
  const item = buildEpisodeRequestItem({
    working_title: 'A field debrief',
    pitch: 'Give listeners practical lessons from a recent field day.',
  });

  assert.doesNotMatch(item.details, /Proposed guest:/);
  assert.doesNotMatch(item.details, /Preferred air date:/);
  assert.match(item.details, /Working title: A field debrief/);
  assert.match(item.details, /Pitch \/ listener takeaway:/);
});

test('enforces required and maximum text lengths after trimming', () => {
  assert.throws(
    () =>
      validateEpisodeRequestForm({
        ...completeRequest,
        working_title: '  ab  ',
      }),
    { message: /^Episode request:/ }
  );
  assert.throws(
    () =>
      validateEpisodeRequestForm({
        ...completeRequest,
        working_title: 'x'.repeat(151),
      }),
    { message: /^Episode request:/ }
  );
  assert.throws(
    () => validateEpisodeRequestForm({ ...completeRequest, pitch: 'short' }),
    { message: /^Episode request:/ }
  );
  assert.throws(
    () =>
      validateEpisodeRequestForm({
        ...completeRequest,
        pitch: 'x'.repeat(5001),
      }),
    { message: /^Episode request:/ }
  );
  assert.throws(
    () =>
      validateEpisodeRequestForm({
        ...completeRequest,
        proposed_guest: 'x'.repeat(181),
      }),
    { message: /^Episode request:/ }
  );

  assert.doesNotThrow(() =>
    validateEpisodeRequestForm({
      working_title: 'x'.repeat(150),
      pitch: 'x'.repeat(5000),
      proposed_guest: 'x'.repeat(180),
    })
  );
});

test('accepts only real YYYY-MM-DD preferred air dates', () => {
  assert.doesNotThrow(() => validateEpisodeRequestForm(completeRequest));
  assert.doesNotThrow(() =>
    validateEpisodeRequestForm({
      ...completeRequest,
      preferred_air_date: '',
    })
  );
  for (const preferred_air_date of [
    '09/17/2026',
    '2026-9-17',
    '2026-02-30',
  ]) {
    assert.throws(
      () =>
        validateEpisodeRequestForm({
          ...completeRequest,
          preferred_air_date,
        }),
      { message: /^Episode request:/ }
    );
  }
});
