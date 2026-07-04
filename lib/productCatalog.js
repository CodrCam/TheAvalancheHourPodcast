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

export function getVariantImage(product, { style, color }) {
  if (!product) return null;

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
        });
      }
    }
  }

  return entries;
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
