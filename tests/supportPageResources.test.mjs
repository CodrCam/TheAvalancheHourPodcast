import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const supportPagePath = new URL('../pages/support.js', import.meta.url);
const yearRoundPartnershipDeckPath = new URL(
  '../public/files/avalanche-hour-season-11-partnership-deck.pdf',
  import.meta.url
);
const season11SponsorshipDeckPath = new URL(
  '../public/files/avalanche-hour-s11-sponsorship-deck.pdf',
  import.meta.url
);

const oldRateCardPath = new URL(
  '../public/files/avalanche-hour-s11-rate-card.pdf',
  import.meta.url
);
const replacedGuidePath = new URL(
  '../public/files/avalanche-hour-s11-sponsorship-guide.pdf',
  import.meta.url
);

test('support page presents the Season 11 and year-round partnership decks as distinct resources', async () => {
  const source = await readFile(supportPagePath, 'utf8');

  assert.match(
    source,
    /const yearRoundPartnershipDeckUrl = '\/files\/avalanche-hour-season-11-partnership-deck\.pdf';/
  );
  assert.match(
    source,
    /const season11SponsorshipDeckUrl = '\/files\/avalanche-hour-s11-sponsorship-deck\.pdf';/
  );
  assert.match(source, />\s*View Season 11 Sponsorship Deck\s*</);
  assert.match(source, />\s*View Year-Round Partnership Deck\s*</);
  assert.match(source, /href="#support-options"[\s\S]*?>\s*Choose a Support Level\s*</);
  assert.match(source, /id="support-options"/);
  assert.match(
    source,
    /href=\{season11SponsorshipDeckUrl\}[\s\S]*?target="_blank"[\s\S]*?rel="noopener noreferrer"/
  );
  assert.match(
    source,
    /href=\{yearRoundPartnershipDeckUrl\}[\s\S]*?target="_blank"[\s\S]*?rel="noopener noreferrer"/
  );
  assert.doesNotMatch(source, /sponsorshipGuideUrl/);
  assert.doesNotMatch(source, /Expanded Sponsorship Guide/);
  assert.doesNotMatch(source, /rateCardUrl/);
  assert.doesNotMatch(source, /Rates at a Glance/);
  assert.doesNotMatch(source, /avalanche-hour-s11-rate-card\.pdf/);
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

test('both linked resource files are valid PDFs and retired files are absent', async () => {
  for (const resourcePath of [season11SponsorshipDeckPath, yearRoundPartnershipDeckPath]) {
    const resource = await readFile(resourcePath);
    assert.equal(resource.subarray(0, 5).toString('ascii'), '%PDF-');
  }

  await assert.rejects(access(oldRateCardPath), { code: 'ENOENT' });
  await assert.rejects(access(replacedGuidePath), { code: 'ENOENT' });
});
