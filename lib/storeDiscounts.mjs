const MINIMUM_DISCOUNTED_SUBTOTAL_CENTS = 50;

export const STORE_DISCOUNT_CODES = Object.freeze({
  S10HOST40: Object.freeze({
    type: 'percent',
    value: 40,
    waiveShipping: true,
  }),
  TAHFRIENDS: Object.freeze({
    type: 'percent',
    value: 15,
    waiveShipping: false,
  }),
  ISSWPICKUP: Object.freeze({
    type: 'shipping',
    value: 0,
    waiveShipping: true,
  }),
});

export function normalizeStoreDiscountCode(rawCode) {
  return typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
}

export function isStoreDiscountCode(rawCode) {
  const normalized = normalizeStoreDiscountCode(rawCode);
  return Boolean(normalized && STORE_DISCOUNT_CODES[normalized]);
}

export function applyStoreDiscount(amountCents, rawCode) {
  const amount = Math.max(0, Math.round(Number(amountCents) || 0));
  const normalized = normalizeStoreDiscountCode(rawCode);
  const definition = normalized ? STORE_DISCOUNT_CODES[normalized] : null;

  if (!definition) {
    return {
      subtotalAfterDiscount: amount,
      discountAmountCents: 0,
      discountCode: null,
      shippingWaived: false,
    };
  }

  let requestedDiscountCents = 0;
  if (definition.type === 'percent') {
    requestedDiscountCents = Math.floor(
      (amount * definition.value) / 100
    );
  } else if (definition.type === 'fixed') {
    requestedDiscountCents = Math.max(
      0,
      Math.round(Number(definition.value) || 0)
    );
  }

  const minimumSubtotal = Math.min(
    amount,
    MINIMUM_DISCOUNTED_SUBTOTAL_CENTS
  );
  const subtotalAfterDiscount = Math.max(
    amount - requestedDiscountCents,
    minimumSubtotal
  );

  return {
    subtotalAfterDiscount,
    discountAmountCents: amount - subtotalAfterDiscount,
    discountCode: normalized,
    shippingWaived: Boolean(definition.waiveShipping),
  };
}
