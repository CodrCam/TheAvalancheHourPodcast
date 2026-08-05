import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getPersonStudioCapabilities,
  personHasStudioCapability,
} from '../lib/peopleStudioCapabilities.mjs';
import { getPeopleSectionId } from '../lib/peoplePresentation.mjs';
import { people } from '../src/data/people.js';

test('recognizes primary and additional Studio capabilities', () => {
  assert.equal(
    personHasStudioCapability({ role: 'host' }, 'host'),
    true
  );
  assert.equal(
    personHasStudioCapability(
      { role: 'webmaster', studioRoles: ['host', 'producer'] },
      'producer'
    ),
    true
  );
  assert.deepEqual(
    getPersonStudioCapabilities({
      role: 'host',
      studioRoles: ['producer'],
    }),
    { host: true, producer: true }
  );
});

test('does not infer Studio access from unrelated public labels', () => {
  assert.equal(
    personHasStudioCapability(
      { role: 'team', roles: ['Audio editor', 'Community lead'] },
      'host'
    ),
    false
  );
});

test('publishes Angie Lake with host and producer Studio capabilities', () => {
  const angie = people.find((person) => person.slug === 'angie-link');

  assert.ok(angie);
  assert.equal(angie.name, 'Angie Lake');
  assert.equal(angie.role, 'producer');
  assert.equal(angie.active, true);
  assert.equal(getPeopleSectionId(angie), 'team');
  assert.deepEqual(getPersonStudioCapabilities(angie), {
    host: true,
    producer: true,
  });
});

test('keeps Sierra Bishop as a team profile without inventing episode roles', () => {
  const sierra = people.find((person) => person.slug === 'sierra-bishop');

  assert.ok(sierra);
  assert.equal(sierra.name, 'Sierra Bishop');
  assert.equal(sierra.role, 'social_media_manager');
  assert.notEqual(sierra.active, false);
  assert.equal(getPeopleSectionId(sierra), 'team');
  assert.deepEqual(getPersonStudioCapabilities(sierra), {
    host: false,
    producer: false,
  });
});
