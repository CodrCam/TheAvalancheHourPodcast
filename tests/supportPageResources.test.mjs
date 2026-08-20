import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const supportPagePath = new URL('../pages/support.js', import.meta.url);
const sponsorshipGuidePath = new URL(
  '../public/files/avalanche-hour-s11-sponsorship-guide.pdf',
  import.meta.url
);
const rateCardPath = new URL(
  '../public/files/avalanche-hour-s11-rate-card.pdf',
  import.meta.url
);

test('support page presents the detailed guide and concise rate card as distinct resources', async () => {
  const source = await readFile(supportPagePath, 'utf8');

  assert.match(
    source,
    /const sponsorshipGuideUrl = '\/files\/avalanche-hour-s11-sponsorship-guide\.pdf';/
  );
  assert.match(
    source,
    /const rateCardUrl = '\/files\/avalanche-hour-s11-rate-card\.pdf';/
  );
  assert.match(source, />\s*View Sponsorship Guide\s*</);
  assert.match(source, />\s*See Rates at a Glance\s*</);
  assert.match(source, /href="#support-options"[\s\S]*?>\s*Choose a Support Level\s*</);
  assert.match(source, /id="support-options"/);
  assert.match(
    source,
    /href=\{sponsorshipGuideUrl\}[\s\S]*?target="_blank"[\s\S]*?rel="noopener noreferrer"/
  );
  assert.match(
    source,
    /href=\{rateCardUrl\}[\s\S]*?target="_blank"[\s\S]*?rel="noopener noreferrer"/
  );
  assert.doesNotMatch(source, />\s*Download PDF\s*</);
});

test('support tiers match Caleb’s authoritative package pricing and use specific actions', async () => {
  const source = await readFile(supportPagePath, 'utf8');

  assert.match(source, /price: '\$4,000 \/ season'/);
  assert.match(source, /price: '\$6,000 \/ season'/);
  assert.match(source, /price: '\$5,000\+ \/ season'/);
  assert.doesNotMatch(source, /price: '\$6,000\+ \/ season'/);
  assert.match(source, /ctaLabel: 'Sponsor an Episode'/);
  assert.match(source, /ctaLabel: 'Become a Season Partner'/);
  assert.match(source, /ctaLabel: 'Choose Legacy Support'/);
  assert.match(source, /ctaLabel: 'Support Slabs ’n Sluffs'/);
  assert.match(source, /checkout opens in a new tab/);
});

test('both linked resource files are valid PDFs', async () => {
  for (const resourcePath of [sponsorshipGuidePath, rateCardPath]) {
    const resource = await readFile(resourcePath);
    assert.equal(resource.subarray(0, 5).toString('ascii'), '%PDF-');
  }
});
