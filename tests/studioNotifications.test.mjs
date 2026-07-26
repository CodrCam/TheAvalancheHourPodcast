import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterOpenableStudioNotifications,
  groupStudioNotifications,
  normalizeStudioNotification,
  plainTextPreview,
  safeStudioDeepLink,
} from '../lib/studioNotificationPresentation.mjs';
import {
  buildEpisodeNotificationEntries,
} from '../lib/episodeStudioEvents.js';
import {
  buildMicKitNotificationEntries,
} from '../lib/micKitEvents.js';
import {
  buildProductionAdvance,
  getAvailableProductionLeadPersonIds,
  getNextProductionLeadPersonId,
} from '../lib/productionEscalation.mjs';
import {
  isSafeSpotifyStagingUrl,
  normalizeEpisodeStudio,
} from '../lib/episodeStudioPresentation.mjs';
import {
  filterNotificationsForPrincipal,
} from '../lib/studioNotificationAccess.js';
import {
  getMicKitManagerPersonIds,
  getStudioAdminNotificationPersonIds,
} from '../lib/studioNotificationRecipients.mjs';

test('notification previews are plain text and deep links stay same-origin', () => {
  assert.equal(
    plainTextPreview('<img src=x onerror=alert(1)> Hello <b>team</b>'),
    'Hello team'
  );
  assert.equal(safeStudioDeepLink('/studio/episodes/one#discussion'), '/studio/episodes/one#discussion');
  assert.equal(safeStudioDeepLink('https://evil.example'), '');
  assert.equal(safeStudioDeepLink('//evil.example'), '');

  const notification = normalizeStudioNotification({
    notification_id: 'notice-1',
    recipient_person_id: 'host-1',
    type: 'episode_discussion_message',
    title: '<script>bad()</script> Update',
    preview: '<b>Safe preview</b>',
    deep_link: '/studio/episodes/one',
  });
  assert.equal(notification.title, 'bad() Update');
  assert.equal(notification.preview, 'Safe preview');
});

test('discussion events notify episode participants but exclude the author', () => {
  const entries = buildEpisodeNotificationEntries({
    previousEpisode: {
      episode_id: 'one',
      host_person_ids: ['host-1', 'host-2'],
      producer_person_id: 'producer-1',
      created_by_person_id: 'creator-1',
    },
    episode: {
      episode_id: 'one',
      title: 'Episode One',
      host_person_ids: ['host-1', 'host-2'],
      producer_person_id: 'producer-1',
      created_by_person_id: 'creator-1',
      updated_at: '2026-07-25T12:00:00.000Z',
      messages: [
        {
          message_id: 'message-1',
          body: '<b>Question</b> about the ad read',
        },
      ],
    },
    action: 'message',
    actorPersonId: 'host-1',
    actorName: 'Host One',
  });
  assert.deepEqual(
    entries.map((entry) => entry.notification.recipient_person_id).sort(),
    ['creator-1', 'host-2', 'producer-1']
  );
  assert.equal(entries[0].notification.preview.includes('<'), false);
});

test('mic kit tracking events never include tracking data in previews', () => {
  const entries = buildMicKitNotificationEntries({
    previousTracker: {
      requests: [
        {
          request_id: 'request-1',
          requester_person_id: 'host-1',
        },
      ],
      kits: [
        {
          kit_id: 'kit-1',
          next_request_id: 'request-1',
          tracking_number: '',
          tracking_url: '',
        },
      ],
    },
    tracker: {
      updated_at: '2026-07-25T12:00:00.000Z',
      requests: [
        {
          request_id: 'request-1',
          requester_person_id: 'host-1',
        },
      ],
      kits: [
        {
          kit_id: 'kit-1',
          label: 'Kit One',
          next_request_id: 'request-1',
          tracking_number: 'SECRET-TRACKING',
          tracking_url: 'https://carrier.example/SECRET-TRACKING',
        },
      ],
    },
    action: 'update_kit',
  });
  assert.equal(entries.length, 1);
  assert.equal(
    JSON.stringify(entries[0].notification).includes('SECRET-TRACKING'),
    false
  );
});

