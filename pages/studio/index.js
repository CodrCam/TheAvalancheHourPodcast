import { useEffect, useState } from 'react';
import Link from 'next/link';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import PodcastsRoundedIcon from '@mui/icons-material/PodcastsRounded';
import HeadsetMicRoundedIcon from '@mui/icons-material/HeadsetMicRounded';
import StudioLayout from '../../components/StudioLayout';
import styles from '../../styles/Studio.module.css';

export default function StudioHomePage() {
  const [guide, setGuide] = useState(null);

  useEffect(() => {
    let alive = true;

    async function loadGuide() {
      try {
        const response = await fetch('/api/studio/resources', {
          credentials: 'same-origin',
        });
        const data = await response.json();
        if (alive && response.ok) setGuide(data.guide || null);
      } catch {
        // The primary navigation remains available if the preview cannot load.
      }
    }

    loadGuide();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <StudioLayout requiredPermission="studio:read">
      <section className={styles.hero}>
        <span className={styles.eyebrow}>Private team workspace</span>
        <h1>{guide?.title || 'Host Studio'}</h1>
        <p>
          {guide?.intro ||
            'Prepare with confidence, find the current production resources, and keep your public profile up to date.'}
        </p>
        <div className={styles.heroMeta}>
          <span>Season 11</span>
          <span>{guide?.sections?.length || 0} published guide sections</span>
          <span>Built for hosts and producers</span>
        </div>
      </section>

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

      <section className={styles.cardGrid} aria-label="Host Studio shortcuts">
        <Link href="/studio/episodes" className={styles.actionCard}>
          <span className={styles.actionCardIcon}>
            <PodcastsRoundedIcon aria-hidden="true" />
          </span>
          <h2>Open My Episodes</h2>
          <p>
            Open episodes connected to you as a host, producer, or creator and
            keep each production package moving.
          </p>
        </Link>
        <Link href="/studio/resources" className={styles.actionCard}>
          <span className={styles.actionCardIcon}>
            <MenuBookRoundedIcon aria-hidden="true" />
          </span>
          <h2>Explore the Host Guide</h2>
          <p>
            Search recording, interview, delivery, and season resources in one
            organized guide.
          </p>
        </Link>
        <Link href="/studio/profile" className={styles.actionCard}>
          <span className={styles.actionCardIcon}>
            <AccountCircleRoundedIcon aria-hidden="true" />
          </span>
          <h2>Update My Profile</h2>
          <p>
            Control the biography and photography that appear on your public
            Avalanche Hour profile.
          </p>
        </Link>
        <Link href="/studio/mic-kits" className={styles.actionCard}>
          <span className={styles.actionCardIcon}>
            <HeadsetMicRoundedIcon aria-hidden="true" />
          </span>
          <h2>Find a Mic Kit</h2>
          <p>
            Request a mobile kit, see where each case is, and follow the next
            handoff without a group email.
          </p>
        </Link>
        <Link href="/studio/resources?category=Getting+started" className={styles.actionCard}>
          <span className={styles.actionCardIcon}>
            <GroupsRoundedIcon aria-hidden="true" />
          </span>
          <h2>Start Here</h2>
          <p>
            New to the team? Begin with expectations, training, the season
            schedule, and the episode workflow.
          </p>
        </Link>
      </section>
    </StudioLayout>
  );
}
