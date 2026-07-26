import {
  dynamoDbRequest,
  isDynamoCredentialsConfigured,
} from './dynamoDb.js';
import {
  PRODUCT_CATALOG_STATUSES,
  isProductVisibleOnStorefront,
  normalizeProductCatalogStatus,
} from './productCatalogPresentation.mjs';
import {
  getProductOptionLabels,
  getProductTaxonomy,
  inferMediaAssignedSkus,
} from './productCatalogStructure.mjs';

const CATALOG_INDEX_NAME = 'catalog-index';
const CATALOG_INDEX_PARTITION = 'CATALOG#PRODUCTS';

function getProductsTableName() {
  return String(process.env.DYNAMODB_PRODUCTS_TABLE || '').trim();
}

export function isDynamoProductCatalogConfigured() {
  return Boolean(getProductsTableName());
}

function assertDynamoProductCatalogReady() {
  if (!isDynamoProductCatalogConfigured()) {
    throw new Error('DYNAMODB_PRODUCTS_TABLE is not configured on the server');
  }
  if (!isDynamoCredentialsConfigured()) {
    throw new Error('AWS credentials are not configured for DynamoDB');
  }
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return parsed === null || parsed === undefined ? fallback : parsed;
  } catch {
    return fallback;
  }
}

function stringValue(item, key) {
  return String(item?.[key]?.S || '');
}

function numberValue(item, key, fallback = 0) {
  const value = Number(item?.[key]?.N);
  return Number.isFinite(value) ? value : fallback;
}

function booleanValue(item, key, fallback = false) {
  return typeof item?.[key]?.BOOL === 'boolean' ? item[key].BOOL : fallback;
}

function paddedOrder(value) {
  return String(Math.max(0, Math.trunc(Number(value) || 0))).padStart(8, '0');
}

function productPartitionKey(productId) {
  return `PRODUCT#${String(productId || '').trim()}`;
}

function slugPartitionKey(slug) {
  return `SLUG#${String(slug || '').trim().toLowerCase()}`;
}

function stripVariantConfig(variants = {}) {
  return Object.fromEntries(
    Object.entries(variants || {}).map(([style, variant]) => [
      style,
      {
        ...(typeof variant?.price === 'number'
          ? { price: Math.trunc(variant.price) }
          : {}),
        colors: Array.isArray(variant?.colors) ? variant.colors : [],
        sizes: Array.isArray(variant?.sizes) ? variant.sizes : [],
      },
    ])
  );
}

function getEntryPrice(product, entry) {
  if (Number.isFinite(Number(entry?.price))) {
    return Math.trunc(Number(entry.price));
  }
  const style = entry?.options?.style;
  const variantPrice = style ? product?.variants?.[style]?.price : null;
  return Number.isFinite(variantPrice)
    ? Math.trunc(variantPrice)
    : Math.trunc(Number(product?.price) || 0);
}

function getEntryImage(product, entry) {
  if (String(entry?.image || '').trim()) return String(entry.image).trim();
  const style = entry?.options?.style;
  const color = entry?.options?.color;
  return (
    (style && color && product?.variants?.[style]?.imageByColor?.[color]) ||
    (color && product?.imageMap?.[color]) ||
    (style && product?.imageMap?.[style]) ||
    product?.image ||
    ''
  );
}

