import SlabsAndSluffsCallout from '../../components/SlabsAndSluffsCallout';

const UPCOMING = {
  phase: 'upcoming',
  release_date: '2026-08-28',
  episode_title: 'Slabs and Sluffs · August',
  episode_url: '',
};

const RECENT = {
  phase: 'recent',
  release_date: '2026-07-25',
  episode_title: 'Slabs and Sluffs with Dom and Sara · July',
  episode_url: 'https://open.spotify.com/episode/example',
};

export async function getServerSideProps() {
  if (process.env.NODE_ENV === 'production') return { notFound: true };
  return { props: {} };
}

export default function SlabsAndSluffsPreviewPage() {
  return (
    <main
      style={{
        display: 'grid',
        gap: 34,
        minHeight: '100vh',
        padding: '48px clamp(18px, 5vw, 70px)',
        background: '#f4f6f2',
      }}
    >
      <SlabsAndSluffsCallout previewCampaign={UPCOMING} />
      <SlabsAndSluffsCallout previewCampaign={RECENT} />
    </main>
  );
}
