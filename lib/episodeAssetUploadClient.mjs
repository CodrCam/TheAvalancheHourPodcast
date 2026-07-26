function errorMessage(value, fallback) {
  const message = String(value?.error || '').trim();
  return message || fallback;
}

const BROWSER_NETWORK_ERROR_PATTERN =
  /(?:load failed|failed to fetch|network(?: request)? (?:error|failed)|networkerror|internet connection appears to be offline)/i;

const NETWORK_STAGE_MESSAGES = {
  authorization:
    'Episode Studio could not start the upload. Check your internet connection and try again.',
  storage:
    'The file could not reach secure storage. Check your internet connection, VPN, or content blocker and try again. If this continues, ask an administrator to check upload storage access.',
  completion:
    'The file may have reached secure storage, but Episode Studio could not confirm that it was attached. Check your connection, refresh the episode, and confirm the file is absent before retrying.',
};

export function isEpisodeAssetBrowserNetworkError(error) {
  const message = String(error?.message || error || '').trim();
  return (
    (error?.name === 'TypeError' ||
      error?.name === 'NetworkError' ||
      error instanceof TypeError) &&
    BROWSER_NETWORK_ERROR_PATTERN.test(message)
  );
}

export function episodeAssetUploadStageError(error, stage) {
  if (!isEpisodeAssetBrowserNetworkError(error)) {
    return error instanceof Error
      ? error
      : new Error(String(error || 'Could not upload this file.'));
  }
  const message =
    NETWORK_STAGE_MESSAGES[stage] ||
    'The upload was interrupted by a network error. Check your connection and try again.';
  const stageError = new Error(message);
  stageError.code = `EPISODE_ASSET_${String(stage || 'upload').toUpperCase()}_NETWORK_ERROR`;
  return stageError;
}

function canonicalUploadFile(file, upload) {
  const contentType = String(upload?.content_type || '').trim();
  if (!contentType || file.type === contentType) return file;
  return new File([file], upload.file_name || file.name, {
    type: contentType,
    lastModified: file.lastModified,
  });
}

function isCrossOriginUpload(uploadUrl, currentOrigin) {
  const cleanOrigin = String(currentOrigin || '').trim();
  if (!cleanOrigin) return false;
  try {
    return (
      new URL(uploadUrl, `${cleanOrigin}/`).origin !==
      new URL(cleanOrigin).origin
    );
  } catch {
    return false;
  }
}

export async function uploadAuthorizedFile(
  file,
  upload = {},
  {
    fetchImpl = globalThis.fetch,
    currentOrigin = globalThis.location?.origin,
  } = {}
) {
  const method = String(
    upload.upload_method || (upload.upload_fields ? 'POST' : 'PUT')
  ).toUpperCase();
  const bodyFile = canonicalUploadFile(file, upload);

  if (method === 'POST') {
    const body = new FormData();
    Object.entries(upload.upload_fields || {}).forEach(([name, value]) => {
      body.append(name, String(value));
    });
    body.append('file', bodyFile);
    const crossOrigin = isCrossOriginUpload(
      upload.upload_url,
      currentOrigin
    );
    return fetchImpl(upload.upload_url, {
      method: 'POST',
      body,
      ...(crossOrigin ? { mode: 'no-cors' } : {}),
    });
  }

  if (method !== 'PUT') {
    throw new Error('The upload service returned an unsupported upload method.');
  }

  return fetchImpl(upload.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type':
        String(upload.content_type || '').trim() ||
        bodyFile.type ||
        'application/octet-stream',
    },
    body: bodyFile,
  });
}

export function isEpisodeAssetUploadReadyForCompletion(response) {
  return response?.ok === true || response?.type === 'opaque';
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
      lastError = episodeAssetUploadStageError(error, 'completion');
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
