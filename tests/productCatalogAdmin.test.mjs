import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeCatalogProductInput,
  slugifyProduct,
  validateProductForPublication,
} from '../lib/productCatalogAdmin.mjs';
import {
  resolveCheckoutItems,
  resolveRecordedOrderItems,
} from '../lib/catalogCheckout.js';
import { getProductSkuEntries, getSkuForOptions } from '../lib/productCatalog.js';
import {
  buildCatalogInventoryTransactItems,
} from '../lib/inventoryStore.js';
import {
  buildCatalogSeedItems,
  catalogProductFromItems,
} from '../lib/productCatalogStore.js';
import {
  getProductMediaForSku,
  groupProductsByTaxonomy,
} from '../lib/productCatalogStructure.mjs';
import { products as staticProducts } from '../src/data/products.js';

function managedProduct(overrides = {}) {
  return {
    id: 'product-field-shirt',
    slug: 'field-shirt',
    name: 'Field Shirt',
    category: 'Apparel',
    collection: 'Field layers',
    label: 'Snow study uniform',
    description: 'A durable field shirt that supports the podcast.',
    status: 'live',
    price: 4200,
    sortOrder: 2,
    media: [
      {
        assetId: 'image-one',
        source: 's3',
        objectKey: 'products/product-field-shirt/image-one-shirt.webp',
        altText: 'Field Shirt',
        assignedSkus: ['field-shirt-blue-m'],
      },
    ],
    skuEntries: [
      {
        sku: 'field-shirt-blue-m',
        label: 'Blue / Medium',
        options: { color: 'Blue', size: 'M' },
        price: 4200,
        image:
          '/api/store/product-image?key=products%2Fproduct-field-shirt%2Fimage-one-shirt.webp',
        quantity: 5,
        hidden: false,
        active: true,
      },
    ],
    ...overrides,
  };
}

test('normalizes a complete managed product and preserves inventory inputs', () => {
  const product = normalizeCatalogProductInput(
    managedProduct({
      skuEntries: [
        {
          ...managedProduct().skuEntries[0],
          inventoryUpdatedAt: '2026-07-25T20:00:00.000Z',
        },
      ],
    })
  );

  assert.equal(product.slug, 'field-shirt');
  assert.equal(product.label, 'Snow study uniform');
  assert.equal(product.category, 'Apparel');
  assert.equal(product.collection, 'Field layers');
  assert.deepEqual(product.colors, ['Blue']);
  assert.deepEqual(product.sizes, ['M']);
  assert.equal(product.skuEntries[0].quantity, 5);
  assert.equal(
    product.skuEntries[0].inventoryUpdatedAt,
    '2026-07-25T20:00:00.000Z'
  );
  assert.equal(
    product.image,
    '/api/store/product-image?key=products%2Fproduct-field-shirt%2Fimage-one-shirt.webp'
  );
  assert.deepEqual(validateProductForPublication(product), []);
});

test('does not rewrite inventory when a product-only edit keeps stock unchanged', () => {
  const product = normalizeCatalogProductInput(
    managedProduct({
      description: 'Updated storefront copy.',
      skuEntries: [
        {
          ...managedProduct().skuEntries[0],
          inventoryUpdatedAt: '2026-07-25T20:00:00.000Z',
        },
      ],
    })
  );
  const rows = [
    {
      sku: 'field-shirt-blue-m',
      name: 'Blue / Medium',
      quantity: 5,
      hidden: false,
      updated_at: '2026-07-25T20:00:00.000Z',
    },
  ];

  assert.deepEqual(
    buildCatalogInventoryTransactItems(product, managedProduct(), rows, {
      tableName: 'Inventory',
      updatedAt: '2026-07-25T21:00:00.000Z',
    }),
    []
  );
});

test('rejects stale product-editor stock instead of overwriting a newer count', () => {
  const product = normalizeCatalogProductInput(
    managedProduct({
      skuEntries: [
        {
          ...managedProduct().skuEntries[0],
          quantity: 5,
          inventoryUpdatedAt: '2026-07-25T20:00:00.000Z',
        },
      ],
    })
  );
  const rows = [
    {
      sku: 'field-shirt-blue-m',
      name: 'Blue / Medium',
      quantity: 4,
      hidden: false,
      updated_at: '2026-07-25T20:30:00.000Z',
    },
  ];

  assert.throws(
    () =>
      buildCatalogInventoryTransactItems(product, managedProduct(), rows, {
        tableName: 'Inventory',
        updatedAt: '2026-07-25T21:00:00.000Z',
      }),
    /Inventory changed.*Refresh/i
  );
});

