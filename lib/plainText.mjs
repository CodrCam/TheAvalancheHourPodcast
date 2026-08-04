export function normalizeMultilinePlainText(value = '', maxLength = Infinity) {
  const normalized = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n');
  const limit = Number(maxLength);

  return Number.isFinite(limit) && limit >= 0
    ? normalized.slice(0, Math.trunc(limit))
    : normalized;
}

function clampSelection(value, position, fallback) {
  const parsed = Number(position);

  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(value.length, Math.max(0, Math.trunc(parsed)));
}

/**
 * Builds the value and caret position for an explicit plain-text paste.
 *
 * The paste allowance is calculated around the selected text so a field at
 * its character limit can still replace a selection. Existing text after the
 * selection is preserved instead of being unexpectedly truncated.
 */
export function createPlainTextPasteResult(
  value = '',
  pastedText = '',
  {
    selectionStart,
    selectionEnd,
    maxLength = Infinity,
  } = {}
) {
  const currentValue = normalizeMultilinePlainText(value, maxLength);
  const start = clampSelection(currentValue, selectionStart, currentValue.length);
  const end = Math.max(
    start,
    clampSelection(currentValue, selectionEnd, start)
  );
  const before = currentValue.slice(0, start);
  const after = currentValue.slice(end);
  const normalizedPaste = normalizeMultilinePlainText(pastedText);
  const parsedLimit = Number(maxLength);
  const availablePasteLength =
    Number.isFinite(parsedLimit) && parsedLimit >= 0
      ? Math.max(0, Math.trunc(parsedLimit) - before.length - after.length)
      : normalizedPaste.length;
  const insertedText = normalizedPaste.slice(0, availablePasteLength);
  const nextSelection = before.length + insertedText.length;

  return {
    value: `${before}${insertedText}${after}`,
    selectionStart: nextSelection,
    selectionEnd: nextSelection,
  };
}
