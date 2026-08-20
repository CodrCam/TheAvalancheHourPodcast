import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const componentPath = new URL('../components/PublicFormHumanCheck.js', import.meta.url);
const guestPagePath = new URL('../pages/be-a-guest.js', import.meta.url);
const contactPagePath = new URL('../pages/contact.js', import.meta.url);

test('public form human check explicitly renders Turnstile with safe key selection', async () => {
  const source = await readFile(componentPath, 'utf8');

  assert.match(source, /api\.js\?render=explicit/);
  assert.match(source, /window\.turnstile\.render/);
  assert.match(source, /NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  assert.match(source, /process\.env\.NODE_ENV !== 'production'/);
  assert.match(source, /1x00000000000000000000AA/);
  assert.match(source, /'expired-callback'/);
  assert.match(source, /'error-callback'/);
  assert.match(source, /aria-live=/);
  assert.match(source, /resetKey/);
});

test('guest application requires and submits an action-bound Turnstile token', async () => {
  const source = await readFile(guestPagePath, 'utf8');

  assert.match(source, /action="guest_application"/);
  assert.match(source, /body: JSON\.stringify\(\{ \.\.\.formData, turnstileToken \}\)/);
  assert.match(source, /disabled=\{loading \|\| !turnstileToken\}/);
  assert.match(source, /setHumanCheckResetKey/);
});

test('contact form binds verification to contact or sponsorship', async () => {
  const source = await readFile(contactPagePath, 'utf8');

  assert.match(
    source,
    /action=\{formData\.isSponsorship \? 'sponsorship' : 'contact'\}/
  );
  assert.match(source, /body: JSON\.stringify\(\{ \.\.\.formData, turnstileToken \}\)/);
  assert.match(source, /disabled=\{loading \|\| !turnstileToken\}/);
  assert.match(source, /if \(name === 'isSponsorship'\)/);
});
