import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('guest equipment review has explicit safe resolution actions', async () => {
  const route = await source('../pages/api/studio/mic-kits.js');
  assert.match(route, /action === 'confirm_guest_shipment'/);
  assert.match(route, /request_kind: 'shipment'/);
  assert.match(route, /review_resolution: 'shipment'/);
  assert.match(route, /'resolve_guest_review_no_shipment'/);
  assert.match(route, /review_resolution: 'own_equipment'/);
  assert.match(route, /confirmedGuestShipment/);
  assert.match(route, /complete guest mailing address/i);
  assert.match(route, /canActOnMicKitRequest\(request, actorViewer\)/);
  assert.match(
    route,
    /Resolve the equipment review by confirming a shipment or confirming that no shipment is needed/
  );
  assert.match(route, /Cache-Control', 'private, no-store/);
});

test('both submission paths queue uncertain guest equipment for review', async () => {
  for (const path of [
    '../pages/api/guest-questionnaire.js',
    '../pages/api/studio/episodes/[episodeId]/guest-questionnaire.js',
  ]) {
    const route = await source(path);
    assert.match(
      route,
      /\['request_kit', 'needs_follow_up'\]\.includes\(guestPlan\?\.choice\)/
    );
  }
});
