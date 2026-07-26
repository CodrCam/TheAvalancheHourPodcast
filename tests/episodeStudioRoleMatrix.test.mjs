import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getEpisodeRelationshipCapabilities,
} from '../lib/episodeStudioPresentation.mjs';
import {
  ACCESS_GROUPS,
  getPermissionsForGroups,
} from '../lib/accessControl.mjs';

const episode = {
  episode_id: 'opening-episode',
  title: 'Opening Episode',
  target_release_date: '2026-10-01',
  host_person_ids: ['regular-host', 'manager-host', 'dual-host-producer'],
  producer_person_id: 'admin-producer',
  created_by_person_id: 'episode-creator',
  deliverables: [
    {
      id: 'notes',
      label: 'Notes',
      type: 'textarea',
      required: true,
    },
  ],
};

function capabilities(personId, groups) {
  return getEpisodeRelationshipCapabilities(
    episode,
    { person_id: personId },
    {
      groups,
      permissions: getPermissionsForGroups(groups),
    }
  );
}

test('regular host receives host work but not producer review', () => {
  const result = capabilities('regular-host', [ACCESS_GROUPS.HOST]);
  assert.equal(result.canAccess, true);
  assert.equal(result.canHost, true);
  assert.equal(result.canReview, false);
  assert.equal(result.canUploadAssets, true);
  assert.equal(result.canConfigure, false);
});

test('an assigned producer receives review controls without manager permission', () => {
  const producerEpisode = {
    ...episode,
    producer_person_id: 'regular-producer',
  };
  const result = getEpisodeRelationshipCapabilities(
    producerEpisode,
    { person_id: 'regular-producer' },
    {
      groups: [ACCESS_GROUPS.HOST],
      permissions: getPermissionsForGroups([ACCESS_GROUPS.HOST]),
    }
  );
  assert.equal(result.canReview, true);
  assert.equal(result.canUploadAssets, true);
  assert.equal(result.canManage, false);
  assert.equal(result.canConfigure, true);
});

test('a host who is also producer receives both action sets', () => {
  const dualEpisode = {
    ...episode,
    producer_person_id: 'dual-host-producer',
  };
  const result = getEpisodeRelationshipCapabilities(
    dualEpisode,
    { person_id: 'dual-host-producer' },
    {
      groups: [ACCESS_GROUPS.HOST],
      permissions: getPermissionsForGroups([ACCESS_GROUPS.HOST]),
    }
  );
  assert.equal(result.canHost, true);
  assert.equal(result.canReview, true);
  assert.equal(result.canUploadAssets, true);
});

test('a Studio manager assigned as host keeps host actions', () => {
  const result = capabilities('manager-host', [
    ACCESS_GROUPS.STUDIO_MANAGER,
  ]);
  assert.equal(result.canManage, true);
  assert.equal(result.canHost, true);
  assert.equal(result.canReview, false);
});

test('an administrator assigned as producer receives producer actions', () => {
  const result = capabilities('admin-producer', [ACCESS_GROUPS.ADMIN]);
  assert.equal(result.canManage, true);
  assert.equal(result.canReview, true);
  assert.equal(result.canAdminOverride, true);
});

test('an unrelated signed-in host cannot access the episode', () => {
  const result = capabilities('unrelated-person', [ACCESS_GROUPS.HOST]);
  assert.equal(result.canAccess, false);
  assert.equal(result.canHost, false);
  assert.equal(result.canReview, false);
  assert.equal(result.canUploadAssets, false);
});

test('host upload locks follow workflow status while the assigned producer can continue', () => {
  const submittedEpisode = {
    ...episode,
    status: 'submitted',
    producer_person_id: 'regular-producer',
  };
  const host = getEpisodeRelationshipCapabilities(
    submittedEpisode,
    { person_id: 'regular-host' },
    {
      groups: [ACCESS_GROUPS.HOST],
      permissions: getPermissionsForGroups([ACCESS_GROUPS.HOST]),
    }
  );
  const producer = getEpisodeRelationshipCapabilities(
    submittedEpisode,
    { person_id: 'regular-producer' },
    {
      groups: [ACCESS_GROUPS.HOST],
      permissions: getPermissionsForGroups([ACCESS_GROUPS.HOST]),
    }
  );

  assert.equal(host.canHost, true);
  assert.equal(host.canUploadAssets, false);
  assert.equal(producer.canReview, true);
  assert.equal(producer.canUploadAssets, true);
});
