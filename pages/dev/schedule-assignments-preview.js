import { EpisodeStudiosDashboard } from '../admin/studios';
import {
  STUDIO_PREVIEW_EPISODES,
  STUDIO_PREVIEW_HREF_MAP,
  STUDIO_PREVIEW_SESSION,
} from '../../lib/studioPreviewFixtures.mjs';

export async function getServerSideProps() {
  if (process.env.NODE_ENV === 'production') return { notFound: true };
  return { props: {} };
}

export default function ScheduleAssignmentsPreviewPage() {
  return (
    <EpisodeStudiosDashboard
      studioLayout
      previewData={{
        configured: true,
        episodes: STUDIO_PREVIEW_EPISODES,
        people: [],
        producers: [],
        session: STUDIO_PREVIEW_SESSION,
        href_map: STUDIO_PREVIEW_HREF_MAP,
        episode_href: '/dev/episode-studio-usability-preview',
        view_month: '2026-10',
      }}
    />
  );
}
