import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describeAccessClient,
  summarizeAccessSessions,
} from '../lib/accessLogPresentation.mjs';

test('summarizes account activity and observed session duration', () => {
  const generatedAt = new Date('2026-08-10T12:30:00.000Z');
  const result = summarizeAccessSessions(
    [
      {
        session_key: 'access_session#one',
        subject: 'user-one',
        username: 'cam@example.com',
        display_name: 'Cam Griffin',
        role: 'admin',
        groups: ['admin'],
        login_at: '2026-08-10T12:00:00.000Z',
        last_seen_at: '2026-08-10T12:28:00.000Z',
        token_expires_at: '2026-08-10T13:00:00.000Z',
      },
      {
        session_key: 'access_session#two',
        subject: 'user-one',
        username: 'cam@example.com',
        display_name: 'Cam Griffin',
        role: 'admin',
        groups: ['admin'],
        login_at: '2026-08-09T11:00:00.000Z',
        last_seen_at: '2026-08-09T11:20:00.000Z',
        ended_at: '2026-08-09T11:20:00.000Z',
        token_expires_at: '2026-08-09T12:00:00.000Z',
      },
      {
        session_key: 'access_session#three',
        subject: 'user-two',
        username: 'host@example.com',
        display_name: 'A Host',
        role: 'host',
        groups: ['host'],
        login_at: '2026-08-08T09:00:00.000Z',
        last_seen_at: '2026-08-08T09:10:00.000Z',
        token_expires_at: '2026-08-08T10:00:00.000Z',
      },
    ],
    { generatedAt }
  );

  assert.deepEqual(result.summary, {
    unique_users: 2,
    login_count: 3,
    active_now: 1,
    total_duration_seconds: 3600,
  });
  assert.equal(result.users[0].display_name, 'Cam Griffin');
  assert.equal(result.users[0].login_count, 2);
  assert.equal(result.users[0].average_duration_seconds, 1500);
  assert.equal(result.sessions[0].status, 'active');
  assert.equal(result.sessions[1].status, 'signed_out');
  assert.equal(result.sessions[2].status, 'expired');
});

test('turns common browser user agents into readable client labels', () => {
  assert.equal(
    describeAccessClient(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/140.0 Safari/537.36'
    ),
    'Chrome on macOS'
  );
  assert.equal(describeAccessClient(''), 'Unknown device');
});
