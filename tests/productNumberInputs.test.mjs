import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatProductPriceInput,
  isProductPriceInput,
  isProductStockInput,
  productPriceInputToCents,
  productStockInputToQuantity,
} from '../lib/productNumberInputs.mjs';

test('accepts normal dollar entry and limits price precision', () => {
  for (const value of ['', '.', '1', '1.', '1.2', '1.25', '10000.00']) {
    assert.equal(isProductPriceInput(value), true, value);
  }
  for (const value of ['-1', '1.234', '1..2', '$12', '10000.01']) {
    assert.equal(isProductPriceInput(value), false, value);
  }
});

test('converts dollar entry to integer cents and formats saved prices', () => {
  assert.equal(productPriceInputToCents('1'), 100);
  assert.equal(productPriceInputToCents('1.2'), 120);
  assert.equal(productPriceInputToCents('1.25'), 125);
  assert.equal(productPriceInputToCents(''), null);
  assert.equal(formatProductPriceInput(125), '1.25');
});

test('allows stock to be cleared and replaced with a whole number', () => {
  assert.equal(isProductStockInput(''), true);
  assert.equal(isProductStockInput('020'), true);
  assert.equal(isProductStockInput('20.5'), false);
  assert.equal(isProductStockInput('-2'), false);
  assert.equal(productStockInputToQuantity(''), null);
  assert.equal(productStockInputToQuantity('020'), 20);
});
