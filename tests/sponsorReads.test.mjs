import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSponsorReadOperationalState,
  isSponsorReadAssignable,
  normalizeSponsorRead,
  sponsorReadVersionSnapshot,
  validateSponsorRead,
} from '../lib/sponsorReadPresentation.mjs';

function sampleRead() {
  return {
    sponsor_read_id: 'sponsor-read-one',
    sponsor_id: 'sponsor-one',
    sponsor_name: 'Sponsor One',
    script_title: 'Summer read',
    approved_text: 'This is the exact approved language.',
    state: 'approved',
    effective_date: '2026-07-01',
    expiration_date: '2026-08-01',
    version_number: 2,
  };
}

test('approved sponsor reads are assignable only inside their date window', () => {
  assert.equal(isSponsorReadAssignable(sampleRead(), '2026-07-25'), true);
  assert.equal(isSponsorReadAssignable(sampleRead(), '2026-06-25'), false);
  assert.equal(
    getSponsorReadOperationalState(sampleRead(), '2026-08-02'),
    'expired'
  );
});

test('sponsor read snapshots freeze exact versioned language and attribution', () => {
  const read = validateSponsorRead(normalizeSponsorRead(sampleRead()));
  const snapshot = sponsorReadVersionSnapshot(read, {
    person_id: 'producer-1',
    name: 'Producer One',
    at: '2026-07-25T12:00:00.000Z',
  });
  assert.equal(snapshot.version_number, 2);
  assert.equal(snapshot.approved_text, read.approved_text);
  assert.equal(snapshot.attributed_to_person_id, 'producer-1');
});
