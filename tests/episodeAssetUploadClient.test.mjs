import test from 'node:test';
import assert from 'node:assert/strict';
import {
  completeEpisodeAssetUpload,
  episodeAssetStorageRejectionMessage,
  episodeAssetUploadStageError,
  isEpisodeAssetUploadReadyForCompletion,
  isEpisodeAssetBrowserNetworkError,
  isSafariEpisodeAssetUploadBrowser,
  uploadAuthorizedFile,
} from '../lib/episodeAssetUploadClient.mjs';

const upload = {
  asset_id: 'asset-one',
  upload_token: 'signed-upload-token',
};

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      return value;
    },
  };
}

test('recognizes Safari and other browser fetch failures without treating API errors as network failures', () => {
  assert.equal(
    isEpisodeAssetBrowserNetworkError(new TypeError('Load failed')),
    true
  );
  assert.equal(
    isEpisodeAssetBrowserNetworkError(new TypeError('Failed to fetch')),
    true
  );
  assert.equal(
    isEpisodeAssetBrowserNetworkError(
      Object.assign(new Error('NetworkError when attempting to fetch resource.'), {
        name: 'NetworkError',
      })
    ),
    true
  );
  assert.equal(
    isEpisodeAssetBrowserNetworkError(
      new Error('This file type is not supported.')
    ),
    false
  );
});

test('replaces raw browser network failures with stage-specific upload guidance', () => {
  const stages = {
    authorization: /could not start the upload/i,
    storage: /could not reach secure storage/i,
    completion: /may have reached secure storage/i,
  };

  for (const [stage, expected] of Object.entries(stages)) {
    const error = episodeAssetUploadStageError(
      new TypeError('Load failed'),
      stage
    );
    assert.match(error.message, expected);
    assert.doesNotMatch(error.message, /load failed/i);
  }
});

test('preserves specific non-network validation errors', () => {
  const validationError = new Error('This file type is not supported.');
  assert.equal(
    episodeAssetUploadStageError(validationError, 'authorization'),
    validationError
  );
});

test('recognizes Safari without treating other WebKit-branded browsers as Safari', () => {
  assert.equal(
    isSafariEpisodeAssetUploadBrowser(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15'
    ),
    true
  );
  assert.equal(
    isSafariEpisodeAssetUploadBrowser(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
    ),
    false
  );
  assert.equal(
    isSafariEpisodeAssetUploadBrowser(
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/140.0.0.0 Mobile/15E148 Safari/604.1'
    ),
    false
  );
});

test('sends a cross-origin signed POST as no-cors and lets authoritative completion verify an opaque response', async () => {
  const file = new File(['audio bytes'], 'interview.wav', {
    type: 'audio/wav',
  });
  const requests = [];
  const opaqueResponse = { ok: false, status: 0, type: 'opaque' };
  const response = await uploadAuthorizedFile(
    file,
    {
      upload_url:
        'https://episode-assets.s3.us-east-2.amazonaws.com',
      upload_method: 'POST',
      upload_fields: {
        key: 'episodes/episode-one/other/asset-one-interview.wav',
        policy: 'signed-policy',
      },
      content_type: 'audio/wav',
    },
    {
      currentOrigin: 'http://localhost:3000',
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return opaqueResponse;
      },
    }
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.mode, 'no-cors');
  assert.equal(
    requests[0].options.body.get('key'),
    'episodes/episode-one/other/asset-one-interview.wav'
  );
  assert.equal(requests[0].options.body.get('file').name, 'interview.wav');
  assert.equal(response, opaqueResponse);
  assert.equal(isEpisodeAssetUploadReadyForCompletion(response), true);
});

test('uses the proven fetch form path for Safari even when upload progress is requested', async () => {
  const file = new File(['image bytes'], 'IMG_5319.jpeg', {
    type: 'image/jpeg',
  });
  const requests = [];
  const progress = [];
  const opaqueResponse = { ok: false, status: 0, type: 'opaque' };
  const response = await uploadAuthorizedFile(
    file,
    {
      upload_url:
        'https://episode-assets.s3.us-east-2.amazonaws.com',
      upload_method: 'POST',
      upload_fields: {
        key: 'episodes/episode-one/image/asset-one-IMG_5319.jpeg',
        policy: 'signed-policy',
      },
      content_type: 'image/jpeg',
    },
    {
      currentOrigin: 'https://theavalanchehour.com',
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
      onProgress: (event) => progress.push(event),
      xhrFactory() {
        throw new Error('Safari must not use the progress XHR path.');
      },
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return opaqueResponse;
      },
    }
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.mode, 'no-cors');
  assert.equal(
    requests[0].options.body.get('file').name,
    'IMG_5319.jpeg'
  );
  assert.deepEqual(progress, [
    {
      loaded: 0,
      total: file.size,
      percent: 0,
      indeterminate: true,
    },
  ]);
  assert.equal(response, opaqueResponse);
  assert.equal(isEpisodeAssetUploadReadyForCompletion(response), true);
});

