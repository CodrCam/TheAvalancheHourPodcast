import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMultilinePlainText } from '../lib/plainText.mjs';

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
