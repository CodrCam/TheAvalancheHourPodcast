import NotificationBell from '../../components/NotificationBell';
import NotificationCenter from '../../components/NotificationCenter';
import {
  buildEpisodeNotificationEntries,
} from '../../lib/episodeStudioEvents';
import {
  buildMicKitNotificationEntries,
} from '../../lib/micKitEvents';
import {
  groupStudioNotifications,
} from '../../lib/studioNotificationPresentation.mjs';

const PREVIEW_PERSON_ID = 'cam-griffin';
const ADMIN_PERSON_IDS = ['cam-griffin', 'caleb-merrill'];
const EPISODE_ID = 'notification-dry-run';
const REQUEST_ID = 'mic-kit-dry-run';

function materialize(entries, timestamp, prefix) {
  return entries
    .filter(
      (entry) =>
        entry.notification.recipient_person_id === PREVIEW_PERSON_ID
    )
    .map((entry, index) => ({
      ...entry.notification,
      notification_id: `${prefix}-${index + 1}`,
      created_at: new Date(
        new Date(timestamp).getTime() + index * 1000
      ).toISOString(),
    }));
}

const baseEpisode = {
  episode_id: EPISODE_ID,
  title: 'Synthetic Notification Check',
  host_person_ids: ['sierra-bishop'],
  producer_person_id: 'angie-link',
  created_by_person_id: 'sierra-bishop',
  status: 'planning',
  delivery_health: 'on_track',
  updated_at: '2026-07-26T05:00:00.000Z',
};

const episodeCreatedEntries = buildEpisodeNotificationEntries({
  previousEpisode: null,
  episode: baseEpisode,
  action: 'create',
  actorPersonId: 'sierra-bishop',
  actorName: 'Sierra Bishop',
  adminPersonIds: ADMIN_PERSON_IDS,
});

const discussionEpisode = {
  ...baseEpisode,
  updated_at: '2026-07-26T05:10:00.000Z',
  messages: [
    {
      message_id: 'dry-run-message',
      body: 'The synthetic production package is ready to review.',
    },
  ],
};
const discussionEntries = buildEpisodeNotificationEntries({
  previousEpisode: baseEpisode,
  episode: discussionEpisode,
  action: 'message',
  actorPersonId: 'sierra-bishop',
  actorName: 'Sierra Bishop',
  adminPersonIds: ADMIN_PERSON_IDS,
});

const offTrackEpisode = {
  ...discussionEpisode,
  delivery_health: 'off_track',
  updated_at: '2026-07-26T05:20:00.000Z',
};
const offTrackEntries = buildEpisodeNotificationEntries({
  previousEpisode: discussionEpisode,
  episode: offTrackEpisode,
  action: 'set_delivery_health',
  actorPersonId: 'angie-link',
  actorName: 'Angie Lake',
  productionLeadPersonIds: ['angie-link', 'caleb-merrill'],
  adminPersonIds: ADMIN_PERSON_IDS,
});

const micKitRequest = {
  request_id: REQUEST_ID,
  requester_person_id: 'sierra-bishop',
  requester_name: 'Sierra Bishop',
  status: 'requested',
  need_by: '2026-08-02',
  created_at: '2026-07-26T05:30:00.000Z',
  updated_at: '2026-07-26T05:30:00.000Z',
};
const micKitEntries = buildMicKitNotificationEntries({
  previousTracker: { requests: [], kits: [] },
  tracker: {
    updated_at: micKitRequest.updated_at,
    requests: [micKitRequest],
    kits: [],
  },
  action: 'create_request',
  actorPersonId: 'sierra-bishop',
  actorName: 'Sierra Bishop',
  managerPersonIds: ADMIN_PERSON_IDS,
});

const notifications = [
  ...materialize(
    episodeCreatedEntries,
    '2026-07-26T05:00:00.000Z',
    'episode-created'
  ),
  ...materialize(
    discussionEntries,
    '2026-07-26T05:10:00.000Z',
    'episode-discussion'
  ),
  ...materialize(
    offTrackEntries,
    '2026-07-26T05:20:00.000Z',
    'episode-off-track'
  ),
  ...materialize(
    micKitEntries,
    '2026-07-26T05:30:00.000Z',
    'mic-kit-request'
  ),
];

const scenarioChecks = [
  {
    label: 'Episode created',
    recipients: episodeCreatedEntries.map(
      (entry) => entry.notification.recipient_person_id
    ),
  },
  {
    label: 'Discussion posted',
    recipients: discussionEntries.map(
      (entry) => entry.notification.recipient_person_id
    ),
  },
  {
    label: 'Episode marked off track',
    recipients: offTrackEntries.map(
      (entry) => entry.notification.recipient_person_id
    ),
  },
  {
    label: 'Mic kit requested',
    recipients: micKitEntries.map(
      (entry) => entry.notification.recipient_person_id
    ),
  },
];

const previewData = {
  notifications,
  groups: groupStudioNotifications(notifications),
  unread_count: notifications.filter((notification) => !notification.read_at)
    .length,
};

export async function getServerSideProps(context) {
  if (process.env.NODE_ENV === 'production') {
    return { notFound: true };
  }
  return {
    props: {
      setupPreview: context.query.setup === '1',
    },
  };
}

export default function NotificationPreviewPage({ setupPreview = false }) {
  const displayData = setupPreview
    ? {
        notifications: [],
        groups: [],
        unread_count: 0,
        setup_required: true,
        error:
          'Notifications are temporarily unavailable while setup is completed.',
      }
    : previewData;
  return (
    <main
      style={{
        minHeight: '100vh',
        paddingBottom: 60,
        background: '#f3f6f5',
        color: '#142638',
      }}
    >
      <header
        aria-label="Studio utilities"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          minHeight: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px clamp(16px, 4vw, 48px)',
          borderBottom: '1px solid #dce4e5',
          background: 'rgba(248, 250, 249, .94)',
        }}
      >
        <strong>The Avalanche Hour · Notification preview</strong>
        <NotificationBell
          href="#notification-center"
          previewData={displayData}
        />
      </header>
      <div
        id="notification-center"
        style={{
          width: 'min(1040px, calc(100% - 32px))',
          margin: '36px auto 0',
        }}
      >
        <section
          style={{
            marginBottom: 24,
            padding: 20,
            border: '1px solid #dce4e5',
            borderRadius: 18,
            background: '#fff',
          }}
        >
          <strong>Synthetic recipient check</strong>
          <p>
            These scenarios call the real recipient builders with fake
            records. They never write to DynamoDB or notify a person.
          </p>
          <ul>
            {scenarioChecks.map((scenario) => (
              <li key={scenario.label}>
                {scenario.label}: {scenario.recipients.join(', ') || 'none'}
              </li>
            ))}
          </ul>
        </section>
        <NotificationCenter bare previewData={displayData} />
      </div>
    </main>
  );
}