export function buildCatalogSeedItems(product, entries = [], sortOrder = 0) {
  const productId = String(product?.id || '').trim();
  const slug = String(product?.slug || '').trim().toLowerCase();
  const name = String(product?.name || '').trim();
  if (!productId || !slug || !name) {
    throw new Error('Catalog product requires an id, slug, and name');
  }

  const status = normalizeProductCatalogStatus(
    product?.status,
    product?.active
  );
  const updatedAt = new Date().toISOString();
  const pk = productPartitionKey(productId);
  const cleanEntries = Array.isArray(entries)
    ? entries.filter((entry) => String(entry?.sku || '').trim())
    : [];
  const variantEntries = cleanEntries.map((entry) => ({
    ...entry,
    image: getEntryImage(product, entry),
  }));
  const suppliedMedia = Array.isArray(product?.media)
    ? product.media
        .map((item, index) => ({
          assetId: String(item?.assetId || `media-${index + 1}`).trim(),
          source: ['local', 'remote', 's3'].includes(item?.source)
            ? item.source
            : String(item?.objectKey || '').startsWith('/images/')
              ? 'local'
              : 'remote',
          objectKey: String(item?.objectKey || item?.url || '').trim(),
          altText: String(item?.altText || name).trim(),
          assignedSkus: inferMediaAssignedSkus(item, variantEntries),
          shared: item?.shared === true,
        }))
        .filter((item) => item.assetId && item.objectKey)
    : [];
  const images = [
    ...new Set(
      (Array.isArray(product?.images) ? product.images : [product?.image])
        .map((image) => String(image || '').trim())
        .filter(Boolean)
    ),
  ];
  const mediaEntries = suppliedMedia.length
    ? suppliedMedia
    : images.map((image, index) => ({
        assetId: `media-${index + 1}`,
        source: image.startsWith('/images/') ? 'local' : 'remote',
        objectKey: image,
        altText: name,
        assignedSkus: inferMediaAssignedSkus(
          { source: image.startsWith('/images/') ? 'local' : 'remote', objectKey: image },
          variantEntries
        ),
        shared: false,
      }));
  const taxonomy = getProductTaxonomy(product);
  const meta = {
    pk: { S: pk },
    sk: { S: 'META' },
    entity_type: { S: 'product' },
    product_id: { S: productId },
    slug: { S: slug },
    name: { S: name },
    category: { S: taxonomy.category },
    collection: { S: taxonomy.collection },
    label: {
      S: String(product?.label || 'Avalanche Hour field goods').trim(),
    },
    description: { S: String(product?.description || '').trim() },
    status: { S: status },
    active: { BOOL: status === PRODUCT_CATALOG_STATUSES.LIVE },
    base_price_cents: { N: String(Math.trunc(Number(product?.price) || 0)) },
    hero_image: { S: String(product?.image || images[0] || '') },
    styles_json: {
      S: JSON.stringify(Array.isArray(product?.styles) ? product.styles : []),
    },
    colors_json: {
      S: JSON.stringify(Array.isArray(product?.colors) ? product.colors : []),
    },
    sizes_json: {
      S: JSON.stringify(Array.isArray(product?.sizes) ? product.sizes : []),
    },
    variant_config_json: {
      S: JSON.stringify(stripVariantConfig(product?.variants)),
    },
    option_labels_json: {
      S: JSON.stringify(product?.optionLabels || {}),
    },
    sort_order: { N: String(Math.max(0, Math.trunc(sortOrder))) },
    version: {
      N: String(Math.max(1, Math.trunc(Number(product?.version) || 1))),
    },
    updated_at: { S: updatedAt },
    gsi1pk: { S: CATALOG_INDEX_PARTITION },
    gsi1sk: {
      S: `${status}#${paddedOrder(sortOrder)}#${productId}`,
    },
  };
  const variants = variantEntries.map((entry, index) => {
    const sku = String(entry.sku).trim();
    return {
      pk: { S: pk },
      sk: { S: `VARIANT#${sku}` },
      entity_type: { S: 'variant' },
      product_id: { S: productId },
      sku: { S: sku },
      label: { S: String(entry.label || sku).trim() },
      options_json: { S: JSON.stringify(entry.options || {}) },
      price_cents: { N: String(getEntryPrice(product, entry)) },
      image: { S: getEntryImage(product, entry) },
      active: { BOOL: entry?.active !== false },
      sort_order: { N: String(index) },
      updated_at: { S: updatedAt },
    };
  });
  const media = mediaEntries.map((item, index) => ({
    pk: { S: pk },
    sk: { S: `MEDIA#${paddedOrder(index)}#${item.assetId}` },
    entity_type: { S: 'media' },
    product_id: { S: productId },
    asset_id: { S: item.assetId },
    source: { S: item.source },
    object_key: { S: item.objectKey },
    alt_text: { S: item.altText || name },
    role: { S: index === 0 ? 'hero' : 'gallery' },
    sort_order: { N: String(index) },
    assigned_skus_json: {
      S: JSON.stringify(item.assignedSkus || []),
    },
    shared: { BOOL: item.shared === true },
    updated_at: { S: updatedAt },
  }));
  const slugLookup = {
    pk: { S: slugPartitionKey(slug) },
    sk: { S: 'LOOKUP' },
    entity_type: { S: 'slug_lookup' },
    product_id: { S: productId },
    slug: { S: slug },
    updated_at: { S: updatedAt },
  };

  return { meta, variants, media, slugLookup };
}

