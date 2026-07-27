import { forwardRef } from 'react';
import { normalizeMultilinePlainText } from '../lib/plainText.mjs';

const PlainTextArea = forwardRef(function PlainTextArea(
  { value = '', maxLength, onValueChange, onChange, ...props },
  ref
) {
  function handleChange(event) {
    const nextValue = normalizeMultilinePlainText(
      event.target.value,
      maxLength
    );
    onValueChange?.(nextValue, event);
    onChange?.(event);
  }

  return (
    <textarea
      {...props}
      ref={ref}
      value={value ?? ''}
      maxLength={maxLength}
      onChange={handleChange}
      placeholder=""
      spellCheck="true"
      autoCapitalize="sentences"
      data-plain-text-input="true"
    />
  );
});

export default PlainTextArea;
