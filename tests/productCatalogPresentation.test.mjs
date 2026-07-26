import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PRODUCT_CATALOG_STATUSES,
  getProductInventorySummary,
  getProductStorefrontState,
  isProductVisibleOnStorefront,
  normalizeProductCatalogStatus,
} from '../lib/productCatalogPresentation.mjs';
import {
  buildCatalogSeedItems,
  catalogProductFromItems,
} from '../lib/productCatalogStore.js';
import { getProductSkuEntries } from '../lib/productCatalog.js';
import { products } from '../src/data/products.js';

test('keeps catalog state separate from inventory quantity', () => {
  const product = { id: 'restock-me', active: true, status: 'live' };
  const state = getProductStorefrontState(
    product,
    ['restock-me-small', 'restock-me-large'],
    {
      'restock-me-small': { quantity: 0, hidden: false },
      'restock-me-large': { quantity: 0, hidden: false },
    }
  );

  assert.equal(state.catalogVisible, true);
  assert.equal(state.isStandby, false);
  assert.equal(state.isSoldOut, true);
  assert.equal(state.isAvailable, false);
});

test('treats standby as an intentional backend-only state', () => {
  const catalogStandby = getProductStorefrontState(
    { id: 'seasonal', active: true, status: 'standby' },
    ['seasonal'],
    { seasonal: { quantity: 12, hidden: false } }
  );
  const inventoryStandby = getProductInventorySummary(
    ['old-small', 'old-large'],
    {
      'old-small': { quantity: 0, hidden: true },
      'old-large': { quantity: 4, hidden: true },
    }
  );

  assert.equal(catalogStandby.isStandby, true);
  assert.equal(catalogStandby.isSoldOut, false);
  assert.equal(inventoryStandby.isStandby, true);
  assert.equal(inventoryStandby.availableQuantity, 0);
});

test('does not hide a product just because an inventory row is missing', () => {
  const summary = getProductInventorySummary(
    ['configured-sku', 'new-sku'],
    {
      'configured-sku': { quantity: 0, hidden: false },
    }
  );

  assert.equal(summary.listedSkuCount, 2);
  assert.equal(summary.isStandby, false);
  assert.equal(summary.isSoldOut, true);
});

test('normalizes legacy active flags into live and standby states', () => {
  assert.equal(
    normalizeProductCatalogStatus('', true),
    PRODUCT_CATALOG_STATUSES.LIVE
  );
  assert.equal(
    normalizeProductCatalogStatus('', false),
    PRODUCT_CATALOG_STATUSES.STANDBY
  );
  assert.equal(isProductVisibleOnStorefront({ active: true }), true);
  assert.equal(isProductVisibleOnStorefront({ active: false }), false);
  assert.equal(
    isProductVisibleOnStorefront({ active: true, status: 'draft' }),
    false
  );
});

test('builds product, variant, media, and slug records for DynamoDB', () => {
  const product = products.find(
    (candidate) => candidate.id === 'avalanche-hour-hats'
  );
  const entries = getProductSkuEntries(product);
  const records = buildCatalogSeedItems(product, entries, 3);

  assert.equal(records.meta.product_id.S, product.id);
  assert.equal(records.meta.status.S, PRODUCT_CATALOG_STATUSES.LIVE);
  assert.equal(records.meta.gsi1pk.S, 'CATALOG#PRODUCTS');
  assert.equal(records.variants.length, entries.length);
  assert.equal(records.media.length, product.images.length);
  assert.equal(records.slugLookup.product_id.S, product.id);
  assert.equal(records.variants[0].pk.S, `PRODUCT#${product.id}`);

  const restored = catalogProductFromItems([
    records.meta,
    ...records.variants,
    ...records.media,
  ]);
  assert.equal(restored.id, product.id);
  assert.equal(restored.slug, product.slug);
  assert.deepEqual(restored.images, product.images);
  assert.equal(
    restored.variants['Black Camo'].skuByColor['Black Camo'],
    'ah-hat-black-camo'
  );
  assert.equal(restored.media[0].shared, false);
});

test('keeps legacy catalog media serializable when shared is missing', () => {
  const product = products.find(
    (candidate) => candidate.id === 'avalanche-hour-hats'
  );
  const entries = getProductSkuEntries(product);
  const records = buildCatalogSeedItems(product, entries, 3);
  const legacyMedia = structuredClone(records.media[0]);
  delete legacyMedia.shared;

  const restored = catalogProductFromItems([
    records.meta,
    ...records.variants,
    legacyMedia,
  ]);

  assert.equal(restored.media[0].shared, false);
  assert.doesNotMatch(JSON.stringify(restored), /undefined/);
});
