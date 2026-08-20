import { useRouter } from 'next/router';
import SeasonMastermindWorkspace from '../../components/SeasonMastermindWorkspace';
import StudioLayout from '../../components/StudioLayout';
import { LOCAL_SEASON_MASTERMIND_PREVIEW } from '../../lib/seasonMastermindLocalPreview.mjs';
import {
  STUDIO_PREVIEW_HREF_MAP,
  STUDIO_PREVIEW_SESSION,
} from '../../lib/studioPreviewFixtures.mjs';

const previewData = {
  ...LOCAL_SEASON_MASTERMIND_PREVIEW,
  viewer_person_id: 'caleb-merrill',
};

export async function getServerSideProps() {
  if (process.env.NODE_ENV === 'production') return { notFound: true };
  return { props: {} };
}

export default function SeasonMastermindPreviewPage() {
  const router = useRouter();
  const previewState = String(router.query.state || 'ready');
  const data = {
    ...previewData,
    preview_state: previewState,
    featureEnabled: previewState !== 'disabled',
    configured: previewState !== 'unconfigured',
    error:
      previewState === 'error'
        ? 'The preview is showing the recoverable service error state.'
        : '',
    ...(previewState === 'empty' ? { seasons: [], plans: [] } : {}),
    ...(previewState === 'host-empty'
      ? { canManage: false, seasons: [], plans: [] }
      : {}),
  };

  return (
    <StudioLayout
      requiredPermission="mastermind:read"
      previewSession={STUDIO_PREVIEW_SESSION}
      previewPath="/studio/mastermind"
      previewHrefMap={STUDIO_PREVIEW_HREF_MAP}
      wide
    >
      <SeasonMastermindWorkspace key={previewState} previewData={data} />
    </StudioLayout>
  );
}
