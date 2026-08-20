import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pagePath = new URL('../pages/studio/episodes/index.js', import.meta.url);

test('Host Studio rows always open the host package, never producer tasks', async () => {
  const source = await readFile(pagePath, 'utf8');
  assert.match(
    source,
    /href=\{`\/studio\/episodes\/\$\{encodeURIComponent\(/
  );
  assert.doesNotMatch(
    source,
    /required_task_count\s*\?\s*['"]\/production/
  );
  assert.match(source, /<span>Open Host Studio →<\/span>/);
  assert.match(source, /production_lead: 'Production lead'/);
});

test('Host Studio reuses the personal response calendar in the normal path', async () => {
  const source = await readFile(pagePath, 'utf8');
  assert.match(source, /applyCalendarEntries\(data\.calendar\)/);
  assert.equal(
    source.match(/\/api\/studio\/episodes\?scope=calendar/g)?.length,
    1,
    'calendar-only fetch should remain only as the unconnected-profile fallback'
  );
});
