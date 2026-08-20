import SeasonMastermindWorkspace from '../../components/SeasonMastermindWorkspace';
import { isSeasonMastermindConfigured } from '../../lib/seasonMastermindClient.mjs';
import {
  LOCAL_SEASON_MASTERMIND_PREVIEW,
  shouldUseLocalSeasonMastermindPreview,
} from '../../lib/seasonMastermindLocalPreview.mjs';

export async function getServerSideProps() {
  return {
    props: {
      useLocalSample:
        shouldUseLocalSeasonMastermindPreview({
          nodeEnv: process.env.NODE_ENV,
          configured: isSeasonMastermindConfigured(),
        }),
    },
  };
}

export default function StudioMastermindPage({
  previewData = null,
  useLocalSample = false,
}) {
  return (
    <SeasonMastermindWorkspace
      previewInStudio
      previewData={
        previewData ||
        (useLocalSample ? LOCAL_SEASON_MASTERMIND_PREVIEW : null)
      }
    />
  );
}
