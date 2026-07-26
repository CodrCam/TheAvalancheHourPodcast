import { products } from '../src/data/products.js';

export function getColorsForStyle(product, style) {
  if (!product) return [];
  const base = Array.isArray(product.colors) ? product.colors : [];
  if (product.variants && style && product.variants[style]?.colors) {
    return product.variants[style].colors;
  }
  return base;
}

export function getUnitPrice(product, options = {}) {
  if (!product) return 0;
  const explicitEntry = findSkuEntryForOptions(product, options);
  if (explicitEntry && Number.isFinite(Number(explicitEntry.price))) {
    return Math.trunc(Number(explicitEntry.price));
  }
  const base = product.price || 0;
  const style = options.style;

  if (
    style &&
    product.variants &&
    product.variants[style] &&
    typeof product.variants[style].price === 'number'
  ) {
    return product.variants[style].price;
  }

  return base;
}

export function getSkuForOptions(product, options = {}) {
  if (!product) return null;
  const explicitEntry = findSkuEntryForOptions(product, options);
  if (explicitEntry) return explicitEntry.sku;

  const style = options.style || options.material || options.variant || null;
  const size = options.size || null;
  const color = options.color || null;

  if (product.variants && style && product.variants[style]) {
    const variant = product.variants[style];

    if (size && variant.skuBySize?.[size]) {
      return variant.skuBySize[size];
    }

    if (color && variant.skuByColor?.[color]) {
      return variant.skuByColor[color];
    }
  }

  if (!product.variants) {
    return product.id;
  }

  return null;
}

export function getVariantImage(product, options = {}) {
  if (!product) return null;
  const style = options.style;
  const color = options.color;
  const explicitEntry =
    findSkuEntryForOptions(product, options) ||
    findSkuEntryForOptions(product, options, { allowPartial: true });
  if (explicitEntry?.image) return explicitEntry.image;

  if (style && product.variants?.[style]?.imageByColor?.[color]) {
    return product.variants[style].imageByColor[color];
  }

  if (product.imageMap?.[color]) return product.imageMap[color];

  const imgs = Array.isArray(product.images) ? product.images : [];
  if (color) {
    const token = String(color).toLowerCase();
    const hit = imgs.find((src) => String(src).toLowerCase().includes(token));
    if (hit) return hit;
  }

  return imgs[0] || product.image || null;
}

export function getProductSkuEntries(product) {
  if (!product) return [];

  if (Array.isArray(product.skuEntries) && product.skuEntries.length) {
    return product.skuEntries
      .filter((entry) => entry?.active !== false && String(entry?.sku || '').trim())
      .map((entry) => ({
        sku: String(entry.sku).trim(),
        productId: product.id,
        productName: product.name,
        label: entry.label || entry.sku,
        options:
          entry.options && typeof entry.options === 'object'
            ? entry.options
            : {},
        price: Number.isFinite(Number(entry.price))
          ? Math.trunc(Number(entry.price))
          : Math.trunc(Number(product.price) || 0),
        image: entry.image || '',
        active: entry.active !== false,
      }));
  }

  if (!product.variants) {
    return [
      {
        sku: product.id,
        productId: product.id,
        productName: product.name,
        label: product.name,
        options: {},
      },
    ];
  }

  const entries = [];

  for (const [style, variant] of Object.entries(product.variants)) {
    if (variant.skuByColor) {
      for (const [color, sku] of Object.entries(variant.skuByColor)) {
        entries.push({
          sku,
          productId: product.id,
          productName: product.name,
          label: `${product.name} - ${style} - ${color}`,
          options: { style, color },
          price: Number.isFinite(Number(variant.price))
            ? Math.trunc(Number(variant.price))
            : Math.trunc(Number(product.price) || 0),
          image:
            variant.imageByColor?.[color] ||
            product.imageMap?.[color] ||
            product.image ||
            '',
        });
      }
    }

    if (variant.skuBySize) {
      for (const [size, sku] of Object.entries(variant.skuBySize)) {
        entries.push({
          sku,
          productId: product.id,
          productName: product.name,
          label: `${product.name} - ${style} - ${size}`,
          options: { style, size },
          price: Number.isFinite(Number(variant.price))
            ? Math.trunc(Number(variant.price))
            : Math.trunc(Number(product.price) || 0),
          image:
            variant.imageByColor?.[style] ||
            product.imageMap?.[style] ||
            product.image ||
            '',
        });
      }
    }
  }

  return entries;
}

function findSkuEntryForOptions(product, options = {}, settings = {}) {
  if (!Array.isArray(product?.skuEntries) || !product.skuEntries.length) {
    return null;
  }
  const requested = Object.fromEntries(
    Object.entries(options || {})
      .map(([key, value]) => [key, String(value || '').trim()])
      .filter(([, value]) => value)
  );
  const requestedKeys = Object.keys(requested);

  return (
    product.skuEntries.find((entry) => {
      if (entry?.active === false) return false;
      const entryOptions =
        entry?.options && typeof entry.options === 'object'
          ? entry.options
          : {};
      if (
        requestedKeys.some(
          (key) => String(entryOptions[key] || '').trim() !== requested[key]
        )
      ) {
        return false;
      }
      if (settings.allowPartial) return true;
      const entryKeys = Object.keys(entryOptions).filter((key) =>
        String(entryOptions[key] || '').trim()
      );
      return entryKeys.every((key) => requestedKeys.includes(key));
    }) || null
  );
}

export function getSelectableStyles(product, entries = []) {
  if (!product?.styles?.length) return [];

  return product.styles.filter((style) =>
    entries.some((entry) => entry.options?.style === style)
  );
}

export function getSelectableColors(product, entries = [], style = '') {
  const colors = getColorsForStyle(product, style);
  if (!colors.length) return [];

  return colors.filter((color) =>
    entries.some((entry) => {
      if (style && entry.options?.style && entry.options.style !== style) {
        return false;
      }

      if (entry.options?.color) {
        return entry.options.color === color;
      }

      return true;
    })
  );
}

export function getSelectableSizes(product, entries = [], options = {}) {
  if (!product?.sizes?.length) return [];

  return product.sizes.filter((size) =>
    entries.some((entry) => {
      if (
        options.style &&
        entry.options?.style &&
        entry.options.style !== options.style
      ) {
        return false;
      }

      if (
        options.color &&
        entry.options?.color &&
        entry.options.color !== options.color
      ) {
        return false;
      }

      if (entry.options?.size) {
        return entry.options.size === size;
      }

      return true;
    })
  );
}

export function getSkuCatalog() {
  const map = new Map();

  for (const product of products) {
    for (const entry of getProductSkuEntries(product)) {
      map.set(entry.sku, entry);
    }
  }

  return map;
}

export function getProductSkus(product) {
  return getProductSkuEntries(product).map((entry) => entry.sku);
}

export function getAllCatalogSkuEntries() {
  return products.flatMap(getProductSkuEntries);
}
