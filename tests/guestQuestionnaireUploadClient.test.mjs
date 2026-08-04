import test from 'node:test';
import assert from 'node:assert/strict';
import { completeGuestQuestionnaireAssetUpload } from '../lib/guestQuestionnaireUploadClient.mjs';

test('reloads guest slot state after two lost completion responses', async () => {
  const requests = [];
  const result = await completeGuestQuestionnaireAssetUpload({
    token: 'guest-token',
    uploadToken: 'upload-token',
    fileName: 'portrait.jpg',
    slotKey: 'photo',
    assetId: 'asset-one',
    fetchImpl: async (url, options = {}) => {
      requests.push({ url, options });
      if (url.endsWith('/uploads/complete')) {
        throw new TypeError('response lost');
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({
          submission: {
            upload_slots: {
              photo: {
                assets: [{ asset_id: 'asset-one' }],
              },
            },
          },
        }),
      };
    },
  });

  assert.equal(requests.length, 3);
  assert.equal(requests[2].url, '/api/guest-questionnaire');
  assert.equal(requests[2].options.headers.Authorization, 'Bearer guest-token');
  assert.equal(result.reconciled, true);
  assert.equal(result.slot.assets[0].asset_id, 'asset-one');
});

test('preserves the completion error when a final guest reload finds no asset', async () => {
  await assert.rejects(
    completeGuestQuestionnaireAssetUpload({
      token: 'guest-token',
      uploadToken: 'upload-token',
      fileName: 'portrait.jpg',
      slotKey: 'photo',
      assetId: 'asset-one',
      fetchImpl: async (url) => {
        if (url.endsWith('/uploads/complete')) {
          throw new TypeError('response lost');
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ submission: { upload_slots: {} } }),
        };
      },
    }),
    /response lost/i
  );
});