test('keeps same-origin POST responses readable and rejects a readable storage failure', async () => {
  const file = new File(['document bytes'], 'notes.pdf', {
    type: 'application/pdf',
  });
  const requests = [];
  const rejectedResponse = { ok: false, status: 403, type: 'basic' };
  const response = await uploadAuthorizedFile(
    file,
    {
      upload_url: 'http://localhost:3000/test-upload',
      upload_method: 'POST',
      upload_fields: { key: 'test-key' },
      content_type: 'application/pdf',
    },
    {
      currentOrigin: 'http://localhost:3000',
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return rejectedResponse;
      },
    }
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.mode, undefined);
  assert.equal(response, rejectedResponse);
  assert.equal(isEpisodeAssetUploadReadyForCompletion(response), false);
});

test('reports bounded browser upload progress before returning the S3 response', async () => {
  const file = new File(['1234567890'], 'interview.wav', {
    type: 'audio/wav',
  });
  const progress = [];
  const requests = [];
  class FakeXhr {
    constructor() {
      this.listeners = {};
      this.upload = {
        addEventListener: (name, listener) => {
          this.uploadListener = { name, listener };
        },
      };
      this.status = 204;
      this.responseText = '';
    }

    open(method, url, async) {
      requests.push({ method, url, async });
    }

    addEventListener(name, listener) {
      this.listeners[name] = listener;
    }

    send(body) {
      requests[0].body = body;
      this.uploadListener.listener({
        lengthComputable: true,
        loaded: 25,
        total: 100,
      });
      this.uploadListener.listener({
        lengthComputable: true,
        loaded: 100,
        total: 100,
      });
      this.listeners.load();
    }
  }

  const response = await uploadAuthorizedFile(
    file,
    {
      upload_url: 'https://episode-assets.s3.us-east-2.amazonaws.com',
      upload_method: 'POST',
      upload_fields: { key: 'test-key', policy: 'signed-policy' },
      content_type: 'audio/wav',
    },
    {
      onProgress: (event) => progress.push(event),
      xhrFactory: () => new FakeXhr(),
    }
  );

  assert.deepEqual(requests[0].method, 'POST');
  assert.equal(requests[0].body.get('file').name, 'interview.wav');
  assert.deepEqual(progress, [
    { loaded: 3, total: 10, percent: 30 },
    { loaded: 10, total: 10, percent: 100 },
  ]);
  assert.equal(response.ok, true);
  assert.equal(response.status, 204);
});

test('turns readable S3 XML into a useful storage rejection', () => {
  const message = episodeAssetStorageRejectionMessage({
    status: 400,
    response_text:
      '<Error><Code>InvalidPolicyDocument</Code><Message>Policy Condition failed</Message></Error>',
  });

  assert.match(message, /HTTP 400/i);
  assert.match(message, /did not match the signed file rules/i);
  assert.match(message, /Storage code: InvalidPolicyDocument/i);
  assert.doesNotMatch(message, /Policy Condition failed/i);
});

test('turns an interrupted progress upload into the existing network guidance', async () => {
  class FailingXhr {
    constructor() {
      this.listeners = {};
      this.upload = { addEventListener() {} };
    }

    open() {}

    addEventListener(name, listener) {
      this.listeners[name] = listener;
    }

    send() {
      this.listeners.error();
    }
  }

  await assert.rejects(
    uploadAuthorizedFile(
      new File(['audio'], 'interview.wav', { type: 'audio/wav' }),
      {
        upload_url: 'https://episode-assets.s3.us-east-2.amazonaws.com',
        upload_method: 'POST',
        upload_fields: { key: 'test-key' },
        content_type: 'audio/wav',
      },
      {
        onProgress() {},
        xhrFactory: () => new FailingXhr(),
      }
    ),
    (error) => {
      assert.equal(isEpisodeAssetBrowserNetworkError(error), true);
      return true;
    }
  );
});

