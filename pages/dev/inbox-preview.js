import StudioInboxPage from '../studio/inbox';

const previewData = {
  configured: true,
  canManage: true,
  viewer_person_id: 'caleb-merrill',
  showCreate: true,
  assignees: [
    { person_id: 'caleb-merrill', name: 'Caleb Merrill' },
    { person_id: 'dom-baker', name: 'Dom Baker' },
    { person_id: 'angie-link', name: 'Angie Link' },
  ],
  items: [
    {
      item_id: 'recording-room-access',
      kind: 'blocker',
      title: 'Recording room access for Saturday',
      details:
        'The guest can join, but the host account is still seeing the old recording room. We need the current Riverside room confirmed before the tech check.',
      status: 'new',
      priority: 'high',
      target_date: '2026-07-29',
      assigned_to_person_id: '',
      assigned_to_name: '',
      created_by_person_id: 'dom-baker',
      created_by_name: 'Dom Baker',
      created_by_role: 'host',
      created_at: '2026-07-26T15:00:00.000Z',
      updated_at: '2026-07-26T15:00:00.000Z',
      comments: [
        {
          comment_id: 'comment-one',
          body: 'I tested the previous link in the field guide and it redirects to the old room.',
          author_person_id: 'dom-baker',
          author_name: 'Dom Baker',
          author_role: 'host',
          created_at: '2026-07-26T15:10:00.000Z',
        },
      ],
    },
    {
      item_id: 'guest-release',
      kind: 'request',
      title: 'Put the current guest release in the guide',
      details:
        'A shared copy would keep everyone from asking for the latest version.',
      status: 'reviewing',
      priority: 'normal',
      target_date: '',
      assigned_to_person_id: 'angie-link',
      assigned_to_name: 'Angie Link',
      created_by_person_id: 'host-two',
      created_by_name: 'Host Two',
      created_by_role: 'host',
      created_at: '2026-07-25T14:00:00.000Z',
      updated_at: '2026-07-25T16:00:00.000Z',
      comments: [],
    },
    {
      item_id: 'episode-template',
      kind: 'idea',
      title: 'Start each Episode Studio from a reusable outline',
      details:
        'A short reusable outline could make guest research and handoff notes more consistent.',
      status: 'planned',
      priority: 'normal',
      target_date: '2026-08-15',
      assigned_to_person_id: 'caleb-merrill',
      assigned_to_name: 'Caleb Merrill',
      created_by_person_id: 'host-three',
      created_by_name: 'Host Three',
      created_by_role: 'host',
      created_at: '2026-07-24T13:00:00.000Z',
      updated_at: '2026-07-25T13:00:00.000Z',
      comments: [],
    },
  ],
};

export async function getServerSideProps() {
  if (process.env.NODE_ENV === 'production') {
    return { notFound: true };
  }
  return { props: {} };
}

export default function InboxPreviewPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '42px 0 80px',
        color: '#142638',
        background:
          'linear-gradient(150deg, #f8f7f2 0%, #f1f4f3 52%, #eef2f2 100%)',
      }}
    >
      <div style={{ width: 'min(1260px, calc(100% - 32px))', margin: '0 auto' }}>
        <StudioInboxPage previewData={previewData} />
      </div>
    </main>
  );
}
