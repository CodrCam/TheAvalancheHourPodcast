function errorMessage(value, fallback) {
  const message = String(value?.error || '').trim();
  return message || fallback;
}

const BROWSER_NETWORK_ERROR_PATTERN =
  /(?:load failed|failed to fetch|network(?: request)? (?:error|failed)|networkerror|internet connection appears to be offline)/i;

const NON_SAFARI_BROWSER_PATTERN =
  /(?:android|chrome|chromium|crios|edg|edgios|fxios|opr|opios)/i;

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

export function shouldReconcileEpisodeAssetUpload({ response, error } = {}) {
  if (error) return isEpisodeAssetBrowserNetworkError(error);
  const status = Number(response?.status) || 0;
  return status === 409 || status === 412;
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

export function isSafariEpisodeAssetUploadBrowser(userAgent) {
  const value = String(userAgent || '').trim();
  return (
    /safari\//i.test(value) &&
    /version\//i.test(value) &&
    !NON_SAFARI_BROWSER_PATTERN.test(value)
  );
}

function xmlElementValue(value, elementName) {
  const match = String(value || '').match(
    new RegExp(`<${elementName}>([\\s\\S]*?)<\\/${elementName}>`, 'i')
  );
  return String(match?.[1] || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .trim();
}

export function episodeAssetStorageRejectionMessage(response) {
  const status = Number(response?.status) || 0;
  const responseText = String(
    response?.response_text || response?.responseText || ''
  );
  const code = xmlElementValue(responseText, 'Code');
  const messagesByCode = {
    EntityTooLarge:
      'The browser sent more bytes than this file was authorized to use.',
    EntityTooSmall:
      'The browser sent fewer bytes than this file was authorized to use.',
    InvalidPolicyDocument:
      'The browser upload did not match the signed file rules.',
    MalformedPOSTRequest:
      'The browser sent an unreadable upload form.',
    MaxPostPreDataLengthExceededError:
      'The browser added too much data before the file.',
    UserKeyMustBeSpecified:
      'The browser omitted or reordered a required upload field.',
  };
  const detail = messagesByCode[code];
  return [
    `Secure storage rejected the upload${status ? ` (HTTP ${status})` : ''}.`,
    detail || '',
    code ? `Storage code: ${code}.` : '',
    'Try again. If this continues, ask an administrator to check upload storage access.',
  ]
    .filter(Boolean)
    .join(' ');
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

function uploadWithProgress(
  uploadUrl,
  body,
  fileSize,
  onProgress,
  xhrFactory,
  { method = 'POST', headers = {} } = {}
) {
  return new Promise((resolve, reject) => {
    const xhr = xhrFactory();
    xhr.open(method, uploadUrl, true);
    Object.entries(headers).forEach(([name, value]) => {
      xhr.setRequestHeader?.(name, String(value));
    });
    xhr.upload.addEventListener('progress', (event) => {
      const requestTotal = Number(event.total) || 0;
      const requestLoaded = Number(event.loaded) || 0;
      const ratio =
        event.lengthComputable && requestTotal > 0
          ? Math.min(1, requestLoaded / requestTotal)
          : 0;
      const loaded = ratio
        ? Math.round(fileSize * ratio)
        : Math.min(fileSize, Math.max(0, requestLoaded));
      onProgress({
        loaded,
        total: fileSize,
        percent: fileSize > 0 ? Math.min(100, (loaded / fileSize) * 100) : 0,
      });
    });
    xhr.addEventListener('load', () => {
      const status = Number(xhr.status) || 0;
      resolve({
        ok: status >= 200 && status < 300,
        status,
        type: 'cors',
        response_text: String(xhr.responseText || ''),
      });
    });
    const rejectNetworkFailure = () => {
      reject(new TypeError('Failed to fetch'));
    };
    xhr.addEventListener('error', rejectNetworkFailure);
    xhr.addEventListener('abort', rejectNetworkFailure);
    xhr.addEventListener('timeout', rejectNetworkFailure);
    xhr.send(body);
  });
}

export async function uploadAuthorizedFile(
  file,
  upload = {},
  {
    fetchImpl = globalThis.fetch,
    currentOrigin = globalThis.location?.origin,
    onProgress,
    userAgent = globalThis.navigator?.userAgent,
    xhrFactory =
      typeof globalThis.XMLHttpRequest === 'function'
        ? () => new globalThis.XMLHttpRequest()
        : null,
  } = {}
) {
  const method = String(
    upload.upload_method || (upload.upload_fields ? 'POST' : 'PUT')
  ).toUpperCase();
  const bodyFile = canonicalUploadFile(file, upload);
  const authorizedSize = Number(upload.size);
  if (
    Number.isFinite(authorizedSize) &&
    authorizedSize >= 0 &&
    bodyFile.size !== authorizedSize
  ) {
    throw new Error(
      'The selected file no longer matches its upload authorization. Start the upload again.'
    );
  }

  if (method === 'POST') {
    const body = new FormData();
    Object.entries(upload.upload_fields || {}).forEach(([name, value]) => {
      body.append(name, String(value));
    });
    body.append('file', bodyFile);
    const useProgressRequest =
      typeof onProgress === 'function' &&
      typeof xhrFactory === 'function' &&
      !isSafariEpisodeAssetUploadBrowser(userAgent);
    if (useProgressRequest) {
      return uploadWithProgress(
        upload.upload_url,
        body,
        bodyFile.size,
        onProgress,
        xhrFactory
      );
    }
    if (
      typeof onProgress === 'function' &&
      isSafariEpisodeAssetUploadBrowser(userAgent)
    ) {
      onProgress({
        loaded: 0,
        total: bodyFile.size,
        percent: 0,
        indeterminate: true,
      });
    }
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

  const headers = {
    ...(upload.upload_headers || {}),
    'Content-Type':
      String(upload.content_type || '').trim() ||
      bodyFile.type ||
      'application/octet-stream',
  };
  const useProgressRequest =
    typeof onProgress === 'function' &&
    typeof xhrFactory === 'function' &&
    !isSafariEpisodeAssetUploadBrowser(userAgent);
  if (useProgressRequest) {
    return uploadWithProgress(
      upload.upload_url,
      bodyFile,
      bodyFile.size,
      onProgress,
      xhrFactory,
      { method: 'PUT', headers }
    );
  }
  if (
    typeof onProgress === 'function' &&
    isSafariEpisodeAssetUploadBrowser(userAgent)
  ) {
    onProgress({
      loaded: 0,
      total: bodyFile.size,
      percent: 0,
      indeterminate: true,
    });
  }

  return fetchImpl(upload.upload_url, {
    method: 'PUT',
    headers,
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
