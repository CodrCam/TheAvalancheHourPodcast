import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStudioGuide,
  sanitizeStudioGuideForHosts,
  studioGuideSearchText,
  validateStudioGuide,
} from '../lib/studioGuidePresentation.mjs';
import { DEFAULT_STUDIO_GUIDE } from '../lib/studioGuideDefaults.js';

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

test('default host manual is durable, complete, and valid', () => {
  const guide = validateStudioGuide(DEFAULT_STUDIO_GUIDE);
  const sectionIds = guide.sections.map((section) => section.id);
  const serialized = JSON.stringify(guide);

  assert.equal(guide.schema_version, 2);
  assert.equal(guide.title, 'The Avalanche Hour Host Field Manual');
  assert.equal(guide.announcement.enabled, false);
  assert.equal(sectionIds.includes('training-and-schedule'), false);
  assert.equal(sectionIds.includes('riverside-structure-and-scheduling'), true);
  assert.equal(sectionIds.includes('riverside-lobby-and-test'), true);
  assert.equal(sectionIds.includes('riverside-upload-and-recovery'), true);
  assert.equal(sectionIds.includes('riverside-download'), true);
  assert.equal(serialized.includes('August 5, 2026'), false);
  assert.equal(
    serialized.includes('people with a curious fascination with avalanches'),
    true
  );
});

test('Riverside manual sections use active official references', () => {
  const guide = sanitizeStudioGuideForHosts(DEFAULT_STUDIO_GUIDE);
  const riversideSections = guide.sections.filter(
    (section) => section.category === 'Riverside'
  );
  const links = riversideSections.flatMap((section) => section.links);

  assert.ok(riversideSections.length >= 6);
  assert.ok(links.length >= 10);
  assert.equal(
    links.every(
      (link) =>
        link.active === true &&
        (link.url.startsWith('https://support.riverside.com/') ||
          link.url.startsWith('https://riverside.com/'))
    ),
    true
  );
});