export function catalogProductFromItems(items = []) {
  const meta = items.find((item) => stringValue(item, 'sk') === 'META');
  if (!meta) return null;

  const media = items
    .filter((item) => stringValue(item, 'entity_type') === 'media')
    .sort(
      (left, right) =>
        numberValue(left, 'sort_order') - numberValue(right, 'sort_order')
    );
  const variantConfig = parseJson(
    stringValue(meta, 'variant_config_json'),
    {}
  );
  const variants = structuredClone(variantConfig);
  const variantItems = items
    .filter((item) => stringValue(item, 'entity_type') === 'variant')
    .sort(
      (left, right) =>
        numberValue(left, 'sort_order') - numberValue(right, 'sort_order') ||
        stringValue(left, 'sku').localeCompare(stringValue(right, 'sku'))
    );

  for (const item of variantItems) {
    const sku = stringValue(item, 'sku');
    const options = parseJson(stringValue(item, 'options_json'), {});
    const style = String(options.style || '').trim();
    if (!style) continue;
    const variant = variants[style] || { colors: [], sizes: [] };
    const price = numberValue(item, 'price_cents');
    const color = String(options.color || '').trim();
    const size = String(options.size || '').trim();
    const image = stringValue(item, 'image');
    variant.price = Number.isFinite(price) ? price : undefined;
    variant.colors = Array.isArray(variant.colors) ? variant.colors : [];
    variant.sizes = Array.isArray(variant.sizes) ? variant.sizes : [];

    if (color) {
      if (!variant.colors.includes(color)) variant.colors.push(color);
      variant.skuByColor = { ...(variant.skuByColor || {}), [color]: sku };
    }
    const displayColor =
      color || (variant.colors.length === 1 ? variant.colors[0] : '');
    if (image && displayColor) {
      variant.imageByColor = {
        ...(variant.imageByColor || {}),
        [displayColor]: image,
      };
    }
    if (size) {
      if (!variant.sizes.includes(size)) variant.sizes.push(size);
      variant.skuBySize = { ...(variant.skuBySize || {}), [size]: sku };
    }

    variants[style] = variant;
  }

  const mediaUrl = (item) => {
    const objectKey = stringValue(item, 'object_key');
    return stringValue(item, 'source') === 's3'
      ? `/api/store/product-image?key=${encodeURIComponent(objectKey)}`
      : objectKey;
  };
  const images = media.map(mediaUrl).filter(Boolean);
  const productId = stringValue(meta, 'product_id');
  const storedOptionLabels = parseJson(
    stringValue(meta, 'option_labels_json'),
    {}
  );
  const product = {
    id: productId,
    slug: stringValue(meta, 'slug'),
    name: stringValue(meta, 'name'),
    ...getProductTaxonomy({
      id: productId,
      category: stringValue(meta, 'category'),
      collection: stringValue(meta, 'collection'),
    }),
    label:
      stringValue(meta, 'label') || 'Avalanche Hour field goods',
    description: stringValue(meta, 'description'),
    status: normalizeProductCatalogStatus(stringValue(meta, 'status')),
    active: booleanValue(meta, 'active'),
    price: numberValue(meta, 'base_price_cents'),
    image: stringValue(meta, 'hero_image') || images[0] || '',
    images,
    styles: parseJson(stringValue(meta, 'styles_json'), []),
    colors: parseJson(stringValue(meta, 'colors_json'), []),
    sizes: parseJson(stringValue(meta, 'sizes_json'), []),
    optionLabels: getProductOptionLabels({
      id: productId,
      optionLabels: storedOptionLabels,
    }),
    sortOrder: numberValue(meta, 'sort_order'),
    version: numberValue(meta, 'version', 1),
    updatedAt: stringValue(meta, 'updated_at'),
    skuEntries: variantItems.map((item) => ({
      sku: stringValue(item, 'sku'),
      label: stringValue(item, 'label'),
      options: parseJson(stringValue(item, 'options_json'), {}),
      price: numberValue(item, 'price_cents'),
      image: stringValue(item, 'image'),
      active: booleanValue(item, 'active', true),
    })),
    media: media.map((item) => ({
      assetId: stringValue(item, 'asset_id'),
      source: stringValue(item, 'source'),
      objectKey: stringValue(item, 'object_key'),
      url: mediaUrl(item),
      altText: stringValue(item, 'alt_text'),
      role: stringValue(item, 'role'),
      sortOrder: numberValue(item, 'sort_order'),
      assignedSkus: item.assigned_skus_json
        ? parseJson(stringValue(item, 'assigned_skus_json'), [])
        : null,
      shared: booleanValue(item, 'shared', false),
    })),
  };

  if (Object.keys(variants).length) product.variants = variants;
  return product;
}

