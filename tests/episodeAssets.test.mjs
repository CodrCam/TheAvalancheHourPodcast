import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEpisodeAssetInput,
} from '../lib/episodeAssetStorage.js';

test('accepts bounded final audio and image uploads', () => {
  assert.deepEqual(
    validateEpisodeAssetInput({
      file_name: 'Episode Final.wav',
      content_type: 'audio/wav',
      size: 1024,
      category: 'recording',
    }),
    {
      file_name: 'Episode-Final.wav',
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
    /choose an audio file/
  );
  assert.throws(
    () =>
      validateEpisodeAssetInput({
        file_name: 'payload.html',
        content_type: 'text/html',
        size: 1024,
        category: 'document',
      }),
    /not supported/
  );
});
