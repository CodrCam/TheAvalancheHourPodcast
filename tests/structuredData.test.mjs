import test from 'node:test';
import assert from 'node:assert/strict';
import { safeJsonLdStringify } from '../lib/structuredData.mjs';

test('escapes HTML-significant characters in embedded JSON-LD', () => {
  const serialized = safeJsonLdStringify({
    description: '</script><script>alert("stored-xss")</script>&',
  });

  assert.equal(serialized.includes('</script>'), false);
  assert.equal(serialized.includes('<script>'), false);
  assert.equal(serialized.includes('\\u003c/script\\u003e'), true);
  assert.equal(JSON.parse(serialized).description.includes('stored-xss'), true);
});
