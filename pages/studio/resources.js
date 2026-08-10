import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import StudioLayout from '../../components/StudioLayout';
import ResourceModeSwitch from '../../components/ResourceModeSwitch';
import StudioResourceLibrary from '../../components/StudioResourceLibrary';
import StudioFeaturedResourceTraining from '../../components/StudioFeaturedResourceTraining';
import StudioResourcePathways from '../../components/StudioResourcePathways';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import styles from '../../styles/Studio.module.css';

export default function StudioResourcesPage() {
  const router = useRouter();
  const [guide, setGuide] = useState(null);
  const [updatedAt, setUpdatedAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [resourcePaths, setResourcePaths] = useState([]);
  const [defaultResourcePath, setDefaultResourcePath] = useState('host');

  useEffect(() => {
    let alive = true;

    async function loadResources() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/studio/resources', {
          credentials: 'same-origin',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not load the Host Guide.');
        }
        if (!alive) return;
        setGuide(data.guide || null);
        setUpdatedAt(data.updated_at || '');
        setCanEdit(data.canEdit === true);
        setResourcePaths(data.resource_paths || []);
        setDefaultResourcePath(data.default_resource_path || 'host');
      } catch (err) {
        if (alive) setError(err.message || 'Could not load the Host Guide.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadResources();
    return () => {
      alive = false;
    };
  }, []);

  const requestedPath =
    typeof router.query.path === 'string' ? router.query.path : '';
  const activePath =
    resourcePaths.find((pathway) => pathway.id === requestedPath) ||
    resourcePaths.find((pathway) => pathway.id === defaultResourcePath) ||
    resourcePaths[0];
  const showHostGuide = activePath?.id === 'host';
  const featuredVideos = showHostGuide
    ? (guide?.sections || [])
        .flatMap((section) => section.videos || [])
        .filter((video) => video.featured === true)
    : [];

  return (
    <StudioLayout>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>The Avalanche Hour team</span>
          <h1>Resource Center</h1>
          <p>
            Search a task or question, follow the walkthrough for the right
            workspace, and understand what the next person needs from you.
          </p>
        </div>
        <div className={styles.resourceHeaderActions}>
          <ResourceModeSwitch activeMode="view" canEdit={canEdit} />
        </div>
      </header>

      {guide?.announcement?.enabled ? (
        <section className={styles.announcement}>
          <span className={styles.announcementIcon}>
            <CampaignRoundedIcon aria-hidden="true" />
          </span>
          <div>
            <h2>{guide.announcement.title}</h2>
            <p>{guide.announcement.body}</p>
          </div>
        </section>
      ) : null}

      {error ? <p className={styles.errorMessage}>{error}</p> : null}
      {loading ? <p className={styles.notice}>Opening team resources…</p> : null}

      {!loading && !error ? (
        <>
          <StudioFeaturedResourceTraining videos={featuredVideos} />
          <StudioResourcePathways
            key={activePath?.id || 'resources'}
            pathways={resourcePaths}
            activePathId={activePath?.id}
          />
          {showHostGuide ? (
            <section
              className={styles.hostGuideSection}
              aria-labelledby="host-guide-heading"
            >
              <div className={styles.workflowHeading}>
                <div>
                  <span className={styles.eyebrow}>
                    Deeper host instruction manual
                  </span>
                  <h2 id="host-guide-heading">
                    {guide?.title || 'Host Guide'}
                  </h2>
                  <p>
                    The quick path above tells you what comes next. This
                    searchable field manual explains exactly how to prepare,
                    run Riverside, protect the recordings, shape the story,
                    and deliver a producer-ready episode.
                  </p>
                </div>
              </div>
              <StudioResourceLibrary
                guide={guide}
                updatedAt={updatedAt}
                showHeader={false}
                showAnnouncement={false}
                hideFeaturedVideos
              />
            </section>
          ) : null}
        </>
      ) : null}
    </StudioLayout>
  );
}