async function getCatalogProductItemsById(productId) {
  const response = await dynamoDbRequest('Query', {
    TableName: getProductsTableName(),
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': 'pk' },
    ExpressionAttributeValues: {
      ':pk': { S: productPartitionKey(productId) },
    },
  });
  return response.Items || [];
}

export async function getCatalogProductById(productId) {
  assertDynamoProductCatalogReady();
  return catalogProductFromItems(
    await getCatalogProductItemsById(productId)
  );
}

export async function getCatalogProductBySlug(slug, options = {}) {
  assertDynamoProductCatalogReady();
  const lookup = await dynamoDbRequest('GetItem', {
    TableName: getProductsTableName(),
    Key: {
      pk: { S: slugPartitionKey(slug) },
      sk: { S: 'LOOKUP' },
    },
  });
  const productId = stringValue(lookup.Item, 'product_id');
  if (!productId) return null;
  const product = await getCatalogProductById(productId);
  if (
    !options.includeBackendOnly &&
    product &&
    !isProductVisibleOnStorefront(product)
  ) {
    return null;
  }
  return product;
}

export async function listCatalogProducts(options = {}) {
  assertDynamoProductCatalogReady();
  const summaryItems = [];
  let exclusiveStartKey;

  do {
    const response = await dynamoDbRequest('Query', {
      TableName: getProductsTableName(),
      IndexName: CATALOG_INDEX_NAME,
      KeyConditionExpression: '#gsi1pk = :catalog',
      ExpressionAttributeNames: { '#gsi1pk': 'gsi1pk' },
      ExpressionAttributeValues: {
        ':catalog': { S: CATALOG_INDEX_PARTITION },
      },
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    });
    summaryItems.push(...(response.Items || []));
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  const summaries = summaryItems
    .filter((item) => stringValue(item, 'entity_type') === 'product')
    .map((item) => catalogProductFromItems([item]))
    .filter(Boolean)
    .filter(
      (product) =>
        options.includeBackendOnly || isProductVisibleOnStorefront(product)
    )
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
    );

  const products = [];
  for (let index = 0; index < summaries.length; index += 10) {
    products.push(
      ...(await Promise.all(
        summaries
          .slice(index, index + 10)
          .map((product) => getCatalogProductById(product.id))
      ))
    );
  }
  return products.filter(Boolean);
}

export async function seedCatalogProduct(
  product,
  entries,
  sortOrder,
  options = {}
) {
  assertDynamoProductCatalogReady();
  const records = buildCatalogSeedItems(product, entries, sortOrder);
  const items = [
    records.meta,
    ...records.variants,
    ...records.media,
    records.slugLookup,
  ];
  if (items.length > 100) {
    throw new Error('Catalog product exceeds the DynamoDB transaction limit');
  }

  if (options.overwrite) {
    const saved = await saveCatalogProduct({
      ...product,
      skuEntries: entries,
      sortOrder,
    });
    return {
      productId: saved.id,
      itemCount: items.length,
    };
  }

  await dynamoDbRequest('TransactWriteItems', {
    TransactItems: items.map((item) => ({
      Put: {
        TableName: getProductsTableName(),
        Item: item,
        ConditionExpression: 'attribute_not_exists(#pk)',
        ExpressionAttributeNames: { '#pk': 'pk' },
      },
    })),
  });

  return {
    productId: stringValue(records.meta, 'product_id'),
    itemCount: items.length,
  };
}

