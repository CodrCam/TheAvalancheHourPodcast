import { forwardRef, useId, useState } from 'react';
import {
  createPlainTextPasteResult,
  normalizeMultilinePlainText,
} from '../lib/plainText.mjs';
import styles from '../styles/PlainTextArea.module.css';

const PlainTextArea = forwardRef(function PlainTextArea(
  {
    value = '',
    maxLength,
    onValueChange,
    onChange,
    onPaste,
    className = '',
    style,
    expandable = true,
    expandedMinHeight = 'clamp(18rem, 58vh, 36rem)',
    onExpandedChange,
    ...props
  },
  ref
) {
  const generatedId = useId().replace(/:/g, '');
  const [expanded, setExpanded] = useState(false);
  const textareaId = props.id || `plain-text-area-${generatedId}`;

  function emitValueChange(nextValue, event) {
    // Keep both supported APIs useful. For a paste, currentTarget is the real
    // textarea and its value is updated before either callback is invoked.
    onValueChange?.(nextValue, event);
    onChange?.(event);
  }

  function handleChange(event) {
    const nextValue = normalizeMultilinePlainText(
      event.target.value,
      maxLength
    );
    emitValueChange(nextValue, event);
  }

  function handlePaste(event) {
    onPaste?.(event);
    if (event.defaultPrevented || !event.clipboardData) return;

    event.preventDefault();

    const textarea = event.currentTarget;
    const pasteResult = createPlainTextPasteResult(
      textarea.value,
      event.clipboardData.getData('text/plain'),
      {
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
        maxLength,
      }
    );

    // Reflect the inserted value on the real target before notifying callers.
    // Controlled parents then make that same value durable on their rerender.
    textarea.value = pasteResult.value;
    textarea.setSelectionRange(
      pasteResult.selectionStart,
      pasteResult.selectionEnd
    );
    emitValueChange(pasteResult.value, event);
  }

  function toggleExpanded(event) {
    event.preventDefault();
    event.stopPropagation();
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    onExpandedChange?.(nextExpanded);
  }

  function handleExpandKeyDown(event) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    toggleExpanded(event);
  }

  return (
    <span
      className={`${styles.field} ${expanded ? styles.expanded : ''}`}
      data-writing-area-expanded={expanded ? 'true' : 'false'}
    >
      <textarea
        {...props}
        id={textareaId}
        ref={ref}
        className={className}
        style={{
          ...style,
          resize: 'vertical',
          ...(expanded
            ? {
                height: expandedMinHeight,
                minHeight: expandedMinHeight,
              }
            : null),
        }}
        value={value ?? ''}
        maxLength={maxLength}
        onChange={handleChange}
        onPaste={handlePaste}
        placeholder=""
        spellCheck="true"
        autoCapitalize="sentences"
        data-plain-text-input="true"
      />
      {expandable ? (
        <span className={styles.controlRow}>
          <span
            className={styles.expandControl}
            role="button"
            tabIndex={0}
            aria-controls={textareaId}
            aria-expanded={expanded}
            onClick={toggleExpanded}
            onKeyDown={handleExpandKeyDown}
          >
            {expanded ? 'Collapse writing area' : 'Expand writing area'}
          </span>
        </span>
      ) : null}
    </span>
  );
});

export default PlainTextArea;
