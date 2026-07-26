import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyStoreDiscount,
  isStoreDiscountCode,
  normalizeStoreDiscountCode,
} from '../lib/storeDiscounts.mjs';

test('normalizes and recognizes store discount codes', () => {
  assert.equal(normalizeStoreDiscountCode('  tahfriends '), 'TAHFRIENDS');
  assert.equal(isStoreDiscountCode('tahfriends'), true);
  assert.equal(isStoreDiscountCode('not-a-code'), false);
});

test('applies the friends discount without waiving shipping', () => {
  assert.deepEqual(applyStoreDiscount(10000, 'TAHFRIENDS'), {
    subtotalAfterDiscount: 8500,
    discountAmountCents: 1500,
    discountCode: 'TAHFRIENDS',
    shippingWaived: false,
  });
});

test('keeps the host discount and its existing shipping waiver', () => {
  assert.deepEqual(applyStoreDiscount(10000, 's10host40'), {
    subtotalAfterDiscount: 6000,
    discountAmountCents: 4000,
    discountCode: 'S10HOST40',
    shippingWaived: true,
  });
});

test('recognizes ISSWPICKUP as a shipping-only discount', () => {
  assert.deepEqual(applyStoreDiscount(10000, ' isswpickup '), {
    subtotalAfterDiscount: 10000,
    discountAmountCents: 0,
    discountCode: 'ISSWPICKUP',
    shippingWaived: true,
  });
});

test('does not apply unknown codes', () => {
  assert.deepEqual(applyStoreDiscount(10000, 'unknown'), {
    subtotalAfterDiscount: 10000,
    discountAmountCents: 0,
    discountCode: null,
    shippingWaived: false,
  });
});
