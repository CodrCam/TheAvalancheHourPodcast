import NotificationBell from '../../components/NotificationBell';
import NotificationCenter from '../../components/NotificationCenter';
import {
  groupStudioNotifications,
} from '../../lib/studioNotificationPresentation.mjs';

const notifications = [
  {
    notification_id: 'episode-submitted',
    recipient_person_id: 'caleb-merrill',
    type: 'episode_ready_for_production_lead',
    category: 'episode',
    kind: 'event',
    urgency: 'high',
    intent: 'actionable',
    title: 'Episode 12 is ready for your production check',
    preview:
      'Angie accepted the host package and attached a staged Spotify listen.',
    actor_name: 'Angie Link',
    entity_kind: 'episode',
    entity_id: 'episode-12',
    group_entity_kind: 'episode',
    group_entity_id: 'episode-12',
    group_key: 'episode:episode-12',
    deep_link: '/studio/episodes/episode-12#producer-review',
    created_at: '2026-07-26T05:23:00.000Z',
  },
  {
    notification_id: 'episode-file',
    recipient_person_id: 'caleb-merrill',
    type: 'episode_required_file_uploaded',
    category: 'episode',
    kind: 'event',
    urgency: 'normal',
    intent: 'informational',
    title: 'Brooke uploaded a file to Episode 12',
    preview:
      'The Riverside tracks are available in the final asset package.',
    actor_name: 'Brooke Edwards',
    entity_kind: 'episode_asset',
    entity_id: 'asset-riverside',
    group_entity_kind: 'episode',
    group_entity_id: 'episode-12',
    group_key: 'episode:episode-12',
    deep_link: '/studio/episodes/episode-12#final-assets',
    created_at: '2026-07-26T05:05:00.000Z',
  },
  {
    notification_id: 'episode-discussion',
    recipient_person_id: 'caleb-merrill',
    type: 'episode_discussion_message',
    category: 'episode',
    kind: 'event',
    urgency: 'normal',
    intent: 'informational',
    title: 'Angie posted in Episode 12',
    preview: 'The staged listen is clean. Please check the final sponsor bed.',
    actor_name: 'Angie Link',
    entity_kind: 'episode',
    entity_id: 'episode-12',
    group_entity_kind: 'episode',
    group_entity_id: 'episode-12',
    group_key: 'episode:episode-12',
    deep_link: '/studio/episodes/episode-12#discussion',
    created_at: '2026-07-26T04:49:00.000Z',
  },
  {
    notification_id: 'mic-kit',
    recipient_person_id: 'caleb-merrill',
    type: 'mic_kit_receipt_confirmed',
    category: 'mic_kit',
    kind: 'event',
    urgency: 'normal',
    intent: 'administrative',
    title: 'Jason confirmed mic kit receipt',
    preview:
      'The kit is recorded with the host and the shared inventory is current.',
    actor_name: 'Jason Antin',
    entity_kind: 'mic_kit_request',
    entity_id: 'mic-request-jason',
    group_entity_kind: 'mic_kit_request',
    group_entity_id: 'mic-request-jason',
    group_key: 'mic-kit-request:mic-request-jason',
    deep_link: '/admin/mic-kits#mic-request-jason',
    created_at: '2026-07-26T02:27:00.000Z',
    read_at: '2026-07-26T03:27:00.000Z',
    seen_at: '2026-07-26T03:27:00.000Z',
  },
  {
    notification_id: 'overdue',
    recipient_person_id: 'caleb-merrill',
    type: 'episode_overdue',
    category: 'episode',
    kind: 'reminder',
    urgency: 'urgent',
    intent: 'urgent',
    title: 'Episode 13 host package is overdue',
    preview:
      'The planned handoff date passed and the episode has not reached producer review.',
    entity_kind: 'episode',
    entity_id: 'episode-13',
    group_entity_kind: 'episode',
    group_entity_id: 'episode-13',
    group_key: 'episode:episode-13',
    deep_link: '/studio/episodes/episode-13',
    created_at: '2026-07-25T04:27:00.000Z',
  },
];

const previewData = {
  notifications,
  groups: groupStudioNotifications(notifications),
  unread_count: notifications.filter((notification) => !notification.read_at)
    .length,
};

export async function getServerSideProps() {
  if (process.env.NODE_ENV === 'production') {
    return { notFound: true };
  }
  return { props: {} };
}

export default function NotificationPreviewPage() {
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
          previewData={previewData}
        />
      </header>
      <div
        id="notification-center"
        style={{
          width: 'min(1040px, calc(100% - 32px))',
          margin: '36px auto 0',
        }}
      >
        <NotificationCenter bare previewData={previewData} />
      </div>
    </main>
  );
}
