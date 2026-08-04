import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function read(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('published Netlify deploys schedule protected Studio maintenance hourly', async () => {
  const [scheduled, background] = await Promise.all([
    read('../netlify/functions/studio-maintenance.mts'),
    read('../netlify/functions/studio-maintenance-background.mts'),
  ]);
  assert.match(scheduled, /schedule:\s*['"]@hourly['"]/);
  assert.match(
    scheduled,
    /\/\.netlify\/functions\/studio-maintenance-background/
  );
  assert.match(scheduled, /STUDIO_REMINDER_RUN_SECRET/);
  assert.match(background, /STUDIO_REMINDER_RUN_SECRET/);
  assert.match(background, /timingSafeEqual/);
  assert.match(background, /\/api\/studio\/reminders\/run/);
});
