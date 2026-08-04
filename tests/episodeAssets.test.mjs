import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEpisodeAssetDownloadUrl,
  createEpisodeAssetUpload,
  deleteEpisodeAssetObject,
  deleteEpisodeAssetObjectVersionsForEpisode,
  listEpisodeAssetObjectVersions,
  sealEpisodeAssetObjectKey,
  validateEpisodeAssetContentSignature,
  validateEpisodeAssetInput,
  verifyEpisodeAssetContentSignature,
  verifyEpisodeAssetObject,
  verifyEpisodeAssetUploadToken,
} from '../lib/episodeAssetStorage.js';

process.env.EPISODE_ASSETS_S3_BUCKET = 'episode-assets';
process.env.EPISODE_ASSETS_S3_REGION = 'us-east-2';
process.env.EPISODE_ASSETS_ACCESS_KEY_ID = 'AKIATESTONLY';
process.env.EPISODE_ASSETS_SECRET_ACCESS_KEY = 'test-secret';
process.env.EPISODE_ASSETS_UPLOAD_TOKEN_SECRET = 'test-token-secret';

const MEBIBYTE = 1024 * 1024;

function createTestUpload(overrides = {}) {
  return createEpisodeAssetUpload({
    episodeId: 'episode-one',
    uploaderPersonId: 'host-one',
    deliverableId: 'episode-folder',
    file: {
      file_name: 'Episode Final.wav',
      content_type: 'audio/x-wav',
      size: 1024,
      category: 'other',
      ...overrides,
    },
  });
}

test('accepts bounded final audio and image uploads with accurate names', () => {
  assert.deepEqual(
    validateEpisodeAssetInput({
      file_name: 'Episode Final.wav',
      content_type: 'audio/x-wav',
      size: 1024,
      category: 'recording',
    }),
    {
      file_name: 'Episode Final.wav',
      content_type: 'audio/wav',
      size: 1024,
      category: 'recording',
    }
  );
  assert.equal(
    validateEpisodeAssetInput({
      file_name: 'cover.jpg',
      content_type: 'image/jpeg',
      size: 2048,
      category: 'image',
    }).category,
    'image'
  );
});

test('rejects mismatched and executable episode assets', () => {
  assert.throws(
    () =>
      validateEpisodeAssetInput({
        file_name: 'not-audio.pdf',
        content_type: 'application/pdf',
        size: 1024,
        category: 'recording',
      }),
    /not supported for this step/i
  );
  assert.throws(
    () =>
      validateEpisodeAssetInput({
        file_name: 'payload.exe',
        content_type: 'audio/wav',
        size: 1024,
        category: 'other',
      }),
    /not supported/i
  );
});

test('creates a one-write exact-MIME S3 upload bound to one deliverable', () => {
  const upload = createTestUpload();
  const payload = verifyEpisodeAssetUploadToken(
    upload.upload_token,
    'episode-one'
  );
  const uploadUrl = new URL(upload.upload_url);

  assert.equal(upload.upload_method, 'PUT');
  assert.equal(
    uploadUrl.origin,
    'https://episode-assets.s3.us-east-2.amazonaws.com'
  );
  assert.equal(decodeURIComponent(uploadUrl.pathname), `/${upload.object_key}`);
  assert.equal(
    uploadUrl.searchParams.get('X-Amz-SignedHeaders'),
    'content-length;content-type;host;if-none-match'
  );
  assert.deepEqual(upload.upload_headers, {
    'Content-Type': 'audio/wav',
    'If-None-Match': '*',
  });
  assert.equal(upload.upload_fields, undefined);
  assert.equal(payload.episode_id, 'episode-one');
  assert.equal(payload.deliverable_id, 'episode-folder');
  assert.equal(payload.uploader_person_id, 'host-one');
  assert.equal(payload.file_name, 'Episode Final.wav');
  assert.equal(payload.content_type, 'audio/wav');
  assert.match(payload.object_key, /^episodes\/episode-one\/other\/asset-/);
});

