import test from 'node:test';
import assert from 'node:assert/strict';
import { completeEpisodeAssetUpload } from '../lib/episodeAssetUploadClient.mjs';

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
