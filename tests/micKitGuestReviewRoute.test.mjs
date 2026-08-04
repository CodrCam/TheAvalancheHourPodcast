import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function source(path) {
  return readFile(new URL(path, import.meta.url), 'utf8');
}

test('participant equipment review has explicit safe resolution actions', async () => {
  const route = await source('../pages/api/studio/mic-kits.js');
  assert.match(route, /'confirm_shipment'/);
  assert.match(route, /request_kind: 'shipment'/);
  assert.match(route, /review_resolution: 'shipment'/);
  assert.match(route, /'resolve_review_no_shipment'/);
  assert.match(route, /review_resolution: 'own_equipment'/);
  assert.match(route, /confirmedParticipantShipment/);
  assert.match(route, /complete participant mailing address/i);
  assert.match(route, /canActOnMicKitRequest\(request, actorViewer\)/);
  assert.match(
    route,
    /Resolve the equipment review by confirming a shipment or confirming that no shipment is needed/
  );
  assert.match(route, /Cache-Control', 'private, no-store/);
});

test('episode microphone plans can create an early host or guest queue item', async () => {
  const route = await source(
    '../pages/api/studio/episodes/[episodeId]/mic-kit.js'
  );
  assert.match(route, /action !== 'request_participant_kit'/);
  assert.match(route, /ADMIN_PERMISSIONS\.MIC_KITS_REQUEST/);
  assert.match(route, /upsertEpisodeMicKitEquipmentReviewRequest/);
  assert.match(route, /requestableHostPersonIds\(access\)/);
  assert.match(route, /canRequestForGuest\(access\)/);
  assert.match(route, /connectEpisodeMicKitRequestToPlan/);
  assert.match(route, /saveMicKitTracker/);
  assert.match(route, /saveEpisodeStudio/);
  assert.match(route, /Cache-Control', 'private, no-store/);
  assert.doesNotMatch(route, /req\.body\?\.request\?\.shipping/);

  const postStart = route.indexOf("if (req.method === 'POST')");
  const lockedGuard = route.indexOf(
    'HOST_LOCKED_STATUSES.has(access.episode.status)',
    postStart
  );
  const requestUpsert = route.indexOf(
    'upsertEpisodeMicKitEquipmentReviewRequest({',
    postStart
  );
  const trackerWrite = route.indexOf(
    'saveMicKitTracker(requestResult.tracker',
    postStart
  );
  assert.ok(postStart >= 0);
  assert.ok(lockedGuard > postStart);
  assert.ok(requestUpsert > lockedGuard);
  assert.ok(trackerWrite > lockedGuard);
});

test('manager assignment revalidates an explicit eligible kit choice', async () => {
  const route = await source('../pages/api/studio/mic-kits.js');
  assert.match(route, /action === 'assign_request_to_kit'/);
  assert.match(route, /getMicKitAssignmentOptions/);
  assert.match(route, /if \(!assignment\?\.eligible\)/);
  assert.match(route, /syncKitAssignment\(tracker, kit, request\.request_id\)/);
});

test('equipment review links open the exact queue card and use one assignment path', async () => {
  const episodeStep = await source('../components/EpisodeMicKitStep.js');
  const micKitBoard = await source('../pages/studio/mic-kits.js');

  assert.match(episodeStep, /function targetedMicKitBoardHref/);
  assert.match(
    episodeStep,
    /searchParams\.set\('request_id', targetRequestId\)/
  );
  assert.match(
    episodeStep,
    /activeRequest\?\.request_kind === 'equipment_review'/
  );
  assert.match(episodeStep, /href=\{activeRequestBoardHref\}/);
  assert.doesNotMatch(episodeStep, /Submit the prefilled request/);

  assert.match(micKitBoard, /router\.query\.request_id/);
  assert.match(micKitBoard, /if \(review\) review\.open = true/);
  assert.doesNotMatch(micKitBoard, />\s*Next request\s*</);
  assert.match(
    micKitBoard,
    /request\.is_mine[\s\S]*Confirm host received kit/
  );
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