test('supports a shorter upload and completion window for public guest uploads', () => {
  const upload = createEpisodeAssetUpload({
    episodeId: 'episode-one',
    uploaderPersonId: 'guest-questionnaire-test',
    deliverableId: 'photos',
    file: {
      file_name: 'portrait.jpg',
      content_type: 'image/jpeg',
      size: 2048,
      category: 'image',
    },
    uploadExpirySeconds: 15 * 60,
    completionExpirySeconds: 60 * 60,
  });
  assert.equal(
    new URL(upload.upload_url).searchParams.get('X-Amz-Expires'),
    '900'
  );
  const issuedAt = Date.now();
  const uploadExpiry = new Date(upload.expires_at).getTime();
  const completionExpiry = new Date(upload.completion_expires_at).getTime();
  assert.ok(uploadExpiry >= issuedAt + 14 * 60 * 1000);
  assert.ok(uploadExpiry <= issuedAt + 16 * 60 * 1000);
  assert.ok(completionExpiry >= issuedAt + 59 * 60 * 1000);
  assert.ok(completionExpiry <= issuedAt + 61 * 60 * 1000);
});

test('authorizes an exact 1.5 GB audio object for completion verification', () => {
  const audioLimit = 1536 * MEBIBYTE;
  const upload = createTestUpload({
    file_name: 'Full Quality.wav',
    size: audioLimit,
    category: 'recording',
  });
  assert.equal(upload.size, audioLimit);
  assert.equal(upload.upload_method, 'PUT');
  assert.equal(upload.upload_headers['If-None-Match'], '*');
  assert.equal(
    new URL(upload.upload_url).searchParams.get('X-Amz-SignedHeaders'),
    'content-length;content-type;host;if-none-match'
  );
});

test('rejects tampered, cross-episode, and expired completion tokens', () => {
  const upload = createTestUpload();

  assert.throws(
    () =>
      verifyEpisodeAssetUploadToken(
        `${upload.upload_token}tampered`,
        'episode-one'
      ),
    /authorization is invalid/i
  );
  assert.throws(
    () =>
      verifyEpisodeAssetUploadToken(
        upload.upload_token,
        'another-episode'
      ),
    /authorization is invalid/i
  );

  const originalDateNow = Date.now;
  try {
    Date.now = () => originalDateNow() + 25 * 60 * 60 * 1000;
    assert.throws(
      () =>
        verifyEpisodeAssetUploadToken(
          upload.upload_token,
          'episode-one'
        ),
      /authorization has expired/i
    );
  } finally {
    Date.now = originalDateNow;
  }
});

test('verifies S3 metadata and captures the immutable object version', async (t) => {
  const upload = createTestUpload();
  const payload = verifyEpisodeAssetUploadToken(
    upload.upload_token,
    'episode-one'
  );
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  global.fetch = async () => ({
    ok: true,
    headers: {
      get(name) {
        return {
          'content-length': '1024',
          'content-type': 'audio/wav',
          'x-amz-version-id': 'version-123',
          'last-modified': 'Sat, 25 Jul 2026 12:00:00 GMT',
        }[String(name).toLowerCase()];
      },
    },
  });

  assert.deepEqual(await verifyEpisodeAssetObject(payload), {
    size: 1024,
    content_type: 'audio/wav',
    object_version_id: 'version-123',
    uploaded_at: '2026-07-25T12:00:00.000Z',
  });

  global.fetch = async () => ({
    ok: true,
    headers: {
      get(name) {
        return {
          'content-length': '2048',
          'content-type': 'audio/wav',
        }[String(name).toLowerCase()];
      },
    },
  });
  await assert.rejects(
    verifyEpisodeAssetObject(payload),
    /does not match its authorization/i
  );

  for (const versionId of ['', 'null']) {
    global.fetch = async () => ({
      ok: true,
      headers: {
        get(name) {
          return {
            'content-length': '1024',
            'content-type': 'audio/wav',
            'x-amz-version-id': versionId,
            'last-modified': 'Sat, 25 Jul 2026 12:00:00 GMT',
          }[String(name).toLowerCase()];
        },
      },
    });
    await assert.rejects(
      verifyEpisodeAssetObject(payload),
      /object storage versioning is required/i
    );
  }

  global.fetch = async () => ({
    ok: true,
    headers: {
      get(name) {
        return {
          'content-length': '1024',
          'content-type': 'audio/wav',
          'x-amz-version-id': 'version-123',
        }[String(name).toLowerCase()];
      },
    },
  });
  await assert.rejects(
    verifyEpisodeAssetObject(payload),
    /upload time could not be verified/i
  );
});

