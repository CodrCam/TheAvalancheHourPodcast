import StudioFeaturedResourceTraining from '../../components/StudioFeaturedResourceTraining';
import styles from '../../styles/Studio.module.css';

const previewVideos = [
  {
    id: 'resource-video-8e3bc362-e7df-44f1-8a13-759e9240113e',
    title: 'Host Walkthrough',
    description:
      'Watch this complete walkthrough of the host workflow before preparing and delivering an episode.',
    file_name: 'Host Walkthrough.mp4',
    content_type: 'video/mp4',
    size: 1184604164,
    active: true,
    featured: true,
  },
];

export async function getServerSideProps() {
  if (process.env.NODE_ENV === 'production') return { notFound: true };
  return { props: {} };
}

export default function ResourceVideoPreviewPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '38px 0 80px',
        color: '#142638',
        background:
          'linear-gradient(150deg, #f8f7f2 0%, #f1f4f3 52%, #eef2f2 100%)',
      }}
    >
      <div style={{ width: 'min(1180px, calc(100% - 32px))', margin: '0 auto' }}>
        <header className={styles.pageHeader}>
          <div>
            <span className={styles.eyebrow}>The Avalanche Hour team</span>
            <h1>Resource Center</h1>
            <p>
              Search a task or question, follow the walkthrough for the right
              workspace, and understand what the next person needs from you.
            </p>
          </div>
        </header>
        <StudioFeaturedResourceTraining videos={previewVideos} />
      </div>
    </main>
  );
}
