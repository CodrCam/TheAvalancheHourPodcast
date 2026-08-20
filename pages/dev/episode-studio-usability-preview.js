import { useRouter } from 'next/router';
import EpisodeStudioWorkspace from '../../components/EpisodeStudioWorkspace';
import StudioLayout from '../../components/StudioLayout';
import { createDefaultEpisodeProductionTasks } from '../../lib/episodeProductionPlan.mjs';
import { normalizeEpisodeStudio } from '../../lib/episodeStudioPresentation.mjs';
import {
  STUDIO_PREVIEW_HREF_MAP,
  STUDIO_PREVIEW_SESSION,
} from '../../lib/studioPreviewFixtures.mjs';

const PREVIEW_EPISODE = normalizeEpisodeStudio({
  episode_id: 'studio-usability-preview',
  title: 'Slabs and Sluffs — Listener Calls',
  season: 'Season 11',
  status: 'in_progress',
  target_release_date: '2026-08-19',
  due_date: '2026-08-12',
  recording_date: '2026-08-06',
  recording_time: '10:00',
  recording_time_zone: 'America/Los_Angeles',
  recording_duration_minutes: 60,
  recording_location: 'https://riverside.fm/studio/avalanche-hour',
  producer_person_id: 'caleb-merrill',
  producer_email: 'producer@example.com',
  host_person_ids: ['cam-griffin'],
  production_tasks: createDefaultEpisodeProductionTasks('2026-08-19'),
  delivery_health: 'on_track',
  producer_directions:
    'Open with the strongest listener call, then move into the field report.',
  producer_feedback: '',
  staged_episode_url: '',
  messages: [
    {
      message_id: 'preview-message',
      author_name: 'Caleb Merrill',
      author_role: 'producer',
      body: 'Please identify the cleanest listener calls before the recording session.',
      created_at: '2026-07-26T16:30:00.000Z',
    },
  ],
});

const PREVIEW_DATA = {
  episode: PREVIEW_EPISODE,
  host_names: ['Cam Griffin'],
  people: [
    { person_id: 'cam-griffin', name: 'Cam Griffin' },
    { person_id: 'angie-link', name: 'Angie Lake' },
    { person_id: 'sierra-bishop', name: 'Sierra Bishop' },
  ],
  producers: [
    {
      person_id: 'caleb-merrill',
      name: 'Caleb Merrill',
      account_email: 'producer@example.com',
    },
  ],
  canManage: true,
  canHost: true,
  canReview: true,
  canConfigure: true,
  canAdminOverride: true,
  canAdvanceProduction: false,
  production_handoff_available: false,
  production_lead_name: '',
  episode_roles: ['host', 'producer'],
  viewer_person_id: 'cam-griffin',
  available_sponsor_reads: [],
  asset_uploads_configured: true,
  canUploadAssets: true,
  canUseHostPreview: true,
  list_href: '/dev/studio-production-preview',
};

export async function getServerSideProps({ req }) {
  const forwardedHost = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  const requestHost = forwardedHost || String(req.headers.host || '').trim();
  const isLocalPreview = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(
    requestHost
  );

  if (process.env.NODE_ENV === 'production' && !isLocalPreview) {
    return { notFound: true };
  }

  return { props: {} };
}

export default function EpisodeStudioUsabilityPreview() {
  const router = useRouter();
  const workspaceView =
    router.query.workspace === 'production' ? 'production' : 'package';
  const producerObserver = router.query.viewer === 'producer';
  const previewData = producerObserver
    ? {
        ...PREVIEW_DATA,
        canManage: false,
        canHost: false,
        canReview: false,
        canConfigure: false,
        canAdminOverride: false,
        canUploadAssets: false,
        canUseHostPreview: false,
        hostDraftReadOnly: true,
        episode_roles: ['producer'],
        viewer_person_id: 'caleb-merrill',
      }
    : PREVIEW_DATA;
  return (
    <StudioLayout
      requiredPermission="episodes:read"
      previewSession={STUDIO_PREVIEW_SESSION}
      previewPath={
        workspaceView === 'production'
          ? '/studio/episodes/studio-usability-preview/production'
          : '/studio/episodes/studio-usability-preview'
      }
      previewHrefMap={STUDIO_PREVIEW_HREF_MAP}
      wide
    >
      <EpisodeStudioWorkspace
        previewData={previewData}
        previewInStudio
        workspaceView={workspaceView}
      />
    </StudioLayout>
  );
}
