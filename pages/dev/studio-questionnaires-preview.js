import StudioWorkflowHub from '../../components/StudioWorkflowHub';
import {
  STUDIO_PREVIEW_EPISODES,
  STUDIO_PREVIEW_HREF_MAP,
  STUDIO_PREVIEW_SESSION,
} from '../../lib/studioPreviewFixtures.mjs';

export async function getServerSideProps() {
  if (process.env.NODE_ENV === 'production') return { notFound: true };
  return { props: {} };
}

export default function StudioQuestionnairesPreviewPage() {
  return (
    <StudioWorkflowHub
      kind="questionnaires"
      previewSession={STUDIO_PREVIEW_SESSION}
      previewEpisodes={STUDIO_PREVIEW_EPISODES}
      previewPath="/studio/questionnaires"
      previewHrefMap={STUDIO_PREVIEW_HREF_MAP}
    />
  );
}