test('groups multiple events for one episode without merging different episodes', () => {
  const values = [
    {
      notification_id: 'one-upload',
      recipient_person_id: 'producer-1',
      type: 'episode_required_file_uploaded',
      category: 'episode',
      title: 'A file was uploaded',
      preview: 'Recording tracks are ready.',
      entity_kind: 'episode_asset',
      entity_id: 'asset-1',
      group_entity_kind: 'episode',
      group_entity_id: 'episode-one',
      deep_link: '/studio/episodes/episode-one#final-assets',
      created_at: '2026-07-25T10:00:00.000Z',
    },
    {
      notification_id: 'one-submit',
      recipient_person_id: 'producer-1',
      type: 'episode_package_submitted',
      category: 'episode',
      title: 'Episode One is ready',
      preview: 'Review the package.',
      entity_kind: 'episode',
      entity_id: 'episode-one',
      group_entity_kind: 'episode',
      group_entity_id: 'episode-one',
      deep_link: '/studio/episodes/episode-one',
      created_at: '2026-07-25T11:00:00.000Z',
    },
    {
      notification_id: 'two-submit',
      recipient_person_id: 'producer-1',
      type: 'episode_package_submitted',
      category: 'episode',
      title: 'Episode Two is ready',
      preview: 'Review the package.',
      entity_kind: 'episode',
      entity_id: 'episode-two',
      group_entity_kind: 'episode',
      group_entity_id: 'episode-two',
      deep_link: '/studio/episodes/episode-two',
      created_at: '2026-07-25T12:00:00.000Z',
      read_at: '2026-07-25T12:10:00.000Z',
    },
  ];

  const groups = groupStudioNotifications(values);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].group_key, 'episode:episode-two');
  assert.equal(groups[1].notification_count, 2);
  assert.equal(groups[1].unread_count, 2);
  assert.deepEqual(
    groups[1].notifications.map((notification) => notification.notification_id),
    ['one-submit', 'one-upload']
  );
});

test('recipient access suppresses reassigned, unrelated, archived, and cross-role records', () => {
  const notification = (id, episodeId, personId = 'host-1') => ({
    notification_id: id,
    recipient_person_id: personId,
    type: 'episode_discussion_message',
    category: 'episode',
    title: 'Episode update',
    preview: 'A private discussion preview.',
    entity_kind: 'episode',
    entity_id: episodeId,
    group_entity_kind: 'episode',
    group_entity_id: episodeId,
    deep_link: `/studio/episodes/${episodeId}#discussion`,
    created_at: '2026-07-25T12:00:00.000Z',
  });
  const episodesById = new Map([
    [
      'mine',
      {
        episode_id: 'mine',
        host_person_ids: ['host-1'],
        producer_person_id: 'producer-1',
      },
    ],
    [
      'other',
      {
        episode_id: 'other',
        host_person_ids: ['host-2'],
        producer_person_id: 'producer-2',
      },
    ],
    [
      'archived',
      {
        episode_id: 'archived',
        host_person_ids: ['host-1'],
        archived: true,
      },
    ],
  ]);

  const visible = filterOpenableStudioNotifications(
    [
      notification('mine-event', 'mine'),
      notification('other-event', 'other'),
      notification('archived-event', 'archived'),
      notification('wrong-recipient', 'mine', 'host-2'),
    ],
    {
      personId: 'host-1',
      permissions: ['episodes:read'],
      episodesById,
    }
  );
  assert.deepEqual(
    visible.map((item) => item.notification_id),
    ['mine-event']
  );

  const managerVisible = filterOpenableStudioNotifications(
    [notification('manager-event', 'other')],
    {
      personId: 'host-1',
      permissions: ['episodes:manage'],
      episodesById,
    }
  );
  assert.equal(managerVisible.length, 1);
});

