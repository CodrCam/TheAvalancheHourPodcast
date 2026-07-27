import assert from 'node:assert/strict';
import test from 'node:test';
import logoutHandler from '../pages/api/store/admin/auth/logout.js';

test('sign out clears local authentication and returns to the website', () => {
  const headers = new Map();
  let redirect = null;
  const req = {
    method: 'POST',
    headers: { host: 'theavalanchehour.com', 'x-forwarded-proto': 'https' },
  };
  const res = {
    setHeader(name, value) {
      headers.set(name, value);
    },
    redirect(status, destination) {
      redirect = { status, destination };
    },
  };

  logoutHandler(req, res);

  assert.deepEqual(redirect, {
    status: 303,
    destination: '/admin/login?signed_out=1',
  });
  const cookies = headers.get('Set-Cookie');
  assert.equal(Array.isArray(cookies), true);
  assert.equal(
    cookies.every((cookie) => cookie.includes('Max-Age=0')),
    true
  );
  assert.equal(
    cookies.some((cookie) => cookie.startsWith('ah_admin_token=')),
    true
  );
});
