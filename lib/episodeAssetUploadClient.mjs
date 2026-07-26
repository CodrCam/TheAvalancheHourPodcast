function errorMessage(value, fallback) {
  const message = String(value?.error || '').trim();
  return message || fallback;
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function completeEpisodeAssetUpload({
  episodeId,
  upload = {},
  deliverableId,
  fetchImpl = globalThis.fetch,
} = {}) {
  const cleanEpisodeId = String(episodeId || '').trim();
  const uploadToken = String(upload.upload_token || '').trim();
  const assetId = String(upload.asset_id || '').trim();
  const cleanDeliverableId = String(deliverableId || '').trim();
  if (
    !cleanEpisodeId ||
    !uploadToken ||
    !assetId ||
    !cleanDeliverableId ||
    typeof fetchImpl !== 'function'
  ) {
    throw new Error('The upload completion details are incomplete.');
  }

  const episodeEndpoint = `/api/studio/episodes/${encodeURIComponent(
    cleanEpisodeId
  )}`;
  const completionEndpoint = `${episodeEndpoint}/assets/complete`;
  let lastError = new Error(
    'Could not attach the uploaded file to the episode.'
  );

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let response;
    try {
      response = await fetchImpl(completionEndpoint, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          upload_token: uploadToken,
          deliverable_id: cleanDeliverableId,
        }),
      });
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error('The upload completion request was interrupted.');
      if (attempt === 0) continue;
      break;
    }

    const data = await readJson(response);
    const completedAsset = data?.episode?.assets?.find(
      (candidate) => candidate.asset_id === assetId
    );
    if (response.ok && completedAsset) {
      return {
        ...data,
        asset: data.asset || completedAsset,
      };
    }

    lastError = new Error(
      errorMessage(
        data,
        response.ok
          ? 'The file may have attached, but the server response was incomplete.'
          : 'Could not attach the uploaded file to the episode.'
      )
    );
    const retryable =
      response.ok ||
      response.status >= 500 ||
      data?.code === 'EPISODE_ASSET_COMPLETION_RACE';
    if (attempt === 0 && retryable) continue;
    break;
  }

  try {
    const response = await fetchImpl(episodeEndpoint, {
      credentials: 'same-origin',
    });
    const data = await readJson(response);
    const asset = data?.episode?.assets?.find(
      (candidate) => candidate.asset_id === assetId
    );
    if (response.ok && asset) {
      return {
        ok: true,
        already_completed: true,
        reconciled: true,
        episode: data.episode,
        asset,
      };
    }
  } catch {
    // Preserve the completion failure below. Reconciliation is best effort.
  }

  throw lastError;
}