test('validates guest file signatures from the exact immutable version', async (t) => {
  assert.equal(
    validateEpisodeAssetContentSignature(
      Buffer.from('%PDF-1.7\n'),
      'application/pdf'
    ),
    true
  );
  assert.equal(
    validateEpisodeAssetContentSignature(
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      'image/jpeg'
    ),
    true
  );
  assert.throws(
    () =>
      validateEpisodeAssetContentSignature(
        Buffer.from('MZ executable bytes'),
        'application/pdf'
      ),
    /signature does not match/i
  );

  const upload = createTestUpload({
    file_name: 'resume.pdf',
    content_type: 'application/pdf',
    size: 8,
    category: 'document',
  });
  const payload = verifyEpisodeAssetUploadToken(
    upload.upload_token,
    'episode-one'
  );
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: new URL(url), options });
    const body = Buffer.from('%PDF-1.7');
    return {
      ok: true,
      status: 206,
      arrayBuffer: async () =>
        body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength),
    };
  };
  assert.equal(
    await verifyEpisodeAssetContentSignature(payload, {
      versionId: 'version-signature',
    }),
    true
  );
  assert.equal(
    requests[0].url.searchParams.get('versionId'),
    'version-signature'
  );
  assert.equal(requests[0].options.headers.range, 'bytes=0-7');
});

test('pins downloads to the verified version and forces attachment handling', () => {
  const upload = createTestUpload({ file_name: 'Episode (Final).wav' });
  const signedUrl = createEpisodeAssetDownloadUrl(upload.object_key, {
    episodeId: 'episode-one',
    fileName: upload.file_name,
    versionId: 'version-123',
  });
  const url = new URL(signedUrl);

  assert.equal(url.searchParams.get('versionId'), 'version-123');
  assert.equal(url.searchParams.get('X-Amz-Expires'), '600');
  assert.match(
    url.searchParams.get('response-content-disposition'),
    /^attachment;/
  );
  assert.match(
    url.searchParams.get('response-content-disposition'),
    /Episode \(Final\)\.wav/
  );
  assert.match(signedUrl, /Episode%20%28Final%29\.wav/);
  assert.match(signedUrl, /filename%2A%3DUTF-8%27%27/);
  const canonicalQuery = signedUrl
    .split('?')[1]
    .split('&X-Amz-Signature=')[0];
  const encodedNames = canonicalQuery
    .split('&')
    .map((entry) => entry.split('=')[0]);
  assert.deepEqual(encodedNames, [...encodedNames].sort());
  assert.throws(
    () =>
      createEpisodeAssetDownloadUrl(upload.object_key, {
        episodeId: 'another-episode',
        fileName: upload.file_name,
      }),
    /stored object key is invalid/i
  );
  for (const versionId of ['', 'null']) {
    assert.throws(
      () =>
        createEpisodeAssetDownloadUrl(upload.object_key, {
          episodeId: 'episode-one',
          fileName: upload.file_name,
          versionId,
        }),
      /stored object version is invalid/i
    );
  }
});

test('deletes only the recorded episode object version', async (t) => {
  const upload = createTestUpload();
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: new URL(url), options });
    return { ok: true, status: 204 };
  };

  assert.deepEqual(
    await deleteEpisodeAssetObject(upload.object_key, {
      episodeId: 'episode-one',
      versionId: 'version-123',
    }),
    { deleted: true, version_id: 'version-123' }
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, 'DELETE');
  assert.equal(requests[0].url.searchParams.get('versionId'), 'version-123');
  assert.match(
    requests[0].options.headers.Authorization,
    /^AWS4-HMAC-SHA256 /
  );
  await assert.rejects(
    deleteEpisodeAssetObject(upload.object_key, {
      episodeId: 'episode-one',
      versionId: '',
    }),
    /stored object version is invalid/i
  );
});