test('keeps legacy signed PUT behavior readable without no-cors mode', async () => {
  const file = new File(['audio bytes'], 'interview.wav', {
    type: 'audio/wav',
  });
  const requests = [];
  const response = await uploadAuthorizedFile(
    file,
    {
      upload_url:
        'https://episode-assets.s3.us-east-2.amazonaws.com/test-key',
      upload_method: 'PUT',
      content_type: 'audio/wav',
    },
    {
      currentOrigin: 'http://localhost:3000',
      fetchImpl: async (url, options) => {
        requests.push({ url, options });
        return { ok: true, status: 200, type: 'cors' };
      },
    }
  );

  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, 'PUT');
  assert.equal(requests[0].options.mode, undefined);
  assert.equal(requests[0].options.headers['Content-Type'], 'audio/wav');
  assert.equal(isEpisodeAssetUploadReadyForCompletion(response), true);
});

test('retries an interrupted completion with the same idempotent token', async () => {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    if (requests.length === 1) throw new Error('connection dropped');
    return jsonResponse({
      ok: true,
      already_completed: true,
      episode: { assets: [{ asset_id: upload.asset_id }] },
    });
  };

  const result = await completeEpisodeAssetUpload({
    episodeId: 'episode-one',
    upload,
    deliverableId: 'episode-folder',
    fetchImpl,
  });

  assert.equal(result.already_completed, true);
  assert.equal(requests.length, 2);
  for (const request of requests) {
    const body = JSON.parse(request.options.body);
    assert.equal(body.upload_token, upload.upload_token);
    assert.equal(body.deliverable_id, 'episode-folder');
  }
});

test('retries an invalid server response before reporting failure', async () => {
  let attempts = 0;
  const fetchImpl = async () => {
    attempts += 1;
    if (attempts === 1) {
      return {
        ok: false,
        status: 502,
        async json() {
          throw new Error('HTML response');
        },
      };
    }
    return jsonResponse({
      ok: true,
      episode: { assets: [{ asset_id: upload.asset_id }] },
    });
  };

  const result = await completeEpisodeAssetUpload({
    episodeId: 'episode-one',
    upload,
    deliverableId: 'episode-folder',
    fetchImpl,
  });

  assert.equal(result.episode.assets[0].asset_id, upload.asset_id);
  assert.equal(attempts, 2);
});

test('reconciles a completed asset after both responses are lost', async () => {
  let completionAttempts = 0;
  const fetchImpl = async (url) => {
    if (url.endsWith('/assets/complete')) {
      completionAttempts += 1;
      throw new Error('response lost');
    }
    return jsonResponse({
      ok: true,
      episode: {
        assets: [
          {
            asset_id: upload.asset_id,
            file_name: 'interview.wav',
          },
        ],
      },
    });
  };

  const result = await completeEpisodeAssetUpload({
    episodeId: 'episode-one',
    upload,
    deliverableId: 'episode-folder',
    fetchImpl,
  });

  assert.equal(completionAttempts, 2);
  assert.equal(result.reconciled, true);
  assert.equal(result.asset.file_name, 'interview.wav');
});

test('does not retry a clear client rejection when the asset is absent', async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    if (url.endsWith('/assets/complete')) {
      return jsonResponse(
        { ok: false, error: 'This file is not supported.' },
        400
      );
    }
    return jsonResponse({ ok: true, episode: { assets: [] } });
  };

  await assert.rejects(
    completeEpisodeAssetUpload({
      episodeId: 'episode-one',
      upload,
      deliverableId: 'episode-folder',
      fetchImpl,
    }),
    /not supported/i
  );
  assert.equal(
    requests.filter((url) => url.endsWith('/assets/complete')).length,
    1
  );
});

test('does not expose Safari Load failed when completion and reconciliation are unreachable', async () => {
  await assert.rejects(
    completeEpisodeAssetUpload({
      episodeId: 'episode-one',
      upload,
      deliverableId: 'episode-folder',
      fetchImpl: async () => {
        throw new TypeError('Load failed');
      },
    }),
    (error) => {
      assert.match(error.message, /may have reached secure storage/i);
      assert.doesNotMatch(error.message, /load failed/i);
      return true;
    }
  );
});
