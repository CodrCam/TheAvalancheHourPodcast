import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  consumeGuestQuestionnaireClientToken,
  GUEST_QUESTIONNAIRE_SESSION_TOKEN_KEY,
} from '../lib/guestQuestionnaireClientToken.mjs';

const FRAGMENT_TOKEN = 'header_one.payload_one.signature_one';
const STORED_TOKEN = 'header_two.payload_two.signature_two';

function createStorage(initialToken = '') {
  const values = new Map();
  if (initialToken) {
    values.set(GUEST_QUESTIONNAIRE_SESSION_TOKEN_KEY, initialToken);
  }
  return {
    getItem(key) {
      return values.get(key) || null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function createHistory() {
  const calls = [];
  return {
    state: { preserved: true },
    calls,
    replaceState(...args) {
      calls.push(args);
    },
  };
}

test('fragment token moves to tab storage and is removed from the URL', () => {
  const storage = createStorage(STORED_TOKEN);
  const history = createHistory();
  const token = consumeGuestQuestionnaireClientToken({
    location: {
      href: `https://example.test/studio/guest-questionnaire#token=${FRAGMENT_TOKEN}`,
    },
    history,
    storage,
  });

  assert.equal(token, FRAGMENT_TOKEN);
  assert.equal(
    storage.getItem(GUEST_QUESTIONNAIRE_SESSION_TOKEN_KEY),
    FRAGMENT_TOKEN
  );
  assert.deepEqual(history.calls, [
    [{ preserved: true }, '', '/studio/guest-questionnaire'],
  ]);
});

test('stored token keeps a scrubbed questionnaire page working after refresh', () => {
  const storage = createStorage(STORED_TOKEN);
  const history = createHistory();

  assert.equal(
    consumeGuestQuestionnaireClientToken({
      location: {
        href: 'https://example.test/studio/guest-questionnaire',
      },
      history,
      storage,
    }),
    STORED_TOKEN
  );
  assert.deepEqual(history.calls, []);
});

test('query tokens are rejected and scrubbed because requests can be logged', () => {
  const storage = createStorage();
  const history = createHistory();
  const token = consumeGuestQuestionnaireClientToken({
    location: {
      href: `https://example.test/studio/guest-questionnaire?token=${FRAGMENT_TOKEN}&source=old-link#details`,
    },
    history,
    storage,
  });

  assert.equal(token, '');
  assert.equal(storage.getItem(GUEST_QUESTIONNAIRE_SESSION_TOKEN_KEY), null);
  assert.equal(
    history.calls[0][2],
    '/studio/guest-questionnaire?source=old-link#details'
  );
});

test('scrubbing preserves unrelated fragment parameters', () => {
  const storage = createStorage();
  const history = createHistory();

  consumeGuestQuestionnaireClientToken({
    location: {
      href: `https://example.test/studio/guest-questionnaire#token=${FRAGMENT_TOKEN}&section=audio`,
    },
    history,
    storage,
  });

  assert.equal(
    history.calls[0][2],
    '/studio/guest-questionnaire#section=audio'
  );
});

test('new questionnaire links are issued with a fragment, never a query token', async () => {
  const [route, guestForm] = await Promise.all([
    readFile(
      new URL(
        '../pages/api/studio/episodes/[episodeId]/guest-questionnaire.js',
        import.meta.url
      ),
      'utf8'
    ),
    readFile(
      new URL('../components/GuestQuestionnaireForm.js', import.meta.url),
      'utf8'
    ),
  ]);

  assert.match(
    route,
    /share_path:\s*`\/studio\/guest-questionnaire#token=\$\{encodeURIComponent\(/
  );
  assert.doesNotMatch(
    route,
    /share_path:\s*`\/studio\/guest-questionnaire\?token=/
  );
  assert.match(guestForm, /consumeGuestQuestionnaireClientToken\s*\(/);
  assert.doesNotMatch(guestForm, /router\.query\.token/);
});
