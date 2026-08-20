import { TodayWorkspace } from '../studio';
import StudioLayout from '../../components/StudioLayout';
import {
  STUDIO_PREVIEW_EPISODES,
  STUDIO_PREVIEW_HREF_MAP,
  STUDIO_PREVIEW_MASTERMIND_OVERVIEW,
  STUDIO_PREVIEW_SEASON,
  STUDIO_PREVIEW_SESSION,
} from '../../lib/studioPreviewFixtures.mjs';

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
  episodes: STUDIO_PREVIEW_EPISODES,
  season: STUDIO_PREVIEW_SEASON,
  mastermind: STUDIO_PREVIEW_MASTERMIND_OVERVIEW,
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
  operations: null,
};

export async function getServerSideProps() {
  if (process.env.NODE_ENV === 'production') {
    return { notFound: true };
  }
  return { props: {} };
}

export default function TodayPreviewPage() {
  return (
    <StudioLayout
      requiredPermission="studio:read"
      previewSession={STUDIO_PREVIEW_SESSION}
      previewPath="/studio"
      previewHrefMap={STUDIO_PREVIEW_HREF_MAP}
      wide
    >
      <TodayWorkspace
        previewSession={STUDIO_PREVIEW_SESSION}
        previewWorkspace={previewWorkspace}
        previewHrefMap={STUDIO_PREVIEW_HREF_MAP}
      />
    </StudioLayout>
  );
}
