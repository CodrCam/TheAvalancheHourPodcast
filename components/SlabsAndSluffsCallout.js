import { useEffect, useMemo, useState } from 'react';
import CallRoundedIcon from '@mui/icons-material/CallRounded';
import HeadphonesRoundedIcon from '@mui/icons-material/HeadphonesRounded';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import {
  SLABS_AND_SLUFFS_PHONE_DISPLAY,
  SLABS_AND_SLUFFS_PHONE_HREF,
  buildSlabsAndSluffsCampaign,
} from '../lib/slabsAndSluffsCampaign.mjs';
import styles from '../styles/VoicemailCampaign.module.css';

function formatReleaseDate(value) {
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
  });
}

export default function SlabsAndSluffsCallout({
  publishedEpisodes,
  previewCampaign = null,
  compact = false,
}) {
  const [scheduledCampaign, setScheduledCampaign] = useState(
    previewCampaign?.phase === 'upcoming' ? previewCampaign : null
  );
  const [loadedPublishedEpisodes, setLoadedPublishedEpisodes] = useState(
    Array.isArray(publishedEpisodes) ? publishedEpisodes : []
  );

  useEffect(() => {
    if (previewCampaign) return undefined;
    let alive = true;

    async function loadCampaign() {
      const requests = [
        fetch('/api/site-content/slabs-and-sluffs-campaign'),
        ...(Array.isArray(publishedEpisodes)
          ? []
          : [fetch('/api/spotify?limit=10')]),
      ];

      try {
        const responses = await Promise.all(requests);
        const scheduleData = await responses[0].json();
        if (alive && responses[0].ok) {
          setScheduledCampaign(scheduleData.campaign || null);
        }
        if (alive && responses[1]?.ok) {
          const episodeData = await responses[1].json();
          setLoadedPublishedEpisodes(
            Array.isArray(episodeData) ? episodeData : []
          );
        }
      } catch {
        // The campaign is promotional; the page remains complete without it.
      }
    }

    loadCampaign();
    return () => {
      alive = false;
    };
  }, [previewCampaign, publishedEpisodes]);

  const campaign = useMemo(
    () =>
      previewCampaign ||
      scheduledCampaign ||
      buildSlabsAndSluffsCampaign({
        publishedEpisodes: Array.isArray(publishedEpisodes)
          ? publishedEpisodes
          : loadedPublishedEpisodes,
      }),
    [
      loadedPublishedEpisodes,
      previewCampaign,
      publishedEpisodes,
      scheduledCampaign,
    ]
  );

  if (!campaign) return null;

  const releaseDate = formatReleaseDate(campaign.release_date);
  const upcoming = campaign.phase === 'upcoming';

  return (
    <section
      className={`${styles.callout} ${
        compact ? styles.calloutCompact : ''
      }`}
      aria-label="Slabs and Sluffs listener call line"
    >
      <span className={styles.signalIcon} aria-hidden="true">
        <GraphicEqRoundedIcon />
      </span>
      <div className={styles.copy}>
        <span>Slabs and Sluffs · listener call line</span>
        <h2>
          {upcoming
            ? `The ${releaseDate || 'next'} episode is taking calls.`
            : 'The latest Slabs and Sluffs just dropped.'}
        </h2>
        <p>
          {upcoming
            ? `Dom and Sara are collecting listener stories, questions, field observations, and news for the episode scheduled for ${releaseDate}. Call now so your message can be considered for this episode.`
            : `Listen to ${
                campaign.episode_title || 'the latest episode'
              }, then call Dom and Sara with the story, question, field observation, or news you want them to carry into the next Slabs and Sluffs.`}
        </p>
        <small>
          This line is specifically for Slabs and Sluffs listener messages.
          Selected calls may be included in the show.
        </small>
      </div>
      <div className={styles.actions}>
        <a href={SLABS_AND_SLUFFS_PHONE_HREF} className={styles.callButton}>
          <CallRoundedIcon aria-hidden="true" />
          Call {SLABS_AND_SLUFFS_PHONE_DISPLAY}
        </a>
        {!upcoming && campaign.episode_url ? (
          <a
            href={campaign.episode_url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.listenLink}
          >
            <HeadphonesRoundedIcon aria-hidden="true" />
            Listen first
          </a>
        ) : null}
      </div>
    </section>
  );
}
