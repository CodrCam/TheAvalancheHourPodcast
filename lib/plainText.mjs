export function normalizeMultilinePlainText(value = '', maxLength = Infinity) {
  const normalized = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n');
  const limit = Number(maxLength);

  return Number.isFinite(limit) && limit >= 0
    ? normalized.slice(0, Math.trunc(limit))
    : normalized;
}