test('notification access batch-loads related episodes once per page', async () => {
  let episodeLoads = 0;
  let micKitLoads = 0;
  const notifications = ['one', 'two'].map((episodeId) => ({
    notification_id: `notice-${episodeId}`,
    recipient_person_id: 'host-1',
    type: 'episode_discussion_message',
    category: 'episode',
    title: 'Episode update',
    preview: 'New discussion activity.',
    entity_kind: 'episode',
    entity_id: episodeId,
    group_entity_kind: 'episode',
    group_entity_id: episodeId,
    deep_link: `/studio/episodes/${episodeId}#discussion`,
    created_at: '2026-07-25T12:00:00.000Z',
  }));
  const result = await filterNotificationsForPrincipal(notifications, {
    personId: 'host-1',
    permissions: ['episodes:read'],
    loadEpisodes: async (ids) => {
      episodeLoads += 1;
      assert.deepEqual(ids.sort(), ['one', 'two']);
      return {
        episodes: ids.map((episodeId) => ({
          episode_id: episodeId,
          host_person_ids: ['host-1'],
        })),
      };
    },
    loadMicKitTracker: async () => {
      micKitLoads += 1;
      return { tracker: { requests: [] } };
    },
  });
  assert.equal(result.notifications.length, 2);
  assert.equal(episodeLoads, 1);
  assert.equal(micKitLoads, 0);
});

test('submission goes only to the assigned producer and deadline changes stay in scope', () => {
  const previousEpisode = {
    episode_id: 'episode-one',
    title: 'Episode One',
    host_person_ids: ['host-1', 'host-2'],
    producer_person_id: 'producer-1',
    due_date: '2026-08-01',
    updated_at: '2026-07-25T10:00:00.000Z',
  };
  const submitted = buildEpisodeNotificationEntries({
    previousEpisode,
    episode: {
      ...previousEpisode,
      status: 'submitted',
      updated_at: '2026-07-25T11:00:00.000Z',
    },
    action: 'submit',
    actorPersonId: 'host-1',
  });
  assert.deepEqual(
    submitted.map((entry) => entry.notification.recipient_person_id),
    ['producer-1']
  );

  const deadline = buildEpisodeNotificationEntries({
    previousEpisode,
    episode: {
      ...previousEpisode,
      due_date: '2026-08-03',
      updated_at: '2026-07-25T12:00:00.000Z',
    },
    action: 'update',
    actorPersonId: 'host-2',
  });
  assert.deepEqual(
    deadline.map((entry) => entry.notification.recipient_person_id).sort(),
    ['host-1', 'producer-1']
  );
  assert.ok(
    deadline.every(
      (entry) => entry.notification.type === 'episode_deadline_changed'
    )
  );
});

test('production escalation routes outside producers to Angie and Angie to Caleb', () => {
  const leads = ['angie-link', 'caleb-merrill'];
  assert.deepEqual(
    getAvailableProductionLeadPersonIds(leads, ['caleb-merrill']),
    ['caleb-merrill']
  );
  assert.equal(
    getNextProductionLeadPersonId('outside-producer', leads),
    'angie-link'
  );
  assert.equal(
    getNextProductionLeadPersonId('angie-link', leads),
    'caleb-merrill'
  );
  assert.equal(
    getNextProductionLeadPersonId('caleb-merrill', leads),
    ''
  );

  const toCaleb = buildProductionAdvance(
    { episode_id: 'episode-one', production_stage: 'lead_review' },
    {
      actorPersonId: 'angie-link',
      actorName: 'Angie Link',
      leadPersonIds: leads,
      advancedAt: '2026-07-25T12:00:00.000Z',
    }
  );
  assert.equal(toCaleb.production_stage, 'lead_review');
  assert.equal(toCaleb.production_lead_person_id, 'caleb-merrill');

  const complete = buildProductionAdvance(toCaleb, {
    actorPersonId: 'caleb-merrill',
    actorName: 'Caleb Merrill',
    leadPersonIds: leads,
    advancedAt: '2026-07-25T13:00:00.000Z',
  });
  assert.equal(complete.production_stage, 'complete');
  assert.equal(complete.production_lead_person_id, '');
  assert.equal(complete.production_completed_at, '2026-07-25T13:00:00.000Z');
});