function itemKey(item) {
  return `${stringValue(item, 'pk')}|${stringValue(item, 'sk')}`;
}

export async function saveCatalogProduct(product, options = {}) {
  assertDynamoProductCatalogReady();
  const productId = String(product?.id || '').trim();
  if (!productId) throw new Error('Catalog product ID is required');

  const previousItems = await getCatalogProductItemsById(productId);
  const previous = catalogProductFromItems(previousItems);
  const creating = !previous;
  if (options.createOnly && !creating) {
    throw new Error('Catalog product already exists');
  }
  if (options.requireExisting && creating) {
    throw new Error('Catalog product does not exist');
  }

  const expectedVersion = Math.max(
    1,
    Math.trunc(Number(options.expectedVersion || previous?.version) || 1)
  );
  const nextVersion = creating ? 1 : expectedVersion + 1;
  const records = buildCatalogSeedItems(
    { ...product, version: nextVersion },
    product.skuEntries || [],
    product.sortOrder || 0
  );
  const replacementItems = [
    records.meta,
    ...records.variants,
    ...records.media,
  ];
  const replacementKeys = new Set(replacementItems.map(itemKey));
  const removedItems = previousItems.filter(
    (item) =>
      stringValue(item, 'sk') !== 'META' &&
      !replacementKeys.has(itemKey(item))
  );

  const transactItems = [
    {
      Put: {
        TableName: getProductsTableName(),
        Item: records.meta,
        ConditionExpression: creating
          ? 'attribute_not_exists(#pk)'
          : '#version = :expected_version',
        ExpressionAttributeNames: creating
          ? { '#pk': 'pk' }
          : { '#version': 'version' },
        ...(creating
          ? {}
          : {
              ExpressionAttributeValues: {
                ':expected_version': { N: String(expectedVersion) },
              },
            }),
      },
    },
    ...replacementItems
      .filter((item) => stringValue(item, 'sk') !== 'META')
      .map((item) => ({
        Put: {
          TableName: getProductsTableName(),
          Item: item,
        },
      })),
    {
      Put: {
        TableName: getProductsTableName(),
        Item: records.slugLookup,
        ConditionExpression:
          'attribute_not_exists(#pk) OR #product_id = :product_id',
        ExpressionAttributeNames: {
          '#pk': 'pk',
          '#product_id': 'product_id',
        },
        ExpressionAttributeValues: {
          ':product_id': { S: productId },
        },
      },
    },
    ...removedItems.map((item) => ({
      Delete: {
        TableName: getProductsTableName(),
        Key: {
          pk: item.pk,
          sk: item.sk,
        },
      },
    })),
  ];

  if (previous?.slug && previous.slug !== product.slug) {
    transactItems.push({
      Delete: {
        TableName: getProductsTableName(),
        Key: {
          pk: { S: slugPartitionKey(previous.slug) },
          sk: { S: 'LOOKUP' },
        },
        ConditionExpression:
          'attribute_not_exists(#product_id) OR #product_id = :product_id',
        ExpressionAttributeNames: { '#product_id': 'product_id' },
        ExpressionAttributeValues: {
          ':product_id': { S: productId },
        },
      },
    });
  }

  if (Array.isArray(options.additionalTransactItems)) {
    transactItems.push(...options.additionalTransactItems);
  }

  if (transactItems.length > 100) {
    throw new Error(
      'This product has too many variants or images to update in one save.'
    );
  }

  await dynamoDbRequest('TransactWriteItems', {
    TransactItems: transactItems,
  });

  return getCatalogProductById(productId);
}
