import { TodayWorkspace } from '../studio';

const previewSession = {
  display_name: 'Caleb Merrill',
  username: 'caleb@example.com',
  groups: ['admin'],
  permissions: [
    'studio:read',
    'resources:read',
    'episodes:read',
    'episodes:manage',
    'profile:self:read',
    'mic_kits:read',
    'mic_kits:manage',
    'orders:read',
    'inventory:read',
    'products:read',
    'intake:read',
    'intake:create',
    'intake:manage',
  ],
};

const previewWorkspace = {
  guide: {
    title: 'Season 11 Team Field Guide',
    sections: new Array(14).fill(null),
    announcement: {
      enabled: true,
      title: 'Host packages are due one week before release',
      body:
        'Use the Episode Studio deadline as the source of truth and flag any schedule conflict in the episode discussion.',
    },
  },
  episodes: [
    {
      episode_id: 'forecasting-through-change',
      title: 'Forecasting Through Change',
      status: 'in_progress',
      due_date: '2026-07-29',
      target_release_date: '2026-08-05',
      delivery_health: 'off_track',
      completion: { host_percent: 55 },
      my_roles: ['creator'],
    },
    {
      episode_id: 'mentorship-in-the-mountains',
      title: 'Mentorship in the Mountains',
      status: 'submitted',
      due_date: '2026-08-01',
      target_release_date: '2026-08-08',
      delivery_health: 'on_track',
      completion: { host_percent: 100 },
      my_roles: [],
    },
    {
      episode_id: 'snowpack-communication',
      title: 'Snowpack Communication',
      status: 'in_progress',
      due_date: '2026-08-06',
      target_release_date: '2026-08-13',
      delivery_health: 'on_track',
      completion: { host_percent: 72 },
      my_roles: [],
    },
  ],
  micKits: {
    tracker: { requests: [], kits: [] },
    automation: {
      actions: [
        {
          action_id: 'label-us-kit-2',
          title: 'Create the label for TAH US Kit 2',
          detail: 'Shipment to Dom Baker is due Jul 28.',
          urgency: 'high',
        },
      ],
      metrics: { open_requests: 2 },
    },
  },
  intake: {
    viewer_person_id: 'caleb-merrill',
    summary: { open: 2 },
    items: [
      {
        item_id: 'recording-room-access',
        kind: 'blocker',
        title: 'Recording room access for Saturday',
        status: 'new',
        priority: 'high',
        created_by_name: 'Dom Baker',
        assigned_to_person_id: '',
        target_date: '2026-07-29',
      },
    ],
  },
  operations: {
    orders: { unshipped: 3 },
    inventory: { low_stock: 2, sold_out: 1 },
  },
};

export async function getServerSideProps() {
  if (process.env.NODE_ENV === 'production') {
    return { notFound: true };
  }
  return { props: {} };
}

export default function TodayPreviewPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '32px 0 70px',
        color: '#142638',
        background:
          'linear-gradient(150deg, #f8f7f2 0%, #f1f4f3 52%, #eef2f2 100%)',
      }}
    >
      <div style={{ width: 'min(1180px, calc(100% - 32px))', margin: '0 auto' }}>
        <TodayWorkspace
          previewSession={previewSession}
          previewWorkspace={previewWorkspace}
        />
      </div>
    </main>
  );
}