test('producer approval creates the next actionable production-lead notification', () => {
  const episode = {
    episode_id: 'episode-one',
    title: 'Episode One',
    host_person_ids: ['host-1'],
    producer_person_id: 'angie-link',
    status: 'accepted',
    production_stage: 'lead_review',
    production_lead_person_id: 'caleb-merrill',
    staged_episode_url:
      'https://creators.spotify.com/pod/show/episode/preview',
    updated_at: '2026-07-25T12:00:00.000Z',
  };
  const entries = buildEpisodeNotificationEntries({
    previousEpisode: { ...episode, status: 'submitted' },
    episode,
    action: 'review',
    actorPersonId: 'angie-link',
    actorName: 'Angie Link',
    productionLeadPersonIds: ['angie-link', 'caleb-merrill'],
  });
  const leadEntry = entries.find(
    (entry) =>
      entry.notification.type === 'episode_ready_for_production_lead'
  );
  assert.equal(
    leadEntry.notification.recipient_person_id,
    'caleb-merrill'
  );
  assert.equal(leadEntry.notification.intent, 'actionable');
  assert.match(leadEntry.notification.preview, /staged Spotify listen/);
  assert.equal(
    entries.some(
      (entry) => entry.notification.recipient_person_id === 'angie-link'
    ),
    false
  );
});

test('episode events fan out to configured admins while keeping the actor quiet', () => {
  const previousEpisode = {
    episode_id: 'episode-admin-watch',
    title: 'Admin Watch',
    host_person_ids: ['cam-griffin', 'host-1'],
    producer_person_id: 'angie-link',
    created_by_person_id: 'cam-griffin',
    delivery_health: 'on_track',
    updated_at: '2026-07-25T12:00:00.000Z',
  };
  const created = buildEpisodeNotificationEntries({
    previousEpisode: null,
    episode: previousEpisode,
    action: 'create',
    actorPersonId: 'cam-griffin',
    actorName: 'Cam Griffin',
    adminPersonIds: ['cam-griffin', 'caleb-merrill'],
  });
  assert.deepEqual(
    created
      .map((entry) => entry.notification.recipient_person_id)
      .sort(),
    ['angie-link', 'caleb-merrill', 'host-1']
  );
  assert.equal(
    created.some(
      (entry) =>
        entry.notification.recipient_person_id === 'cam-griffin'
    ),
    false
  );
  assert.equal(
    created.find(
      (entry) =>
        entry.notification.recipient_person_id === 'caleb-merrill'
    ).notification.audit.recipient_reason,
    'studio_admin_observer'
  );

  const offTrack = buildEpisodeNotificationEntries({
    previousEpisode,
    episode: {
      ...previousEpisode,
      delivery_health: 'off_track',
      updated_at: '2026-07-25T12:10:00.000Z',
    },
    action: 'set_delivery_health',
    actorPersonId: 'cam-griffin',
    actorName: 'Cam Griffin',
    productionLeadPersonIds: ['angie-link', 'caleb-merrill'],
    adminPersonIds: ['cam-griffin', 'caleb-merrill'],
  });
  assert.deepEqual(
    offTrack
      .map((entry) => entry.notification.recipient_person_id)
      .sort(),
    ['angie-link', 'caleb-merrill', 'host-1']
  );
});

