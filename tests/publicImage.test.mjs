import assert from 'node:assert/strict';
import test from 'node:test';
import { getOptimizedPublicImage } from '../lib/publicImage.mjs';

test('maps large local image roots to canonical WebP derivatives', () => {
  assert.equal(
    getOptimizedPublicImage('/images/hosts/caleb1.JPG'),
    '/images/optimized/hosts/caleb1.webp'
  );
  assert.equal(
    getOptimizedPublicImage('/images/store/caps/Black_Camo2.jpg'),
    '/images/optimized/store/caps/black-camo2.webp'
  );
  assert.equal(
    getOptimizedPublicImage('/images/background/main-page3.jpg'),
    '/images/optimized/background/main-page3.webp'
  );
});

test('normalizes spaces and preserves URL suffixes', () => {
  assert.equal(
    getOptimizedPublicImage(
      '/images/store/recaps/Screenshot 2025-11-25 at 8.09.51 PM.png?v=2'
    ),
    '/images/optimized/store/recaps/screenshot-2025-11-25-at-8-09-51-pm.webp?v=2'
  );
});

test('leaves managed, remote, data, SVG, and optimized images unchanged', () => {
  const values = [
    'https://cdn.example.com/photo.jpg',
    '/api/store/product-image?key=one',
    'data:image/jpeg;base64,abc',
    '/images/placeholder-person.svg',
    '/images/optimized/hosts/caleb1.webp',
  ];

  for (const value of values) {
    assert.equal(getOptimizedPublicImage(value), value);
  }
});