test('seals a deleted asset key before removing its recorded data version', async (t) => {
  const upload = createTestUpload();
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: new URL(url), options });
    return { ok: true, status: 200 };
  };

  assert.deepEqual(
    await sealEpisodeAssetObjectKey(upload.object_key, {
      episodeId: 'episode-one',
    }),
    { sealed: true }
  );
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, 'PUT');
  assert.equal(
    requests[0].options.headers['x-amz-meta-episode-asset-state'],
    'deleted'
  );
  assert.equal(requests[0].options.body, '');
  assert.match(
    requests[0].options.headers.Authorization,
    /x-amz-meta-episode-asset-state/
  );
});

test('treats an already-absent object version as safely deleted', async (t) => {
  const upload = createTestUpload();
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  global.fetch = async () => ({ ok: false, status: 404 });

  assert.deepEqual(
    await deleteEpisodeAssetObject(upload.object_key, {
      episodeId: 'episode-one',
      versionId: 'version-already-gone',
    }),
    { deleted: true, version_id: 'version-already-gone' }
  );
});

test('retries an exact-version delete after a lost response', async (t) => {
  const upload = createTestUpload();
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  const methods = [];
  global.fetch = async (_url, options) => {
    methods.push(options.method);
    if (methods.length === 1) throw new Error('connection reset');
    return { ok: true, status: 204 };
  };

  assert.deepEqual(
    await deleteEpisodeAssetObject(upload.object_key, {
      episodeId: 'episode-one',
      versionId: 'version-retried',
    }),
    { deleted: true, version_id: 'version-retried' }
  );
  assert.deepEqual(methods, ['DELETE', 'DELETE']);
});

test('uses an exact-version HEAD to resolve repeated ambiguous delete responses', async (t) => {
  const upload = createTestUpload();
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  const methods = [];
  global.fetch = async (_url, options) => {
    methods.push(options.method);
    if (options.method === 'HEAD') return { ok: false, status: 404 };
    throw new Error('response lost');
  };

  assert.deepEqual(
    await deleteEpisodeAssetObject(upload.object_key, {
      episodeId: 'episode-one',
      versionId: 'version-gone-after-lost-response',
    }),
    {
      deleted: true,
      version_id: 'version-gone-after-lost-response',
    }
  );
  assert.deepEqual(methods, ['DELETE', 'DELETE', 'DELETE', 'HEAD']);
});

test('reports when exact-version deletion remains unconfirmed', async (t) => {
  const upload = createTestUpload();
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  global.fetch = async () => {
    throw new Error('storage unavailable');
  };

  await assert.rejects(
    deleteEpisodeAssetObject(upload.object_key, {
      episodeId: 'episode-one',
      versionId: 'version-unknown',
    }),
    (error) =>
      error.code === 'EPISODE_ASSET_DELETE_UNCONFIRMED' &&
      error.delete_state === 'unknown'
  );
});

test('sweeps every object version and delete marker under an episode prefix', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  const requests = [];
  let listCount = 0;
  global.fetch = async (url, options) => {
    const request = { url: new URL(url), method: options.method };
    requests.push(request);
    if (options.method === 'GET') {
      listCount += 1;
      return {
        ok: true,
        status: 200,
        text: async () =>
          listCount === 1
            ? `<?xml version="1.0" encoding="UTF-8"?>
              <ListVersionsResult>
                <IsTruncated>false</IsTruncated>
                <Version>
                  <Key>episodes%2Fepisode-one%2Frecording%2Fasset-12345678-1234-4123-8123-123456789abc-proof.wav</Key>
                  <VersionId>version-one</VersionId>
                </Version>
                <DeleteMarker>
                  <Key>episodes%2Fepisode-one%2Frecording%2Fasset-12345678-1234-4123-8123-123456789abc-proof.wav</Key>
                  <VersionId>delete-marker-one</VersionId>
                </DeleteMarker>
                <Version>
                  <Key>episodes%2Fepisode-one%2Frecording%2Fasset-87654321-4321-4123-8123-cba987654321-legacy.wav</Key>
                  <VersionId>null</VersionId>
                </Version>
              </ListVersionsResult>`
            : `<?xml version="1.0" encoding="UTF-8"?>
              <ListVersionsResult><IsTruncated>false</IsTruncated></ListVersionsResult>`,
      };
    }
    return { ok: true, status: 204 };
  };

  assert.deepEqual(
    await deleteEpisodeAssetObjectVersionsForEpisode('episode-one'),
    {
      deleted: true,
      cleanup_pending: false,
      deleted_version_count: 3,
    }
  );
  const listRequests = requests.filter((request) => request.method === 'GET');
  const deleteRequests = requests.filter(
    (request) => request.method === 'DELETE'
  );
  assert.equal(listRequests.length, 1);
  assert.equal(listRequests[0].url.searchParams.has('versions'), true);
  assert.equal(
    listRequests[0].url.searchParams.get('prefix'),
    'episodes/episode-one/'
  );
  assert.deepEqual(
    deleteRequests.map((request) => request.url.searchParams.get('versionId')),
    ['version-one', 'delete-marker-one', 'null']
  );
});

