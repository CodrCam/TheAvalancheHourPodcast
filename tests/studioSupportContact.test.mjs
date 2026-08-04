import test from 'node:test';
import assert from 'node:assert/strict';
import { getStudioSupportContact } from '../lib/studioSupportContact.mjs';

test('provides a role-based technical support contact for signed-in team pages', () => {
  assert.deepEqual(getStudioSupportContact({}), {
    name: 'Technical support',
    email: 'ct.griffin7@gmail.com',
    phone: '425-786-4328',
    phone_href: '+14257864328',
  });
});

test('accepts safe deployment overrides and rejects malformed contact values', () => {
  assert.deepEqual(
    getStudioSupportContact({
      STUDIO_SUPPORT_NAME: '  Studio Support  ',
      STUDIO_SUPPORT_EMAIL: 'SUPPORT@example.com',
      STUDIO_SUPPORT_PHONE: '(206) 555-0142',
    }),
    {
      name: 'Studio Support',
      email: 'support@example.com',
      phone: '206-555-0142',
      phone_href: '+12065550142',
    }
  );

  assert.deepEqual(
    getStudioSupportContact({
      STUDIO_SUPPORT_EMAIL: 'not-an-email',
      STUDIO_SUPPORT_PHONE: '911',
    }),
    {
      name: 'Technical support',
      email: 'ct.griffin7@gmail.com',
      phone: '425-786-4328',
      phone_href: '+14257864328',
    }
  );
});
