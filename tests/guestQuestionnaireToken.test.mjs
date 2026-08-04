import test from 'node:test';
import assert from 'node:assert/strict';
import {
  guestQuestionnaireTokenMatchesLink,
  isGuestQuestionnairePublicAccessAllowed,
  issueGuestQuestionnaireToken,
  verifyGuestQuestionnaireToken,
} from '../lib/guestQuestionnaireToken.mjs';

const secret = 'test-secret-that-is-longer-than-thirty-two-characters';
const issuedAt = new Date('2026-08-04T12:00:00.000Z');

test('issues an episode-scoped signed token and stores only its revocation hash', () => {
  const issued = issueGuestQuestionnaireToken({
    episodeId: 'episode-one',
    expiresInDays: 7,
    now: issuedAt,
    secret,
  });
  const payload = verifyGuestQuestionnaireToken(issued.token, {
    now: new Date('2026-08-05T12:00:00.000Z'),
    secret,
  });

  assert.equal(payload.episode_id, 'episode-one');
  assert.equal(payload.token_jti_hash, issued.token_jti_hash);
  assert.equal(
    guestQuestionnaireTokenMatchesLink(
      payload,
      {
        status: 'active',
        token_jti_hash: issued.token_jti_hash,
        expires_at: issued.expires_at,
      },
      new Date('2026-08-05T12:00:00.000Z')
    ),
    true
  );
  assert.doesNotMatch(issued.token_jti_hash, new RegExp(issued.token, 'i'));
});

test('rejects tampered, expired, regenerated, and revoked guest links', () => {
  const issued = issueGuestQuestionnaireToken({
    episodeId: 'episode-one',
    expiresInDays: 1,
    now: issuedAt,
    secret,
  });
  assert.throws(
    () =>
      verifyGuestQuestionnaireToken(`${issued.token}x`, {
        now: issuedAt,
        secret,
      }),
    /invalid/i
  );
  assert.throws(
    () =>
      verifyGuestQuestionnaireToken(issued.token, {
        now: new Date('2026-08-05T12:00:01.000Z'),
        secret,
      }),
    /expired|invalid/i
  );

  const payload = verifyGuestQuestionnaireToken(issued.token, {
    now: issuedAt,
    secret,
  });
  assert.equal(
    guestQuestionnaireTokenMatchesLink(
      payload,
      {
        status: 'active',
        token_jti_hash: 'regenerated-token-hash',
        expires_at: issued.expires_at,
      },
      issuedAt
    ),
    false
  );
  assert.equal(
    guestQuestionnaireTokenMatchesLink(
      payload,
      {
        status: 'revoked',
        token_jti_hash: issued.token_jti_hash,
        expires_at: issued.expires_at,
      },
      issuedAt
    ),
    false
  );
});

test('active links stop working when their Episode Studio is accepted, archived, or deleted', () => {
  const issued = issueGuestQuestionnaireToken({
    episodeId: 'episode-one',
    now: issuedAt,
    secret,
  });
  const tokenPayload = verifyGuestQuestionnaireToken(issued.token, {
    now: issuedAt,
    secret,
  });
  const record = {
    episode_id: 'episode-one',
    link: {
      status: 'active',
      token_jti_hash: issued.token_jti_hash,
      expires_at: issued.expires_at,
    },
  };
  const episode = { episode_id: 'episode-one', archived: false };
  assert.equal(
    isGuestQuestionnairePublicAccessAllowed({
      tokenPayload,
      record,
      episode,
      now: issuedAt,
    }),
    true
  );
  assert.equal(
    isGuestQuestionnairePublicAccessAllowed({
      tokenPayload,
      record,
      episode: { ...episode, status: 'accepted' },
      now: issuedAt,
    }),
    false
  );
  assert.equal(
    isGuestQuestionnairePublicAccessAllowed({
      tokenPayload,
      record,
      episode: { ...episode, archived: true },
      now: issuedAt,
    }),
    false
  );
  assert.equal(
    isGuestQuestionnairePublicAccessAllowed({
      tokenPayload,
      record,
      episode: {
        ...episode,
        deleted_at: '2026-08-04T12:00:00.000Z',
      },
      now: issuedAt,
    }),
    false
  );
});
