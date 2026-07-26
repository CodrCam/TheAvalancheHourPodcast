export const PRODUCT_CATALOG_STATUSES = Object.freeze({
  DRAFT: 'draft',
  LIVE: 'live',
  STANDBY: 'standby',
  ARCHIVED: 'archived',
});

const PRODUCT_CATALOG_STATUS_VALUES = new Set(
  Object.values(PRODUCT_CATALOG_STATUSES)
);

function readInventoryRecord(inventoryBySku, sku) {
  if (inventoryBySku instanceof Map) {
    return inventoryBySku.get(sku);
  }

  if (inventoryBySku && typeof inventoryBySku === 'object') {
    return inventoryBySku[sku];
  }

  return null;
}

export function normalizeProductCatalogStatus(value, activeFallback = true) {
  const status = String(value || '').trim().toLowerCase();
  if (PRODUCT_CATALOG_STATUS_VALUES.has(status)) return status;
  return activeFallback === false
    ? PRODUCT_CATALOG_STATUSES.STANDBY
    : PRODUCT_CATALOG_STATUSES.LIVE;
}

export function isProductVisibleOnStorefront(product = {}) {
  return (
    normalizeProductCatalogStatus(product.status, product.active) ===
    PRODUCT_CATALOG_STATUSES.LIVE
  );
}

export function getProductInventorySummary(skus = [], inventoryBySku = {}) {
  const uniqueSkus = [
    ...new Set(
      (Array.isArray(skus) ? skus : [])
        .map((sku) => String(sku || '').trim())
        .filter(Boolean)
    ),
  ];
  const listedSkus = [];
  const inStockSkus = [];
  let availableQuantity = 0;

  for (const sku of uniqueSkus) {
    const record = readInventoryRecord(inventoryBySku, sku);
    if (record?.hidden === true) continue;

    listedSkus.push(sku);
    const quantity = Math.max(0, Math.trunc(Number(record?.quantity) || 0));
    availableQuantity += quantity;
    if (quantity > 0) inStockSkus.push(sku);
  }

  const isStandby = uniqueSkus.length > 0 && listedSkus.length === 0;
  const isSoldOut =
    !isStandby && listedSkus.length > 0 && availableQuantity === 0;

  return {
    skuCount: uniqueSkus.length,
    listedSkuCount: listedSkus.length,
    inStockSkuCount: inStockSkus.length,
    listedSkus,
    inStockSkus,
    availableQuantity,
    isStandby,
    isSoldOut,
    isAvailable: availableQuantity > 0,
  };
}

export function getProductStorefrontState(
  product,
  skus,
  inventoryBySku,
  options = {}
) {
  const catalogStatus = normalizeProductCatalogStatus(
    product?.status,
    product?.active
  );
  const catalogVisible = catalogStatus === PRODUCT_CATALOG_STATUSES.LIVE;
  const inventoryKnown = options.inventoryKnown !== false;
  const inventory = getProductInventorySummary(skus, inventoryBySku);
  const isStandby = !catalogVisible || (inventoryKnown && inventory.isStandby);
  const isSoldOut =
    catalogVisible && inventoryKnown && !isStandby && inventory.isSoldOut;

  return {
    catalogStatus,
    catalogVisible,
    inventoryKnown,
    inventory,
    isStandby,
    isSoldOut,
    isAvailable:
      catalogVisible && inventoryKnown && !isStandby && inventory.isAvailable,
  };
}
