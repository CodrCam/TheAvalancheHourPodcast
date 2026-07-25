import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStudioGuide,
  sanitizeStudioGuideForHosts,
  studioGuideSearchText,
  validateStudioGuide,
} from '../lib/studioGuidePresentation.mjs';

const sampleGuide = {
  title: 'Guide',
  sections: [
    {
      id: 'second',
      category: 'Record',
      title: 'Recording',
      summary: 'Microphone setup',
      body: '- Check the microphone\n- Wear headphones',
      published: true,
      sort_order: 20,
      links: [
        {
          id: 'hidden-source',
          label: 'Old source',
          url: 'https://example.com/source',
          manager_note: 'Manager only',
          active: false,
        },
        {
          id: 'tutorial',
          label: 'Tutorial',
          url: 'https://example.com/tutorial',
          note: 'Host-safe link',
          manager_note: 'Check this again next season',
          active: true,
        },
      ],
    },
    {
      id: 'first',
      category: 'Prepare',
      title: 'Interview',
      summary: 'Prepare open questions',
      body: 'Listen more than you talk.',
      published: false,
      sort_order: 10,
      links: [],
    },
  ],
  manager_notes: ['Replace old links'],
};

test('orders normalized guide sections by display order', () => {
  const guide = normalizeStudioGuide(sampleGuide);
  assert.deepEqual(
    guide.sections.map((section) => section.id),
    ['first', 'second']
  );
});

test('keeps an explicit schema version for stored guide migrations', () => {
  assert.equal(normalizeStudioGuide(sampleGuide).schema_version, 1);
  assert.equal(
    normalizeStudioGuide({ ...sampleGuide, schema_version: 3 }).schema_version,
    3
  );
});

test('hides draft sections, inactive links, and manager notes from hosts', () => {
  const guide = sanitizeStudioGuideForHosts(sampleGuide);

  assert.deepEqual(
    guide.sections.map((section) => section.id),
    ['second']
  );
  assert.deepEqual(
    guide.sections[0].links.map((link) => link.id),
    ['tutorial']
  );
  assert.equal(guide.sections[0].links[0].manager_note, undefined);
  assert.equal(guide.sections[0].links[0].note, 'Host-safe link');
  assert.deepEqual(guide.manager_notes, []);
});

test('search text includes body, category, summary, and active link labels', () => {
  const text = studioGuideSearchText(sampleGuide.sections[0]);
  assert.match(text, /record/);
  assert.match(text, /microphone setup/);
  assert.match(text, /wear headphones/);
  assert.match(text, /tutorial/);
});

test('rejects unsafe resource URLs before publishing', () => {
  const unsafeGuide = structuredClone(sampleGuide);
  unsafeGuide.sections[0].links[0].url = 'javascript:alert(1)';

  assert.throws(
    () => validateStudioGuide(unsafeGuide),
    /must use HTTPS or a site-relative path/
  );
});

test('never exposes an unsafe legacy or draft link to hosts', () => {
  const unsafeGuide = structuredClone(sampleGuide);
  unsafeGuide.sections[0].links[1].url = 'javascript:alert(1)';

  const hostGuide = sanitizeStudioGuideForHosts(unsafeGuide);
  assert.deepEqual(hostGuide.sections[0].links, []);
});

test('requires unique section IDs', () => {
  const duplicateGuide = structuredClone(sampleGuide);
  duplicateGuide.sections[1].id = 'second';

  assert.throws(
    () => validateStudioGuide(duplicateGuide),
    /duplicate section ID/
  );
});
