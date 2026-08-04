function assetsForSlot(slot = {}) {
  if (Array.isArray(slot?.assets)) return slot.assets;
  return slot?.asset ? [slot.asset] : [];
}

export async function completeGuestQuestionnaireAssetUpload({
  token,
  uploadToken,
  fileName,
  slotKey,
  assetId,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (
    !token ||
    !uploadToken ||
    !slotKey ||
    !assetId ||
    typeof fetchImpl !== 'function'
  ) {
    throw new Error('The guest upload completion details are incomplete.');
  }
  let lastError = new Error(
    'The file uploaded, but it could not be attached. Please try again.'
  );
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetchImpl(
        '/api/guest-questionnaire/uploads/complete',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ upload_token: uploadToken }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.slot) return data;
      lastError = new Error(
        data.error ||
          `The file uploaded, but ${fileName} could not be attached.`
      );
      if (response.status < 500 && response.status !== 409) break;
    } catch (completionError) {
      lastError = completionError;
    }
  }

  try {
    const response = await fetchImpl('/api/guest-questionnaire', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    const slot =
      data.submission?.upload_slots?.[slotKey] ||
      data.response?.upload_slots?.[slotKey] ||
      data.upload_slots?.[slotKey];
    if (
      response.ok &&
      assetsForSlot(slot).some((asset) => asset.asset_id === assetId)
    ) {
      return {
        ok: true,
        already_completed: true,
        reconciled: true,
        slot,
      };
    }
  } catch {
    // Preserve the completion failure below. Reconciliation is best effort.
  }
  throw lastError;
}