test('decodes an S3 version-list key marker before signing the next page', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  const listRequests = [];
  global.fetch = async (url, options) => {
    assert.equal(options.method, 'GET');
    listRequests.push(new URL(url));
    return {
      ok: true,
      status: 200,
      text: async () =>
        listRequests.length === 1
          ? `<?xml version="1.0" encoding="UTF-8"?>
            <ListVersionsResult>
              <IsTruncated>true</IsTruncated>
              <NextKeyMarker>episodes%2Fepisode-one%2Frecording%2Fasset-12345678-1234-4123-8123-123456789abc-page-one.wav</NextKeyMarker>
              <NextVersionIdMarker>version-page-one</NextVersionIdMarker>
              <Version>
                <Key>episodes%2Fepisode-one%2Frecording%2Fasset-12345678-1234-4123-8123-123456789abc-page-one.wav</Key>
                <VersionId>version-page-one</VersionId>
              </Version>
            </ListVersionsResult>`
          : `<?xml version="1.0" encoding="UTF-8"?>
            <ListVersionsResult>
              <IsTruncated>false</IsTruncated>
              <Version>
                <Key>episodes%2Fepisode-one%2Frecording%2Fasset-87654321-4321-4123-8123-cba987654321-page-two.wav</Key>
                <VersionId>version-page-two</VersionId>
              </Version>
            </ListVersionsResult>`,
    };
  };

  const versions = await listEpisodeAssetObjectVersions('episode-one');
  assert.equal(versions.length, 2);
  assert.equal(listRequests.length, 2);
  assert.equal(
    listRequests[1].searchParams.get('key-marker'),
    'episodes/episode-one/recording/asset-12345678-1234-4123-8123-123456789abc-page-one.wav'
  );
  assert.equal(
    listRequests[1].searchParams.get('version-id-marker'),
    'version-page-one'
  );
});

test('bounds each scheduled prefix cleanup batch and reports remaining versions', async (t) => {
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  const requests = [];
  global.fetch = async (url, options) => {
    requests.push({ url: new URL(url), method: options.method });
    if (options.method === 'GET') {
      return {
        ok: true,
        status: 200,
        text: async () => `<?xml version="1.0" encoding="UTF-8"?>
          <ListVersionsResult>
            <IsTruncated>true</IsTruncated>
            <NextKeyMarker>episodes%2Fepisode-one%2Frecording%2Fasset-12345678-1234-4123-8123-123456789abc-one.wav</NextKeyMarker>
            <NextVersionIdMarker>version-one</NextVersionIdMarker>
            <Version>
              <Key>episodes%2Fepisode-one%2Frecording%2Fasset-12345678-1234-4123-8123-123456789abc-one.wav</Key>
              <VersionId>version-one</VersionId>
            </Version>
          </ListVersionsResult>`,
      };
    }
    return { ok: true, status: 204 };
  };

  assert.deepEqual(
    await deleteEpisodeAssetObjectVersionsForEpisode('episode-one', {
      maxVersions: 1,
    }),
    {
      deleted: false,
      cleanup_pending: true,
      deleted_version_count: 1,
    }
  );
  assert.equal(
    requests.find((request) => request.method === 'GET').url.searchParams.get(
      'max-keys'
    ),
    '1'
  );
});
