import { products as staticProducts } from '../src/data/products.js';
import {
  getCatalogProductBySlug,
  isDynamoProductCatalogConfigured,
  listCatalogProducts,
} from './productCatalogStore.js';
import { isProductVisibleOnStorefront } from './productCatalogPresentation.mjs';

export const STOREFRONT_CATALOG_REVALIDATE_SECONDS = 60;

function publicStaticProducts(products = staticProducts) {
  return products.filter(isProductVisibleOnStorefront);
}

function reportFallback(logger, operation, error) {
  const message = String(error?.message || error || 'Unknown catalog error');
  logger?.error?.(
    `[storefront-catalog] DynamoDB ${operation} failed: ${message}`
  );
}

function allowStaticFallback(options = {}) {
  if (typeof options.allowStaticFallback === 'boolean') {
    return options.allowStaticFallback;
  }
  return process.env.NODE_ENV !== 'production';
}

export async function loadStorefrontCatalog(options = {}) {
  const configured =
    options.configured ?? isDynamoProductCatalogConfigured();
  const fallbackProducts = publicStaticProducts(
    options.fallbackProducts || staticProducts
  );

  if (!configured) {
    if (!allowStaticFallback(options)) {
      return {
        products: [],
        source: 'dynamodb-unconfigured',
      };
    }
    return {
      products: fallbackProducts,
      source: 'static-unconfigured',
    };
  }

  try {
    const products = await (options.listProducts || listCatalogProducts)();
    return {
      products: products.filter(isProductVisibleOnStorefront),
      source: 'dynamodb',
    };
  } catch (error) {
    reportFallback(options.logger || console, 'catalog read', error);
    if (!allowStaticFallback(options)) {
      return {
        products: [],
        source: 'dynamodb-unavailable',
      };
    }
    return {
      products: fallbackProducts,
      source: 'static-fallback',
    };
  }
}

export async function loadStorefrontProduct(slug, options = {}) {
  const cleanSlug = String(slug || '').trim().toLowerCase();
  if (!cleanSlug) {
    return { product: null, source: 'invalid-slug' };
  }

  const configured =
    options.configured ?? isDynamoProductCatalogConfigured();
  const fallbackProducts = publicStaticProducts(
    options.fallbackProducts || staticProducts
  );

  if (!configured) {
    if (!allowStaticFallback(options)) {
      return {
        product: null,
        source: 'dynamodb-unconfigured',
      };
    }
    return {
      product:
        fallbackProducts.find((product) => product.slug === cleanSlug) || null,
      source: 'static-unconfigured',
    };
  }

  try {
    const product = await (
      options.getProductBySlug || getCatalogProductBySlug
    )(cleanSlug);
    return {
      product:
        product && isProductVisibleOnStorefront(product) ? product : null,
      source: 'dynamodb',
    };
  } catch (error) {
    reportFallback(options.logger || console, 'product read', error);
    if (!allowStaticFallback(options)) {
      return {
        product: null,
        source: 'dynamodb-unavailable',
      };
    }
    return {
      product:
        fallbackProducts.find((product) => product.slug === cleanSlug) || null,
      source: 'static-fallback',
    };
  }
}