test('adds intentional stock changes to the same transaction as the product save', () => {
  const product = normalizeCatalogProductInput(
    managedProduct({
      skuEntries: [
        {
          ...managedProduct().skuEntries[0],
          quantity: 7,
          inventoryUpdatedAt: '2026-07-25T20:00:00.000Z',
        },
      ],
    })
  );
  const rows = [
    {
      sku: 'field-shirt-blue-m',
      name: 'Blue / Medium',
      quantity: 5,
      hidden: false,
      updated_at: '2026-07-25T20:00:00.000Z',
    },
  ];

  const [transaction] = buildCatalogInventoryTransactItems(
    product,
    managedProduct(),
    rows,
    {
      tableName: 'Inventory',
      updatedAt: '2026-07-25T21:00:00.000Z',
    }
  );

  assert.equal(transaction.Update.TableName, 'Inventory');
  assert.equal(
    transaction.Update.ExpressionAttributeValues[':quantity'].N,
    '7'
  );
  assert.equal(
    transaction.Update.ExpressionAttributeValues[':expected_updated_at'].S,
    '2026-07-25T20:00:00.000Z'
  );
  assert.match(transaction.Update.ConditionExpression, /#updated_at/);
});

test('keeps draft products saveable while enforcing live product completeness', () => {
  const draft = normalizeCatalogProductInput(
    managedProduct({
      status: 'draft',
      description: '',
      media: [],
      skuEntries: [{ sku: 'draft-sku', price: 0 }],
    })
  );
  assert.equal(draft.status, 'draft');
  assert.throws(
    () =>
      normalizeCatalogProductInput({
        ...draft,
        status: 'live',
      }),
    /description.*image.*price/i
  );
});

test('accepts HTTPS product media while rejecting insecure and cross-product sources', () => {
  assert.doesNotThrow(() =>
    normalizeCatalogProductInput(
      managedProduct({
        status: 'draft',
        media: [
          {
            assetId: 'remote-image',
            source: 'remote',
            objectKey: 'https://images.example.com/field-shirt.jpg',
          },
        ],
      })
    )
  );
  assert.throws(
    () =>
      normalizeCatalogProductInput(
        managedProduct({
          status: 'draft',
          media: [
            {
              assetId: 'remote-image',
              source: 'remote',
              objectKey: 'http://images.example.com/field-shirt.jpg',
            },
          ],
        })
      ),
    /complete HTTPS URL/i
  );
  assert.throws(
    () =>
      normalizeCatalogProductInput(
        managedProduct({
          status: 'draft',
          media: [
            {
              assetId: 'wrong-product',
              source: 's3',
              objectKey: 'products/another-product/image.jpg',
            },
          ],
        })
      ),
    /belong to this product/i
  );
});

test('rejects duplicate SKUs and produces stable storefront slugs', () => {
  assert.equal(slugifyProduct('  Snow & Wind Slab Tee  '), 'snow-wind-slab-tee');
  assert.throws(
    () =>
      normalizeCatalogProductInput(
        managedProduct({
          status: 'draft',
          skuEntries: [
            { sku: 'same-sku', price: 1000 },
            { sku: 'SAME-SKU', price: 1200 },
          ],
        })
      ),
    /more than once/i
  );
});

test('uses explicit managed SKU entries for storefront selection', () => {
  const product = normalizeCatalogProductInput(managedProduct());
  const entries = getProductSkuEntries(product);

  assert.equal(entries.length, 1);
  assert.equal(
    getSkuForOptions(product, { color: 'Blue', size: 'M' }),
    'field-shirt-blue-m'
  );
  assert.equal(entries[0].price, 4200);
});

test('round-trips managed labels, S3 media, prices, and inventory-facing SKUs', () => {
  const product = normalizeCatalogProductInput(managedProduct());
  const records = buildCatalogSeedItems(
    { ...product, version: 4 },
    product.skuEntries,
    product.sortOrder
  );
  const restored = catalogProductFromItems([
    records.meta,
    ...records.variants,
    ...records.media,
  ]);

  assert.equal(restored.version, 4);
  assert.equal(restored.label, 'Snow study uniform');
  assert.equal(restored.category, 'Apparel');
  assert.equal(restored.collection, 'Field layers');
  assert.equal(restored.skuEntries[0].price, 4200);
  assert.deepEqual(restored.media[0].assignedSkus, ['field-shirt-blue-m']);
  assert.equal(restored.media[0].source, 's3');
  assert.equal(restored.image, product.image);
  assert.deepEqual(restored.optionLabels, {
    style: 'Style',
    color: 'Color',
    size: 'Size',
  });
});

test('keeps each legacy hat gallery limited to the selected SKU', () => {
  const hats = staticProducts.find(
    (product) => product.id === 'avalanche-hour-hats'
  );

  assert.deepEqual(getProductMediaForSku(hats, 'ah-hat-blue'), [
    '/images/store/caps/Blue_Cap.jpg',
    '/images/store/caps/Blue_Cap2.jpg',
  ]);
  assert.deepEqual(getProductMediaForSku(hats, 'ah-hat-rust-rope'), [
    '/images/store/caps/rust_rope2.JPG',
    '/images/store/caps/rust_rope1.JPG',
  ]);
});

test('groups products as category, collection, product line, then SKU variants', () => {
  const groups = groupProductsByTaxonomy(
    staticProducts.filter((product) =>
      ['avalanche-hour-hats', 'recaps-caps', 'recaps-beanies'].includes(
        product.id
      )
    )
  );

  assert.equal(groups[0].category, 'Headwear');
  assert.deepEqual(
    groups[0].collections.map((collection) => ({
      collection: collection.collection,
      products: collection.products.map((product) => product.id),
    })),
    [
      {
        collection: 'Avalanche Hour',
        products: ['avalanche-hour-hats'],
      },
      {
        collection: 'ReCaps',
        products: ['recaps-caps', 'recaps-beanies'],
      },
    ]
  );
});

test('round-trips the chosen customer-first variant order', () => {
  const product = managedProduct({
    status: 'draft',
    skuEntries: [
      {
        sku: 'field-shirt-red-l',
        label: 'Red / Large',
        options: { color: 'Red', size: 'L' },
        price: 4400,
        image: '/images/red-shirt.jpg',
      },
      {
        sku: 'field-shirt-blue-m',
        label: 'Blue / Medium',
        options: { color: 'Blue', size: 'M' },
        price: 4200,
        image: '/images/blue-shirt.jpg',
      },
    ],
  });
  const records = buildCatalogSeedItems(
    product,
    product.skuEntries,
    product.sortOrder
  );
  const restored = catalogProductFromItems([
    records.meta,
    ...records.variants,
    ...records.media,
  ]);

  assert.deepEqual(
    restored.skuEntries.map((entry) => entry.sku),
    ['field-shirt-red-l', 'field-shirt-blue-m']
  );
});

test('checkout uses the catalog SKU and price instead of browser values', async () => {
  const product = normalizeCatalogProductInput(managedProduct());
  const items = await resolveCheckoutItems(
    [
      {
        id: product.id,
        sku: 'field-shirt-blue-m',
        price: 1,
        qty: 2,
        options: { color: 'Wrong browser value' },
      },
    ],
    { products: [product] }
  );

  assert.deepEqual(items, [
    {
      id: product.id,
      sku: 'field-shirt-blue-m',
      name: 'Field Shirt',
      price: 4200,
      qty: 2,
      options: { color: 'Blue', size: 'M' },
    },
  ]);
});

test('checkout refuses backend-only products', async () => {
  const product = normalizeCatalogProductInput(
    managedProduct({ status: 'standby' })
  );

  await assert.rejects(
    resolveCheckoutItems(
      [{ id: product.id, sku: 'field-shirt-blue-m', qty: 1 }],
      { products: [product] }
    ),
    /no longer available/i
  );
});

test('checkout does not resurrect the static catalog in production', async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousProductsTable = process.env.DYNAMODB_PRODUCTS_TABLE;
  const fallbackProduct = staticProducts[0];
  const fallbackEntry = getProductSkuEntries(fallbackProduct)[0];

  process.env.NODE_ENV = 'production';
  delete process.env.DYNAMODB_PRODUCTS_TABLE;

  try {
    await assert.rejects(
      resolveCheckoutItems([
        {
          id: fallbackProduct.id,
          sku: fallbackEntry.sku,
          qty: 1,
        },
      ]),
      /no longer available/i
    );
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
    if (previousProductsTable === undefined) {
      delete process.env.DYNAMODB_PRODUCTS_TABLE;
    } else {
      process.env.DYNAMODB_PRODUCTS_TABLE = previousProductsTable;
    }
  }
});

test('reconstructs fulfillment lines from the server catalog instead of browser copy', async () => {
  const product = normalizeCatalogProductInput(managedProduct());
  const items = await resolveRecordedOrderItems(
    [
      {
        sku: 'field-shirt-blue-m',
        qty: 2,
        name: 'Browser-forged name',
        options: { color: 'Forged color' },
      },
    ],
    { products: [product] }
  );

  assert.deepEqual(items, [
    {
      id: 'product-field-shirt',
      sku: 'field-shirt-blue-m',
      qty: 2,
      name: 'Field Shirt',
      price: 4200,
      options: { color: 'Blue', size: 'M' },
      image:
        '/api/store/product-image?key=products%2Fproduct-field-shirt%2Fimage-one-shirt.webp',
    },
  ]);
});
