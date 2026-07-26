import { products as staticProducts } from '../src/data/products.js';
import {
  getProductSkuEntries,
  getSkuForOptions,
} from './productCatalog.js';
import {
  isDynamoProductCatalogConfigured,
  listCatalogProducts,
} from './productCatalogStore.js';
import { isProductVisibleOnStorefront } from './productCatalogPresentation.mjs';

function normalizeRequestedOptions(value = {}) {
  return Object.fromEntries(
    ['style', 'color', 'size']
      .map((key) => [key, String(value?.[key] || '').trim()])
      .filter(([, option]) => option)
  );
}

async function loadChargeableProducts() {
  if (!isDynamoProductCatalogConfigured()) {
    return process.env.NODE_ENV === 'production' ? [] : staticProducts;
  }
  return listCatalogProducts();
}

async function loadOrderReferenceProducts() {
  if (!isDynamoProductCatalogConfigured()) {
    return process.env.NODE_ENV === 'production' ? [] : staticProducts;
  }
  return listCatalogProducts({ includeBackendOnly: true });
}

function checkoutValidationError(message) {
  const error = new Error(message);
  error.isCatalogCheckoutValidationError = true;
  return error;
}

export async function resolveCheckoutItems(rawItems = [], options = {}) {
  const products = options.products || (await loadChargeableProducts());
  const productById = new Map(
    products
      .filter((product) => isProductVisibleOnStorefront(product))
      .map((product) => [product.id, product])
  );
  const clean = [];

  for (const raw of Array.isArray(rawItems) ? rawItems : []) {
    const product = productById.get(String(raw?.id || '').trim());
    if (!product) {
      throw checkoutValidationError(
        'A product in this cart is no longer available.'
      );
    }
    const qty = Math.max(
      0,
      Math.min(Math.trunc(Number(raw?.qty) || 0), 100)
    );
    if (!qty) continue;

    const entries = getProductSkuEntries(product);
    const requestedSku = String(raw?.sku || '').trim();
    const requestedOptions = normalizeRequestedOptions(raw?.options);
    const derivedSku =
      requestedSku || getSkuForOptions(product, requestedOptions);
    const entry = entries.find((candidate) => candidate.sku === derivedSku);
    if (!entry) {
      throw checkoutValidationError(
        `${product.name} has changed. Remove it from the cart and choose it again.`
      );
    }
    const price = Math.trunc(Number(entry.price ?? product.price) || 0);
    if (price <= 0) {
      throw checkoutValidationError(
        `${product.name} does not have a valid price.`
      );
    }

    clean.push({
      id: product.id,
      sku: entry.sku,
      name: product.name || product.id,
      price,
      qty,
      options: entry.options || {},
    });
  }

  return clean;
}

export async function resolveRecordedOrderItems(rawItems = [], options = {}) {
  const products =
    options.products || (await loadOrderReferenceProducts());
  const skuReferences = new Map(
    products.flatMap((product) =>
      getProductSkuEntries(product).map((entry) => [
        entry.sku,
        { product, entry },
      ])
    )
  );
  const quantities = new Map();

  for (const raw of Array.isArray(rawItems) ? rawItems : []) {
    const sku = String(raw?.sku || '').trim();
    const qty = Math.max(0, Math.min(Math.trunc(Number(raw?.qty) || 0), 100));
    if (!sku || !qty) continue;
    quantities.set(sku, (quantities.get(sku) || 0) + qty);
  }

  return [...quantities.entries()].map(([sku, qty]) => {
    const reference = skuReferences.get(sku);
    if (!reference) {
      return {
        sku,
        qty,
        name: sku,
        options: {},
      };
    }
    const { product, entry } = reference;
    return {
      id: product.id,
      sku,
      qty,
      name: product.name || sku,
      price: Math.trunc(Number(entry.price ?? product.price) || 0),
      options: entry.options || {},
      image: entry.image || product.image || '',
    };
  });
}
