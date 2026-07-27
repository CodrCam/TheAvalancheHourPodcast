const MAX_PRICE_CENTS = 1_000_000;

export function isProductPriceInput(value) {
  const text = String(value ?? '');
  if (!/^\d*(?:\.\d{0,2})?$/.test(text)) return false;
  if (!text || text === '.') return true;
  return Number(text) <= MAX_PRICE_CENTS / 100;
}

export function productPriceInputToCents(value) {
  const text = String(value ?? '');
  if (!text || text === '.' || !isProductPriceInput(text)) return null;
  return Math.round(Number(text) * 100);
}

export function formatProductPriceInput(value) {
  const cents = Math.max(
    0,
    Math.min(MAX_PRICE_CENTS, Math.trunc(Number(value) || 0))
  );
  return (cents / 100).toFixed(2);
}

export function isProductStockInput(value) {
  const text = String(value ?? '');
  if (!/^\d*$/.test(text)) return false;
  return !text || Number(text) <= Number.MAX_SAFE_INTEGER;
}

export function productStockInputToQuantity(value) {
  const text = String(value ?? '');
  if (!text || !isProductStockInput(text)) return null;
  return Math.max(0, Math.trunc(Number(text)));
}
