import test from 'node:test';
import assert from 'node:assert/strict';
import {
  authorizeGuestQuestionnaireUploadBudget,
  GUEST_UPLOAD_MAX_AUTHORIZED_BYTES_PER_LINK,
  GUEST_UPLOAD_MAX_GRANTS_PER_LINK,
  normalizeGuestQuestionnaireUploadBudget,
  resetGuestQuestionnaireUploadBudget,
} from '../lib/guestQuestionnaireUploadBudget.mjs';

const LINK_A = 'a'.repeat(64);
const LINK_B = 'b'.repeat(64);

test('guest upload budget is durable, bounded by count and bytes, and resets for a new link', () => {
  let budget = resetGuestQuestionnaireUploadBudget(LINK_A);
  const first = authorizeGuestQuestionnaireUploadBudget(budget, {
    linkTokenHash: LINK_A,
    sizeBytes: 1024,
    now: new Date('2026-08-04T12:00:00.000Z'),
  });
  assert.equal(first.allowed, true);
  assert.equal(first.budget.issued_count, 1);
  assert.equal(first.budget.issued_bytes, 1024);
  budget = first.budget;

  const countExhausted = authorizeGuestQuestionnaireUploadBudget(
    {
      ...budget,
      issued_count: GUEST_UPLOAD_MAX_GRANTS_PER_LINK,
    },
    { linkTokenHash: LINK_A, sizeBytes: 1 }
  );
  assert.equal(countExhausted.allowed, false);
  assert.match(countExhausted.reason, /refreshed link/i);

  const bytesExhausted = authorizeGuestQuestionnaireUploadBudget(
    {
      ...budget,
      issued_bytes: GUEST_UPLOAD_MAX_AUTHORIZED_BYTES_PER_LINK - 5,
    },
    { linkTokenHash: LINK_A, sizeBytes: 6 }
  );
  assert.equal(bytesExhausted.allowed, false);

  const refreshed = authorizeGuestQuestionnaireUploadBudget(budget, {
    linkTokenHash: LINK_B,
    sizeBytes: 2048,
  });
  assert.equal(refreshed.allowed, true);
  assert.equal(refreshed.budget.link_token_hash, LINK_B);
  assert.equal(refreshed.budget.issued_count, 1);
  assert.equal(refreshed.budget.issued_bytes, 2048);
});

test('guest upload budget normalization never preserves invalid or oversized values', () => {
  assert.deepEqual(
    normalizeGuestQuestionnaireUploadBudget({
      link_token_hash: 'not-a-link-hash',
      issued_count: 999,
      issued_bytes: Number.MAX_SAFE_INTEGER,
      updated_at: 'not-a-date',
    }),
    {
      link_token_hash: '',
      issued_count: GUEST_UPLOAD_MAX_GRANTS_PER_LINK,
      issued_bytes: GUEST_UPLOAD_MAX_AUTHORIZED_BYTES_PER_LINK,
      updated_at: '',
    }
  );
});
