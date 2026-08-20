import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const homePagePath = new URL('../pages/index.js', import.meta.url);

test('homepage describes the current year-round release cadence', async () => {
  const source = await readFile(homePagePath, 'utf8');

  assert.match(source, /<strong>Year-round<\/strong>/);
  assert.match(
    source,
    /Nearly weekly, with selected weeks carrying a second release\./
  );
  assert.doesNotMatch(source, /October—May/);
  assert.doesNotMatch(source, /Weekly core episodes plus monthly Slabs n Sluffs\./);
});
