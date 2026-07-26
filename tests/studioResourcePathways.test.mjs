import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_GROUPS,
  ACCESS_PERMISSIONS,
  getPermissionsForGroups,
} from '../lib/accessControl.mjs';
import {
  getDefaultStudioResourcePath,
  getStudioResourcePathways,
} from '../lib/studioResourcePathways.mjs';

function pathIdsFor(groups) {
  return getStudioResourcePathways(
    getPermissionsForGroups(groups)
  ).map((pathway) => pathway.id);
}

test('hosts receive only the host resource path', () => {
  const pathways = getStudioResourcePathways(
    getPermissionsForGroups([ACCESS_GROUPS.HOST])
  );

  assert.deepEqual(
    pathways.map((pathway) => pathway.id),
    ['host']
  );
  assert.equal(
    JSON.stringify(pathways).includes('Orders and shipments'),
    false
  );
  assert.equal(
    JSON.stringify(pathways).includes('Manage episode production'),
    false
  );
});

test('host resources include the complete Riverside recording workflow', () => {
  const [host] = getStudioResourcePathways(
    getPermissionsForGroups([ACCESS_GROUPS.HOST])
  );
  const riversideSetup = host.steps.find(
    (step) => step.id === 'host-riverside-setup'
  );
  const recordingCheck = host.steps.find(
    (step) => step.id === 'host-recording-check'
  );
  const recordAndUpload = host.steps.find(
    (step) => step.id === 'host-record-and-upload'
  );

  assert.ok(riversideSetup);
  assert.ok(recordingCheck);
  assert.ok(recordAndUpload);
  assert.ok(riversideSetup.instructions.length >= 8);
  assert.ok(recordingCheck.instructions.length >= 8);
  assert.ok(recordAndUpload.instructions.length >= 8);
  assert.equal(
    host.faqs.some((faq) => faq.id === 'host-faq-upload'),
    true
  );
  assert.equal(
    host.faqs.some((faq) => faq.id === 'host-faq-wrong-mic'),
    true
  );
  assert.equal(
    host.suggested_searches.includes('set up Riverside'),
    true
  );
});

test('every host walkthrough provides a visible step-by-step refresher', () => {
  const [host] = getStudioResourcePathways(
    getPermissionsForGroups([ACCESS_GROUPS.HOST])
  );

  assert.ok(host.steps.length >= 8);
  assert.equal(
    host.steps.every(
      (step) =>
        Array.isArray(step.instructions) && step.instructions.length >= 3
    ),
    true
  );
  assert.equal(
    host.steps.some((step) => 'permission' in step),
    false
  );
  assert.equal(
    host.faqs.some((faq) => 'permission' in faq),
    false
  );
});

test('logistics users receive operations guidance without producer controls', () => {
  const permissions = getPermissionsForGroups([ACCESS_GROUPS.LOGISTICS]);
  const pathways = getStudioResourcePathways(permissions);
  const operations = pathways.find((pathway) => pathway.id === 'operations');

  assert.deepEqual(pathIdsFor([ACCESS_GROUPS.LOGISTICS]), ['operations']);
  assert.equal(
    permissions.includes(ACCESS_PERMISSIONS.RESOURCES_READ),
    true
  );
  assert.equal(
    operations.steps.some((step) => step.id === 'operations-orders'),
    true
  );
  assert.equal(
    operations.steps.some((step) => step.id === 'operations-products'),
    true
  );
  assert.equal(
    operations.faqs.some((faq) => faq.id === 'operations-faq-sold-out'),
    true
  );
  assert.equal(
    operations.steps.some((step) => step.id === 'operations-calendar'),
    false
  );
  assert.equal(
    operations.steps.some((step) => step.id === 'operations-mic-kit-desk'),
    false
  );
});

test('Studio managers receive host and production paths without operations data', () => {
  assert.deepEqual(pathIdsFor([ACCESS_GROUPS.STUDIO_MANAGER]), [
    'host',
    'production',
  ]);
  assert.equal(
    getDefaultStudioResourcePath(
      getPermissionsForGroups([ACCESS_GROUPS.STUDIO_MANAGER])
    ),
    'production'
  );
});

test('a combined coordinator and Studio manager receives all relevant paths', () => {
  const groups = [
    ACCESS_GROUPS.LOGISTICS,
    ACCESS_GROUPS.STUDIO_MANAGER,
  ];
  const pathways = getStudioResourcePathways(getPermissionsForGroups(groups));
  const operations = pathways.find((pathway) => pathway.id === 'operations');

  assert.deepEqual(
    pathways.map((pathway) => pathway.id),
    ['host', 'operations', 'production']
  );
  assert.equal(
    operations.steps.some((step) => step.id === 'operations-calendar'),
    true
  );
  assert.equal(
    getDefaultStudioResourcePath(getPermissionsForGroups(groups)),
    'operations'
  );
});

test('admins see restricted resource actions but no action loses its permission field', () => {
  const pathways = getStudioResourcePathways(
    getPermissionsForGroups([ACCESS_GROUPS.ADMIN])
  );
  const operations = pathways.find((pathway) => pathway.id === 'operations');

  assert.equal(
    operations.steps.some((step) => step.id === 'operations-mic-kit-desk'),
    true
  );
  assert.equal(
    pathways.some((pathway) =>
      pathway.steps.some((step) => 'permission' in step)
    ),
    false
  );
  assert.equal(
    pathways.some((pathway) =>
      pathway.faqs.some((faq) => 'permission' in faq)
    ),
    false
  );
});
