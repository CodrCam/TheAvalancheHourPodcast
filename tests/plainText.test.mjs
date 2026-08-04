import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPlainTextPasteResult,
  normalizeMultilinePlainText,
} from '../lib/plainText.mjs';

test('preserves pasted bullets and line breaks as plain text', () => {
  assert.equal(
    normalizeMultilinePlainText('First line\r\n• First item\r• Second item'),
    'First line\n• First item\n• Second item'
  );
});

test('normalizes Safari line separators without flattening content', () => {
  assert.equal(
    normalizeMultilinePlainText('Intro\u2028- one\u2029- two'),
    'Intro\n- one\n- two'
  );
});

test('applies a field limit after newline normalization', () => {
  assert.equal(normalizeMultilinePlainText('ab\r\ncd', 5), 'ab\ncd');
});

test('inserts pasted plain text at the caret and preserves lists', () => {
  assert.deepEqual(
    createPlainTextPasteResult('Intro\nOutro', '• One\r\n• Two\r', {
      selectionStart: 6,
      selectionEnd: 6,
    }),
    {
      value: 'Intro\n• One\n• Two\nOutro',
      selectionStart: 18,
      selectionEnd: 18,
    }
  );
});

test('plain-text paste replaces the selected range', () => {
  assert.deepEqual(
    createPlainTextPasteResult('Please replace this text', 'keep', {
      selectionStart: 7,
      selectionEnd: 19,
    }),
    {
      value: 'Please keep text',
      selectionStart: 11,
      selectionEnd: 11,
    }
  );
});

test('plain-text paste honors maxLength without dropping trailing content', () => {
  assert.deepEqual(
    createPlainTextPasteResult('Start END', '123456789', {
      selectionStart: 6,
      selectionEnd: 6,
      maxLength: 12,
    }),
    {
      value: 'Start 123END',
      selectionStart: 9,
      selectionEnd: 9,
    }
  );
});

test('selected text can be replaced when a field is already at maxLength', () => {
  assert.deepEqual(
    createPlainTextPasteResult('0123456789', 'ABCD', {
      selectionStart: 3,
      selectionEnd: 7,
      maxLength: 10,
    }),
    {
      value: '012ABCD789',
      selectionStart: 7,
      selectionEnd: 7,
    }
  );
});
