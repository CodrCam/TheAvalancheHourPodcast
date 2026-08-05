import test from 'node:test';
import assert from 'node:assert/strict';
import {
  auditStudioAccessRoster,
  selectStudioAccessPeople,
} from '../lib/studioAccessRoster.mjs';
import { people as sourcePeople } from '../src/data/people.js';

test('makes every current source host and team member connectable', () => {
  const selected = selectStudioAccessPeople(sourcePeople);
  const selectedIds = selected.map((person) => person.person_id);

  assert.equal(
    selected.length,
    sourcePeople.filter((person) => person.active !== false).length
  );
  assert.ok(selectedIds.includes('sierra-bishop'));
  assert.equal(selectedIds.includes('bob-keating'), false);
});

test('shows every valid active profile without inferring Studio capabilities', () => {
  const people = [
    {
      person_id: 'sierra-bishop',
      name: 'Sierra Bishop',
      role: 'social_media_manager',
      active: true,
    },
    {
      person_id: 'angie-lake',
      name: 'Angie Lake',
      role: 'producer',
      active: true,
    },
    {
      person_id: 'site-team',
      name: 'Site Team',
      role: 'team',
      active: true,
    },
    {
      person_id: 'webmaster',
      name: 'Webmaster',
      role: 'webmaster',
      active: true,
    },
  ];

  assert.deepEqual(
    selectStudioAccessPeople(people).map((person) => person.person_id),
    ['sierra-bishop', 'angie-lake', 'site-team', 'webmaster']
  );
});

test('keeps bound inactive profiles and rejects incomplete or unbound inactive profiles', () => {
  const people = [
    { slug: 'active-by-default', name: '  Active Person  ' },
    { person_id: 'bound-former-host', name: 'Former Host', active: false },
    { person_id: 'disabled-binding', name: 'Disabled Binding', active: false },
    { person_id: 'unbound-inactive', name: 'Unbound Person', active: false },
    { person_id: '', name: 'Missing ID', active: true },
    { person_id: 'missing-name', name: '  ', active: true },
  ];
  const bindings = [
    {
      person_id: 'bound-former-host',
      user_sub: 'bound-subject',
      active: true,
    },
    {
      person_id: 'disabled-binding',
      user_sub: 'disabled-subject',
      active: false,
    },
  ];

  const selected = selectStudioAccessPeople(people, bindings);

  assert.deepEqual(
    selected.map((person) => person.person_id),
    ['active-by-default', 'bound-former-host']
  );
  assert.equal(selected[0].name, 'Active Person');
  assert.equal(selected[0].binding, null);
  assert.equal(selected[1].active, false);
  assert.equal(selected[1].binding, bindings[0]);
});

test('selecting profiles is pure', () => {
  const people = [
    { slug: 'sierra-bishop', name: ' Sierra Bishop ', active: true },
  ];
  const bindings = [];
  const peopleBefore = structuredClone(people);

  const selected = selectStudioAccessPeople(people, bindings);

  assert.deepEqual(people, peopleBefore);
  assert.notEqual(selected[0], people[0]);
  assert.equal(selected[0].person_id, 'sierra-bishop');
});

test('audits raw source slugs against live person IDs', () => {
  const sourcePeople = [
    { slug: 'caleb-merrill', name: 'Caleb Merrill' },
    { slug: 'sierra-bishop', name: 'Sierra Bishop' },
    { person_id: 'site-team', slug: 'old-site-team', name: 'Site Team' },
    { slug: 'archived-source', name: 'Archived Source', active: false },
    { slug: 'sierra-bishop', name: 'Duplicate Sierra' },
  ];
  const livePeople = [
    {
      person_id: 'caleb-merrill',
      name: 'Caleb Merrill',
      active: true,
    },
    {
      person_id: 'archived-source',
      name: 'Archived Source',
      active: false,
    },
    {
      person_id: 'live-only-team-member',
      name: 'Live Team Member',
      active: true,
    },
  ];

  const audit = auditStudioAccessRoster(sourcePeople, livePeople);

  assert.deepEqual(audit.missingPersonIds, ['sierra-bishop', 'site-team']);
  assert.deepEqual(
    audit.activeLiveProfiles.map((person) => person.person_id),
    ['caleb-merrill', 'live-only-team-member']
  );
});

test('audit comparison uses IDs rather than names and tolerates absent arrays', () => {
  assert.deepEqual(
    auditStudioAccessRoster(
      [{ slug: 'source-id', name: 'Same Name' }],
      [{ person_id: 'different-id', name: 'Same Name', active: true }]
    ).missingPersonIds,
    ['source-id']
  );
  assert.deepEqual(auditStudioAccessRoster(null, undefined), {
    missingPersonIds: [],
    activeLiveProfiles: [],
  });
});