test('mic kit dry runs notify both managers, not the person testing their own action', () => {
  const request = {
    request_id: 'request-dry-run',
    requester_person_id: 'host-1',
    requester_name: 'Host One',
    status: 'requested',
    created_at: '2026-07-25T12:00:00.000Z',
    updated_at: '2026-07-25T12:00:00.000Z',
  };
  const submitted = buildMicKitNotificationEntries({
    previousTracker: { requests: [], kits: [] },
    tracker: {
      updated_at: request.updated_at,
      requests: [request],
      kits: [],
    },
    action: 'create_request',
    actorPersonId: 'host-1',
    actorName: 'Host One',
    managerPersonIds: ['cam-griffin', 'caleb-merrill'],
  });
  assert.deepEqual(
    submitted
      .map((entry) => entry.notification.recipient_person_id)
      .sort(),
    ['caleb-merrill', 'cam-griffin']
  );

  const updatedRequest = {
    ...request,
    status: 'approved',
    admin_response: 'A kit is available.',
    admin_updated_at: '2026-07-25T12:10:00.000Z',
    updated_at: '2026-07-25T12:10:00.000Z',
  };
  const updated = buildMicKitNotificationEntries({
    previousTracker: { requests: [request], kits: [] },
    tracker: {
      updated_at: updatedRequest.updated_at,
      requests: [updatedRequest],
      kits: [],
    },
    action: 'update_request',
    actorPersonId: 'caleb-merrill',
    actorName: 'Caleb Merrill',
    managerPersonIds: ['cam-griffin', 'caleb-merrill'],
  });
  assert.deepEqual(
    updated
      .map((entry) => entry.notification.recipient_person_id)
      .sort(),
    ['cam-griffin', 'host-1']
  );
});

test('mic kit inventory events group by kit and stay manager-only', () => {
  const previousKit = {
    kit_id: 'kit-one',
    label: 'Kit One',
    status: 'available',
  };
  const entries = buildMicKitNotificationEntries({
    previousTracker: { requests: [], kits: [previousKit] },
    tracker: {
      updated_at: '2026-07-25T12:10:00.000Z',
      requests: [],
      kits: [{ ...previousKit, status: 'maintenance' }],
    },
    action: 'update_kit',
    actorPersonId: 'cam-griffin',
    actorName: 'Cam Griffin',
    managerPersonIds: ['cam-griffin', 'caleb-merrill'],
  });
  assert.equal(entries.length, 1);
  assert.equal(
    entries[0].notification.recipient_person_id,
    'caleb-merrill'
  );
  assert.equal(entries[0].notification.group_key, 'mic-kit:kit-one');

  const visible = filterOpenableStudioNotifications(
    [
      {
        notification_id: 'kit-update',
        ...entries[0].notification,
      },
    ],
    {
      personId: 'caleb-merrill',
      permissions: ['mic_kits:manage'],
      micKitsById: new Map([['kit-one', previousKit]]),
    }
  );
  assert.equal(visible.length, 1);
  assert.equal(
    filterOpenableStudioNotifications(
      [
        {
          notification_id: 'kit-update',
          ...entries[0].notification,
        },
      ],
      {
        personId: 'caleb-merrill',
        permissions: ['mic_kits:read'],
        micKitsById: new Map([['kit-one', previousKit]]),
      }
    ).length,
    0
  );
});

test('notification recipient defaults keep Cameron and Caleb in operational scope', () => {
  assert.deepEqual(getStudioAdminNotificationPersonIds(''), [
    'cam-griffin',
    'caleb-merrill',
  ]);
  assert.deepEqual(getMicKitManagerPersonIds(''), [
    'cam-griffin',
    'caleb-merrill',
  ]);
});

test('Spotify staging links are constrained and survive episode normalization', () => {
  assert.equal(
    isSafeSpotifyStagingUrl(
      'https://creators.spotify.com/pod/show/episode/preview'
    ),
    true
  );
  assert.equal(
    isSafeSpotifyStagingUrl('https://open.spotify.com/episode/123'),
    true
  );
  assert.equal(
    isSafeSpotifyStagingUrl('https://spotify.example/episode/123'),
    false
  );
  assert.equal(
    isSafeSpotifyStagingUrl('javascript:alert(1)'),
    false
  );

  const episode = normalizeEpisodeStudio({
    episode_id: 'episode-one',
    title: 'Episode One',
    host_person_ids: ['host-1'],
    staged_episode_url:
      'https://creators.spotify.com/pod/show/episode/preview',
  });
  assert.equal(
    episode.staged_episode_url,
    'https://creators.spotify.com/pod/show/episode/preview'
  );
});
