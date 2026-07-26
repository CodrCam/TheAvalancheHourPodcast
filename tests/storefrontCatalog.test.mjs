import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadStorefrontCatalog,
  loadStorefrontProduct,
} from '../lib/storefrontCatalog.mjs';

const fallbackProducts = [
  {
    id: 'fallback-live',
    slug: 'fallback-live',
    name: 'Fallback Live',
    status: 'live',
  },
  {
    id: 'fallback-standby',
    slug: 'fallback-standby',
    name: 'Fallback Standby',
    status: 'standby',
  },
];

const silentLogger = { error() {} };

test('uses DynamoDB as the configured storefront catalog source', async () => {
  const result = await loadStorefrontCatalog({
    configured: true,
    fallbackProducts,
    listProducts: async () => [
      {
        id: 'dynamo-live',
        slug: 'dynamo-live',
        name: 'Dynamo Live',
        status: 'live',
      },
      {
        id: 'dynamo-draft',
        slug: 'dynamo-draft',
        name: 'Dynamo Draft',
        status: 'draft',
      },
    ],
  });

  assert.equal(result.source, 'dynamodb');
  assert.deepEqual(
    result.products.map((product) => product.id),
    ['dynamo-live']
  );
});

test('treats an empty DynamoDB catalog as intentional', async () => {
  const result = await loadStorefrontCatalog({
    configured: true,
    fallbackProducts,
    listProducts: async () => [],
  });

  assert.equal(result.source, 'dynamodb');
  assert.deepEqual(result.products, []);
});

test('uses the temporary static fallback only when a catalog read fails', async () => {
  const result = await loadStorefrontCatalog({
    configured: true,
    fallbackProducts,
    listProducts: async () => {
      throw new Error('temporary outage');
    },
    logger: silentLogger,
    allowStaticFallback: true,
  });

  assert.equal(result.source, 'static-fallback');
  assert.deepEqual(
    result.products.map((product) => product.id),
    ['fallback-live']
  );
});

test('fails closed instead of resurrecting static products in production', async () => {
  const result = await loadStorefrontCatalog({
    configured: true,
    fallbackProducts,
    listProducts: async () => {
      throw new Error('temporary outage');
    },
    logger: silentLogger,
    allowStaticFallback: false,
  });

  assert.equal(result.source, 'dynamodb-unavailable');
  assert.deepEqual(result.products, []);
});

test('does not resurrect a backend-only product through the static fallback', async () => {
  const result = await loadStorefrontProduct('fallback-live', {
    configured: true,
    fallbackProducts,
    getProductBySlug: async () => null,
  });

  assert.equal(result.source, 'dynamodb');
  assert.equal(result.product, null);
});

test('loads a static product when DynamoDB is not configured', async () => {
  const result = await loadStorefrontProduct('fallback-live', {
    configured: false,
    fallbackProducts,
    allowStaticFallback: true,
  });

  assert.equal(result.source, 'static-unconfigured');
  assert.equal(result.product?.id, 'fallback-live');
});

test('does not expose static products when production DynamoDB is unconfigured', async () => {
  const result = await loadStorefrontProduct('fallback-live', {
    configured: false,
    fallbackProducts,
    allowStaticFallback: false,
  });

  assert.equal(result.source, 'dynamodb-unconfigured');
  assert.equal(result.product, null);
});
