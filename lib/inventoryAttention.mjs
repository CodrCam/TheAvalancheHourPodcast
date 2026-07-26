export function isInventoryAttentionMuted(row = {}) {
  if (row.attention_muted !== true) return false;

  return (
    String(row.attention_muted_for_updated_at ?? '') ===
    String(row.updated_at ?? '')
  );
}
