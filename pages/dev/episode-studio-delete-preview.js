import { useState } from 'react';
import EpisodeStudioDeletionControl from '../../components/EpisodeStudioDeletionControl';

const PREVIEW_EPISODE = {
  episode_id: 'field-notes-preview',
  title: 'Field Notes from the Selkirks',
  assets: [
    { asset_id: 'voice', size: 734003200 },
    { asset_id: 'cover', size: 6291456 },
    { asset_id: 'notes', size: 524288 },
  ],
};

export async function getServerSideProps() {
  if (process.env.NODE_ENV === 'production') return { notFound: true };
  return { props: {} };
}

export default function EpisodeStudioDeletePreview() {
  const [message, setMessage] = useState('');

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '64px clamp(18px, 6vw, 90px)',
        background: '#f2f5f3',
      }}
    >
      <div style={{ width: 'min(100%, 980px)', margin: '0 auto' }}>
        <h1 style={{ margin: 0, color: '#142638' }}>
          {PREVIEW_EPISODE.title}
        </h1>
        <p style={{ color: '#687781' }}>
          Episode Studio deletion confirmation preview
        </p>
        <EpisodeStudioDeletionControl
          episode={PREVIEW_EPISODE}
          onDelete={() =>
            setMessage(
              'The production screen will now delete stored files before removing the Studio record.'
            )
          }
        />
        {message ? (
          <p style={{ color: '#2f7355', fontWeight: 700 }}>{message}</p>
        ) : null}
      </div>
    </main>
  );
}
