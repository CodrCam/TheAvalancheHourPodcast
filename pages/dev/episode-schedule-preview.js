import { useState } from 'react';
import {
  EpisodeRecordingFields,
  EpisodeRecordingSummary,
} from '../../components/EpisodeRecordingSchedule';
import styles from '../../styles/EpisodeStudio.module.css';

const previewEpisode = {
  episode_id: 'forecasting-through-change',
  title: 'Forecasting Through Change',
  recording_date: '2026-08-01',
  recording_time: '10:30',
  recording_time_zone: 'America/Denver',
  recording_duration_minutes: 60,
  recording_location: 'https://riverside.fm/studio/avalanche-hour',
};

export async function getServerSideProps() {
  if (process.env.NODE_ENV === 'production') {
    return { notFound: true };
  }
  return { props: {} };
}

export default function EpisodeSchedulePreviewPage() {
  const [episode, setEpisode] = useState(previewEpisode);

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '48px 0 80px',
        color: '#142638',
        background:
          'linear-gradient(150deg, #f8f7f2 0%, #f1f4f3 52%, #eef2f2 100%)',
      }}
    >
      <div style={{ width: 'min(980px, calc(100% - 32px))', margin: '0 auto' }}>
        <EpisodeRecordingSummary episode={episode} onDownload={() => {}} />
        <section className={styles.producerPanel}>
          <div className={styles.panelHeading}>
            <div>
              <span className={styles.eyebrow}>Producer setup</span>
              <h2>Schedule and assignments</h2>
            </div>
            <span>Preview</span>
          </div>
          <div className={styles.producerGrid}>
            <EpisodeRecordingFields
              schedule={episode}
              onChange={(patch) =>
                setEpisode((current) => ({ ...current, ...patch }))
              }
            />
          </div>
        </section>
      </div>
    </main>
  );
}
