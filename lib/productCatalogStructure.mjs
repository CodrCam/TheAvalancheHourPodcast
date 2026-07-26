const PRODUCT_TAXONOMY_DEFAULTS = Object.freeze({
  'avalanche-hour-hats': {
    category: 'Headwear',
    collection: 'Avalanche Hour',
  },
  'recaps-caps': {
    category: 'Headwear',
    collection: 'ReCaps',
  },
  'recaps-beanies': {
    category: 'Headwear',
    collection: 'ReCaps',
  },
  hoodies: {
    category: 'Apparel',
    collection: 'Season layers',
  },
  'voile-straps': {
    category: 'Field gear',
    collection: 'Avalanche Hour',
  },
  'free-range-tote': {
    category: 'Bags',
    collection: 'Free Range Equipment',
  },
  'ah-sticker-logo': {
    category: 'Accessories',
    collection: 'Avalanche Hour',
  },
});

const PRODUCT_OPTION_LABEL_DEFAULTS = Object.freeze({
  'avalanche-hour-hats': { style: 'Design' },
  'recaps-caps': { style: 'Hat type' },
  'recaps-beanies': { style: 'Hat type' },
  hoodies: { style: 'Color' },
  'voile-straps': { style: 'Length' },
});

function cleanText(value) {
  return String(value || '').trim();
}

function unique(values = []) {
  return [...new Set(values.map(cleanText).filter(Boolean))];
}

function imageReference(value) {
  const input = cleanText(value);
  if (!input) return '';

  try {
    const url = new URL(input, 'https://catalog.local');
    const proxiedKey = url.searchParams.get('key');
    return decodeURIComponent(proxiedKey || url.pathname);
  } catch {
    return input;
  }
}

function imageFamily(value) {
  const path = imageReference(value);
  const fileName = path.split('/').pop() || path;
  const withoutExtension = fileName.replace(/\.[a-z0-9]+$/i, '');
  return withoutExtension
    .replace(/(?:[-_\s]?)(?:front|back|detail|alt)?[-_\s]?\d+$/i, '')
    .replace(/[^a-z0-9]+/gi, '')
    .toLowerCase();
}

function getStructureSkuEntries(product = {}) {
  if (Array.isArray(product.skuEntries) && product.skuEntries.length) {
    return product.skuEntries;
  }

  if (!product.variants) {
    return product.id
      ? [{ sku: product.id, image: product.image || '', options: {} }]
      : [];
  }

  const entries = [];
  for (const [style, variant] of Object.entries(product.variants)) {
    for (const [color, sku] of Object.entries(variant.skuByColor || {})) {
      entries.push({
        sku,
        options: { style, color },
        image:
          variant.imageByColor?.[color] ||
          product.imageMap?.[color] ||
          product.image ||
          '',
      });
    }
    for (const [size, sku] of Object.entries(variant.skuBySize || {})) {
      entries.push({
        sku,
        options: { style, size },
        image:
          variant.imageByColor?.[style] ||
          product.imageMap?.[style] ||
          product.image ||
          '',
      });
    }
  }
  return entries;
}

export function getProductTaxonomy(product = {}) {
  const fallback = PRODUCT_TAXONOMY_DEFAULTS[product.id] || {};
  return {
    category: cleanText(product.category || fallback.category) || 'Other goods',
    collection:
      cleanText(product.collection || fallback.collection) || 'Avalanche Hour',
  };
}

export function getProductOptionLabels(product = {}) {
  const supplied = product.optionLabels || {};
  const defaults = PRODUCT_OPTION_LABEL_DEFAULTS[product.id] || {};
  const suppliedStyle = cleanText(supplied.style);
  return {
    style:
      suppliedStyle && suppliedStyle !== 'Style'
        ? suppliedStyle
        : defaults.style || suppliedStyle || 'Style',
    color: cleanText(supplied.color) || 'Color',
    size: cleanText(supplied.size) || 'Size',
  };
}

export function groupProductsByTaxonomy(products = []) {
  const categories = [];
  const categoryMap = new Map();

  for (const product of products) {
    const taxonomy = getProductTaxonomy(product);
    let category = categoryMap.get(taxonomy.category);
    if (!category) {
      category = {
        category: taxonomy.category,
        collections: [],
        productCount: 0,
      };
      categoryMap.set(taxonomy.category, category);
      categories.push(category);
    }

    let collection = category.collections.find(
      (item) => item.collection === taxonomy.collection
    );
    if (!collection) {
      collection = { collection: taxonomy.collection, products: [] };
      category.collections.push(collection);
    }

    collection.products.push(product);
    category.productCount += 1;
  }

  return categories;
}

export function getProductMediaUrl(item = {}) {
  const objectKey = cleanText(item.objectKey || item.url);
  if (!objectKey) return '';
  return item.source === 's3'
    ? `/api/store/product-image?key=${encodeURIComponent(objectKey)}`
    : objectKey;
}

export function inferMediaAssignedSkus(item = {}, skuEntries = []) {
  if (Array.isArray(item.assignedSkus)) {
    return unique(item.assignedSkus);
  }

  const mediaFamily = imageFamily(getProductMediaUrl(item));
  if (!mediaFamily) return [];

  return unique(
    skuEntries
      .filter((entry) => imageFamily(entry?.image) === mediaFamily)
      .map((entry) => entry.sku)
  );
}

export function getProductMedia(product = {}) {
  const entries = getStructureSkuEntries(product);
  const supplied = Array.isArray(product.media) ? product.media : [];
  const media = supplied.length
    ? supplied
    : (Array.isArray(product.images) ? product.images : [product.image])
        .filter(Boolean)
        .map((url, index) => ({
          assetId: `image-${index + 1}`,
          source: String(url).startsWith('/images/') ? 'local' : 'remote',
          objectKey: url,
          url,
          assignedSkus: null,
        }));

  return media
    .map((item, index) => {
      const hasExplicitAssignments = Array.isArray(item.assignedSkus);
      const assignedSkus = inferMediaAssignedSkus(item, entries);
      return {
        ...item,
        assetId: cleanText(item.assetId) || `image-${index + 1}`,
        url: getProductMediaUrl(item),
        assignedSkus,
        shared:
          item.shared === true ||
          (!hasExplicitAssignments && assignedSkus.length === 0),
      };
    })
    .filter((item) => item.url);
}

export function getProductMediaForSku(product = {}, sku = '') {
  const selectedSku = cleanText(sku);
  const entries = getStructureSkuEntries(product);
  const media = getProductMedia(product);
  const relevant = media.filter((item) => {
    if (item.shared) return true;
    if (!selectedSku) return false;
    return item.assignedSkus.includes(selectedSku);
  });
  const selectedEntry = entries.find((entry) => entry.sku === selectedSku);
  const primaryImage = cleanText(selectedEntry?.image || product.image);
  const urls = unique([
    primaryImage,
    ...relevant.map((item) => item.url),
  ]);

  return urls.length ? urls : unique([product.image]);
}

export function describeSkuOptions(entry = {}, optionLabels = {}) {
  const options = entry.options || {};
  const values = ['style', 'color', 'size']
    .filter((key) => cleanText(options[key]))
    .map((key) => ({
      key,
      label:
        cleanText(optionLabels[key]) ||
        `${key.charAt(0).toUpperCase()}${key.slice(1)}`,
      value: cleanText(options[key]),
    }));

  return values;
}
