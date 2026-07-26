import {
  PRODUCT_CATALOG_STATUSES,
  normalizeProductCatalogStatus,
} from './productCatalogPresentation.mjs';
import {
  getProductMediaUrl,
  getProductTaxonomy,
  inferMediaAssignedSkus,
} from './productCatalogStructure.mjs';

const MAX_PRODUCT_NAME = 120;
const MAX_DESCRIPTION = 5000;
const MAX_LABEL = 80;
const MAX_VARIANTS = 60;
const MAX_MEDIA = 20;
const MAX_PRICE_CENTS = 1_000_000;
const OPTION_KEYS = ['style', 'color', 'size'];

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function safeToken(value, maxLength = 100) {
  return cleanText(value, maxLength)
    .normalize('NFKC')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function slugifyProduct(value) {
  return cleanText(value, 140)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

function normalizePrice(value, fallback = 0) {
  const amount = Math.trunc(Number(value));
  if (!Number.isFinite(amount)) return fallback;
  return Math.max(0, Math.min(MAX_PRICE_CENTS, amount));
}

function normalizeOptions(value = {}) {
  return Object.fromEntries(
    OPTION_KEYS.map((key) => [key, cleanText(value?.[key], 80)]).filter(
      ([, option]) => option
    )
  );
}

function normalizeMedia(rawMedia = [], productName = '', skuEntries = []) {
  const media = [];
  const seen = new Set();

  for (const [index, raw] of (Array.isArray(rawMedia) ? rawMedia : []).entries()) {
    if (media.length >= MAX_MEDIA) break;
    const source = ['local', 'remote', 's3'].includes(raw?.source)
      ? raw.source
      : String(raw?.objectKey || '').startsWith('/images/')
        ? 'local'
        : 'remote';
    const objectKey = cleanText(raw?.objectKey || raw?.url, 1500);
    if (!objectKey) continue;
    const dedupeKey = `${source}:${objectKey}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    media.push({
      assetId:
        safeToken(raw?.assetId, 120) ||
        `media-${String(index + 1).padStart(2, '0')}`,
      source,
      objectKey,
      altText: cleanText(raw?.altText, 240) || productName,
      role: index === 0 ? 'hero' : 'gallery',
      sortOrder: index,
      shared: raw?.shared === true,
      assignedSkus: inferMediaAssignedSkus(
        {
          ...raw,
          source,
          objectKey,
          assignedSkus: Array.isArray(raw?.assignedSkus)
            ? raw.assignedSkus
            : null,
        },
        skuEntries
      ),
    });
  }

  return media;
}

function validateMediaLocations(media, productId) {
  const productPrefix = `products/${productId}/`;

  for (const item of media) {
    if (item.source === 's3') {
      const segments = item.objectKey.split('/');
      if (
        !item.objectKey.startsWith(productPrefix) ||
        segments.some((segment) => !segment || segment === '.' || segment === '..')
      ) {
        throw new Error('Uploaded product images must belong to this product.');
      }
      continue;
    }

    if (item.source === 'local') {
      if (
        !item.objectKey.startsWith('/images/') ||
        item.objectKey.includes('..') ||
        item.objectKey.includes('\\')
      ) {
        throw new Error('Local product images must use a safe /images/ path.');
      }
      continue;
    }

    try {
      const url = new URL(item.objectKey);
      if (url.protocol !== 'https:') throw new Error('insecure');
    } catch {
      throw new Error('Remote product images must use a complete HTTPS URL.');
    }
  }
}

function normalizeSkuEntries(rawEntries = [], basePrice = 0) {
  const entries = [];
  const seen = new Set();

  for (const raw of Array.isArray(rawEntries) ? rawEntries : []) {
    if (entries.length >= MAX_VARIANTS) break;
    const sku = safeToken(raw?.sku, 100);
    if (!sku) continue;
    const skuKey = sku.toLowerCase();
    if (seen.has(skuKey)) {
      throw new Error(`SKU "${sku}" is listed more than once.`);
    }
    seen.add(skuKey);
    const options = normalizeOptions(raw?.options);

    entries.push({
      sku,
      label: cleanText(raw?.label, 160) || sku,
      options,
      price: normalizePrice(raw?.price, basePrice),
      image: cleanText(raw?.image, 1500),
      active: raw?.active !== false,
      quantity: Math.max(0, Math.trunc(Number(raw?.quantity) || 0)),
      hidden: raw?.hidden === true,
      inventoryUpdatedAt: cleanText(raw?.inventoryUpdatedAt, 80) || null,
    });
  }

  return entries;
}

function uniqueOptionValues(entries, key) {
  return [
    ...new Set(
      entries.map((entry) => cleanText(entry.options?.[key], 80)).filter(Boolean)
    ),
  ];
}

export function validateProductForPublication(product) {
  const problems = [];
  if (!product.name) problems.push('Add a product name.');
  if (!product.slug) problems.push('Add a storefront URL slug.');
  if (!product.description) problems.push('Add a product description.');
  if (!product.media?.length) problems.push('Add at least one product image.');

  const activeEntries = (product.skuEntries || []).filter(
    (entry) => entry.active !== false
  );
  if (!activeEntries.length) problems.push('Add at least one active SKU.');
  if (activeEntries.some((entry) => entry.price <= 0)) {
    problems.push('Every active SKU needs a price greater than $0.');
  }
  if (activeEntries.some((entry) => !entry.image)) {
    problems.push('Every active SKU needs an assigned customer image.');
  }

  return problems;
}

export function normalizeCatalogProductInput(raw = {}, options = {}) {
  const existing = options.existing || null;
  const name = cleanText(raw.name, MAX_PRODUCT_NAME);
  const slug = slugifyProduct(raw.slug || name);
  const id =
    safeToken(existing?.id || raw.id, 120) ||
    `product-${slug || 'draft'}`;
  const status = normalizeProductCatalogStatus(
    raw.status,
    raw.active !== false
  );
  const price = normalizePrice(raw.price);
  const normalizedSkuEntries = normalizeSkuEntries(raw.skuEntries, price);
  const media = normalizeMedia(raw.media, name, normalizedSkuEntries);
  validateMediaLocations(media, id);
  const skuEntries = normalizedSkuEntries.map((entry) =>
    !entry.image && normalizedSkuEntries.length === 1 && media[0]
      ? { ...entry, image: getProductMediaUrl(media[0]) }
      : entry
  );
  const taxonomy = getProductTaxonomy({
    id,
    category: cleanText(raw.category, 80),
    collection: cleanText(raw.collection, 80),
  });
  const optionLabels = Object.fromEntries(
    OPTION_KEYS.map((key) => [
      key,
      cleanText(raw.optionLabels?.[key], 40) ||
        key.charAt(0).toUpperCase() + key.slice(1),
    ])
  );
  const imageUrl = (item) =>
    item.source === 's3'
      ? `/api/store/product-image?key=${encodeURIComponent(item.objectKey)}`
      : item.objectKey;
  const images = media.map(imageUrl);

  const product = {
    id,
    slug,
    name,
    category: taxonomy.category,
    collection: taxonomy.collection,
    label: cleanText(raw.label, MAX_LABEL) || 'Avalanche Hour field goods',
    description: cleanText(raw.description, MAX_DESCRIPTION),
    status,
    active: status === PRODUCT_CATALOG_STATUSES.LIVE,
    price,
    image: images[0] || '',
    images,
    media,
    optionLabels,
    styles: uniqueOptionValues(skuEntries, 'style'),
    colors: uniqueOptionValues(skuEntries, 'color'),
    sizes: uniqueOptionValues(skuEntries, 'size'),
    sortOrder: Math.max(0, Math.trunc(Number(raw.sortOrder) || 0)),
    skuEntries,
    version: Math.max(1, Math.trunc(Number(existing?.version || raw.version) || 1)),
  };

  if (!product.name) throw new Error('Product name is required.');
  if (!product.slug) throw new Error('Product URL slug is required.');
  if (!product.id) throw new Error('Product ID is required.');
  if (!product.skuEntries.length) {
    throw new Error('Add at least one SKU before saving this product.');
  }

  if (status === PRODUCT_CATALOG_STATUSES.LIVE) {
    const problems = validateProductForPublication(product);
    if (problems.length) throw new Error(problems.join(' '));
  }

  return product;
}

export const PRODUCT_OPTION_KEYS = OPTION_KEYS;
