import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_PERSON_IMAGES,
  groupPeopleForDisplay,
  isAllowedSelfProfileImage,
  moveImageAtIndex,
  profileBioToPlainText,
  removeImageAtIndex,
  restoreImageAtIndex,
} from '../lib/peoplePresentation.mjs';

test('removes only the selected duplicate image', () => {
  const images = ['same.jpg', 'same.jpg', 'other.jpg'];
  const result = removeImageAtIndex(images, 0, 'same.jpg');

  assert.deepEqual(result, ['same.jpg', 'other.jpg']);
  assert.equal(result.length, images.length - 1);
  assert.deepEqual(images, ['same.jpg', 'same.jpg', 'other.jpg']);
});

test('removes first, middle, and last slots without changing image order', () => {
  const images = ['first.jpg', 'middle.jpg', 'last.jpg'];

  assert.deepEqual(removeImageAtIndex(images, 0), [
    'middle.jpg',
    'last.jpg',
  ]);
  assert.deepEqual(removeImageAtIndex(images, 1), [
    'first.jpg',
    'last.jpg',
  ]);
  assert.deepEqual(removeImageAtIndex(images, 2), [
    'first.jpg',
    'middle.jpg',
  ]);
});

test('does not remove an image when the clicked slot changed', () => {
  const images = ['first.jpg', 'second.jpg'];

  assert.deepEqual(
    removeImageAtIndex(images, 0, 'second.jpg'),
    images
  );
  assert.deepEqual(removeImageAtIndex(images, 99), images);
});

test('restores an image to its original position', () => {
  assert.deepEqual(
    restoreImageAtIndex(['first.jpg', 'third.jpg'], 1, 'second.jpg'),
    ['first.jpg', 'second.jpg', 'third.jpg']
  );
});

test('moves a selected headshot to the first slot without mutating the source', () => {
  const images = ['first.jpg', 'second.jpg', 'headshot.jpg'];
  const result = moveImageAtIndex(images, 2, 0, 'headshot.jpg');

  assert.deepEqual(result, ['headshot.jpg', 'first.jpg', 'second.jpg']);
  assert.deepEqual(images, ['first.jpg', 'second.jpg', 'headshot.jpg']);
});

test('moves photos earlier and later while preserving every photo', () => {
  assert.deepEqual(
    moveImageAtIndex(['first.jpg', 'second.jpg', 'third.jpg'], 0, 1),
    ['second.jpg', 'first.jpg', 'third.jpg']
  );
  assert.deepEqual(
    moveImageAtIndex(['first.jpg', 'second.jpg', 'third.jpg'], 1, 2),
    ['first.jpg', 'third.jpg', 'second.jpg']
  );
});

test('does not reorder a stale or out-of-range photo slot', () => {
  const images = ['first.jpg', 'second.jpg', 'third.jpg'];

  assert.deepEqual(moveImageAtIndex(images, 1, 0, 'third.jpg'), images);
  assert.deepEqual(moveImageAtIndex(images, 1, 8), images);
});

test('keeps the team-photo limit at three', () => {
  assert.equal(MAX_PERSON_IMAGES, 3);
});

test('groups all non-host roles together and sorts by display order', () => {
  const grouped = groupPeopleForDisplay([
    { name: 'Producer', role: 'producer', sort_order: 3 },
    { name: 'Second Host', role: 'host', sort_order: 2 },
    { name: 'Webmaster', role: 'webmaster', sort_order: 1 },
    { name: 'First Host', role: 'host', sort_order: 1 },
    { name: 'Social', role: 'social_media_manager', sort_order: 2 },
  ]);

  assert.deepEqual(
    grouped.hosts.map((person) => person.name),
    ['First Host', 'Second Host']
  );
  assert.deepEqual(
    grouped.team.map((person) => person.name),
    ['Webmaster', 'Social', 'Producer']
  );
});

test('converts legacy biography markup to safe plain text', () => {
  const bio =
    'Visit <a href="https://example.com">our site</a>.<br><img src=x onerror=alert(1)>';

  assert.equal(profileBioToPlainText(bio), 'Visit our site.');
});

test('limits self-service profile images to uploads and the public image tree', () => {
  assert.equal(
    isAllowedSelfProfileImage('data:image/jpeg;base64,ZmFrZQ=='),
    true
  );
  assert.equal(
    isAllowedSelfProfileImage('/images/hosts/example portrait.jpg'),
    true
  );
  assert.equal(
    isAllowedSelfProfileImage('/images/../api/store/admin/auth/logout'),
    false
  );
  assert.equal(
    isAllowedSelfProfileImage('/api/store/admin/auth/logout'),
    false
  );
  assert.equal(isAllowedSelfProfileImage('https://tracker.example/pixel'), false);
});
