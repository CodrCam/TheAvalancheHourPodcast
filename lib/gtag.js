export const GA_MEASUREMENT_ID =
  process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || '';

export const isGoogleAnalyticsEnabled = Boolean(GA_MEASUREMENT_ID);

function sendGtag(...args) {
  if (!isGoogleAnalyticsEnabled || typeof window === 'undefined') return;

  if (typeof window.gtag === 'function') {
    window.gtag(...args);
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(args);
}

export function pageview(url) {
  if (!isGoogleAnalyticsEnabled || typeof window === 'undefined') return;

  sendGtag('config', GA_MEASUREMENT_ID, {
    page_path: url,
  });
}

export function event(action, params = {}) {
  if (!isGoogleAnalyticsEnabled || typeof window === 'undefined') return;

  sendGtag('event', action, params);
}

export function formatAnalyticsItem(item = {}, overrides = {}) {
  const options = item.options || {};
  const variant = [options.style, options.size, options.color]
    .filter(Boolean)
    .join(' / ');

  return {
    item_id: item.sku || item.id || item.slug || item.name,
    item_name: item.name || item.title || item.id || 'Product',
    price: Number(item.price || 0) / 100,
    quantity: Number(item.qty || item.quantity || 1),
    ...(variant ? { item_variant: variant } : {}),
    ...overrides,
  };
}

export function ecommerceEvent(action, { items = [], value, ...params } = {}) {
  const analyticsItems = items.map((item) => formatAnalyticsItem(item));
  const computedValue =
    typeof value === 'number'
      ? value
      : analyticsItems.reduce(
          (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 1),
          0
        );

  event(action, {
    currency: 'USD',
    value: Number(computedValue.toFixed(2)),
    items: analyticsItems,
    ...params,
  });
}
