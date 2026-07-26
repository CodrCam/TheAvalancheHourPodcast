import assert from 'node:assert/strict';
import test from 'node:test';
import { isInventoryAttentionMuted } from '../lib/inventoryAttention.mjs';

test('mutes only the exact inventory state that was acknowledged', () => {
  assert.equal(
    isInventoryAttentionMuted({
      attention_muted: true,
      attention_muted_for_updated_at: '2026-07-26T10:00:00.000Z',
      updated_at: '2026-07-26T10:00:00.000Z',
    }),
    true
  );
  assert.equal(
    isInventoryAttentionMuted({
      attention_muted: true,
      attention_muted_for_updated_at: '2026-07-26T10:00:00.000Z',
      updated_at: '2026-07-26T11:00:00.000Z',
    }),
    false
  );
});

test('supports legacy inventory rows with no updated timestamp', () => {
  assert.equal(
    isInventoryAttentionMuted({
      attention_muted: true,
      attention_muted_for_updated_at: '',
      updated_at: '',
    }),
    true
  );
  assert.equal(isInventoryAttentionMuted({ attention_muted: false }), false);
});
