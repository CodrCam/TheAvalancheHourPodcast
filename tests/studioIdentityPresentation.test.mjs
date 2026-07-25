import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isOpaqueStudioIdentity,
  pickStudioDisplayName,
  resolveStudioMessageAuthors,
} from '../lib/studioIdentityPresentation.mjs';

const cognitoId = '11cb0500-1081-7091-64a5-c83f639149b1';

test('never chooses an opaque Cognito identifier as a display name', () => {
  assert.equal(isOpaqueStudioIdentity(cognitoId), true);
  assert.equal(
    pickStudioDisplayName([cognitoId, 'cam@example.com']),
    'cam@example.com'
  );
  assert.equal(pickStudioDisplayName([cognitoId]), 'Team member');
});

test('resolves old discussion UUIDs to people or a clear role label', () => {
  const messages = [
    {
      author_name: cognitoId,
      author_role: 'producer',
      body: 'Current producer note',
    },
    {
      author_name: '22cb0500-1081-7091-64a5-c83f639149b2',
      author_role: 'host',
      body: 'Bound host note',
    },
    {
      author_name: '33cb0500-1081-7091-64a5-c83f639149b3',
      author_role: 'producer',
      body: 'Unresolved legacy note',
    },
  ];

  const resolved = resolveStudioMessageAuthors(messages, {
    namesByIdentifier: new Map([
      ['22cb0500-1081-7091-64a5-c83f639149b2', 'Sierra Bishop'],
    ]),
    currentIdentifiers: [cognitoId],
    currentAuthorName: 'Cam Griffin',
  });

  assert.equal(resolved[0].author_name, 'Cam Griffin');
  assert.equal(resolved[1].author_name, 'Sierra Bishop');
  assert.equal(resolved[2].author_name, 'Studio producer');
});
