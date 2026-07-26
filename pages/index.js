import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import HeadphonesRoundedIcon from '@mui/icons-material/HeadphonesRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import VolunteerActivismRoundedIcon from '@mui/icons-material/VolunteerActivismRounded';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import EpisodeCard from '../components/EpisodeCard';
import SponsorGrid from '../components/SponsorGrid';
import SEO from '../components/SEO';
import { DEFAULT_HOME_CONTENT } from '../lib/siteContentDefaults';
import {
  ORGANIZATION_ID,
  PODCAST_ID,
  SITE_DESCRIPTION,
  SITE_IMAGE_URL,
  SITE_KEYWORDS,
  SITE_LOGO_URL,
  SITE_NAME,
  SITE_URL,
  SOCIAL_PROFILES,
} from '../lib/siteMetadata';
import { safeJsonLdStringify } from '../lib/structuredData.mjs';
import { sponsors as DEFAULT_SPONSORS } from '../src/data/sponsors';
import styles from '../styles/Home.module.css';

export default function Home() {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [homeContent, setHomeContent] = useState(DEFAULT_HOME_CONTENT);
  const [homeContentReady, setHomeContentReady] = useState(false);
  const [sponsorTiers, setSponsorTiers] = useState(DEFAULT_SPONSORS);

  useEffect(() => {
    async function fetchEpisodes() {
      try {
        const response = await fetch('/api/spotify?limit=3');
        if (!response.ok) throw new Error('Failed to fetch episodes');
        const data = await response.json();
        setEpisodes(
          data
            .sort(
              (a, b) =>
                new Date(b.release_date) - new Date(a.release_date)
            )
            .slice(0, 3)
        );
      } catch (error) {
        console.error('Error fetching episodes:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchEpisodes();
  }, []);

  useEffect(() => {
    let alive = true;

    async function fetchSponsors() {
      try {
        const response = await fetch('/api/site-content/sponsors');
        const data = await response.json();
        if (alive && response.ok && data.ok && data.tiers) {
          setSponsorTiers({
            legacy: data.tiers.legacy || [],
            partner: data.tiers.partner || [],
            friends: data.tiers.friends || [],
          });
        }
      } catch {
        // Keep the static sponsor list if managed sponsors are unavailable.
      }
    }

    fetchSponsors();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;

    async function fetchHomeContent() {
      try {
        const response = await fetch('/api/site-content/homepage');
        const data = await response.json();
        if (alive && response.ok && data.ok && data.content) {
          setHomeContent(data.content);
        }
      } catch {
        // Keep the static defaults if managed content is unavailable.
      } finally {
        if (alive) setHomeContentReady(true);
      }
    }

    fetchHomeContent();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <>
      <SEO
        title="The Avalanche Hour Podcast - Stories from the Snow Science Community"
        description="Creating a stronger community through sharing stories, knowledge, and news amongst people who have a curious fascination with avalanches."
        keywords="avalanche podcast, snow science, backcountry safety, avalanche forecasting, winter sports, mountaineering, ski safety, avalanche education"
        url="/"
        type="website"
      />
      <Navbar />

      <main className={styles.home}>
        <Box component="section" className={styles.hero}>
          <Container maxWidth="lg" className={styles.heroInner}>
            <Box className={styles.heroCopy}>
              <Typography component="p" className={styles.eyebrow}>
                Independent podcast · avalanche community
              </Typography>
              <Typography component="h1" className={styles.heroTitle}>
                The mountain talks.
                <span>We listen.</span>
              </Typography>
              <Typography component="p" className={styles.heroBody}>
                Creating a stronger community through sharing stories,
                knowledge, and news amongst people who have a curious
                fascination with avalanches.
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                className={styles.heroActions}
              >
                <Button
                  component={Link}
                  href="/episodes/current"
                  variant="contained"
                  startIcon={<HeadphonesRoundedIcon />}
                  className={styles.primaryAction}
                >
                  Listen to the latest
                </Button>
                <Button
                  component={Link}
                  href="/about"
                  variant="outlined"
                  endIcon={<ArrowForwardRoundedIcon />}
                  className={styles.secondaryAction}
                >
                  Meet the people
                </Button>
              </Stack>
            </Box>

          </Container>
        </Box>

        <Box component="section" className={styles.signalStrip}>
          <Container maxWidth="lg" className={styles.signalGrid}>
            <Box>
              <strong>Since 2016</strong>
              <span>Long-form conversations from the field.</span>
            </Box>
            <Box>
              <strong>October—June</strong>
              <span>Three new episodes most months.</span>
            </Box>
            <Box>
              <strong>Community supported</strong>
              <span>Independent voices without the noise.</span>
            </Box>
          </Container>
        </Box>

        <Box
          component="section"
          className={styles.episodesSection}
          aria-labelledby="latest-episodes-heading"
        >
          <Container maxWidth="lg">
            <Box className={styles.sectionHeader}>
              <Box>
                <Typography component="p" className={styles.sectionEyebrow}>
                  Recent field reports
                </Typography>
                <Typography
                  id="latest-episodes-heading"
                  component="h2"
                  className={styles.sectionTitle}
                >
                  The latest conversations.
                </Typography>
              </Box>
              <Box className={styles.sectionSide}>
                <Typography>
                  New reporting, lived experience, and honest conversations
                  from across the avalanche community.
                </Typography>
                <Button
                  component={Link}
                  href="/episodes"
                  endIcon={<ArrowForwardRoundedIcon />}
                >
                  Explore every episode
                </Button>
              </Box>
            </Box>

            {loading ? (
              <Box className={styles.loading}>
                <CircularProgress aria-label="Loading latest episodes" />
                <span>Checking the latest dispatches…</span>
              </Box>
            ) : episodes.length ? (
              <Grid container spacing={3}>
                {episodes.map((episode, index) => (
                  <Grid item xs={12} md={index === 0 ? 6 : 3} key={episode.id}>
                    <Box
                      className={`${styles.episodeSlot} ${
                        index === 0 ? styles.episodeSlotFeatured : ''
                      }`}
                    >
                      <span className={styles.episodeNumber}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <EpisodeCard
                        episode={{
                          ...episode,
                          images:
                            episode.images || [
                              { url: '/images/default.jpg' },
                            ],
                        }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Box className={styles.emptyEpisodes}>
                The latest episodes are temporarily unavailable. The archive is
                still here when you are ready.
              </Box>
            )}
          </Container>
        </Box>

        <Box component="section" className={styles.missionSection}>
          <Container maxWidth="lg" className={styles.missionGrid}>
            <Box className={styles.missionImage}>
              <img
                src="/images/optimized/background/main-page2.webp"
                alt="Snow-covered mountain terrain"
                loading="lazy"
                decoding="async"
              />
              <span>Observation · conversation · community</span>
            </Box>
            <Box className={styles.missionCopy}>
              <Typography component="p" className={styles.sectionEyebrowLight}>
                Why the show exists
              </Typography>
              <Typography component="h2" className={styles.missionTitle}>
                Awareness is built one honest story at a time.
              </Typography>
              <Typography>
                The Avalanche Hour brings forecasters, guides, educators,
                researchers, patrollers, and backcountry travelers into the
                same conversation. The goal is not to flatten the complexity.
                It is to make the lessons easier to carry into the field.
              </Typography>
              <Button
                component={Link}
                href="/about"
                endIcon={<ArrowForwardRoundedIcon />}
                className={styles.missionLink}
              >
                Read the full story
              </Button>
            </Box>
          </Container>
        </Box>

        <Box component="section" className={styles.supportSection}>
          <Container maxWidth="lg" className={styles.supportGrid}>
            <Box>
              <Typography component="p" className={styles.sectionEyebrow}>
                Keep the signal strong
              </Typography>
              <Typography component="h2" className={styles.sectionTitle}>
                {homeContent.supportHeading}
              </Typography>
              <Typography className={styles.supportBody}>
                {homeContent.supportBody}
              </Typography>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.25}
                useFlexGap
                className={styles.supportActions}
              >
                <Button
                  component={Link}
                  href={homeContent.supportButtonUrl}
                  variant="contained"
                >
                  {homeContent.supportButtonLabel}
                </Button>
                {homeContentReady && homeContent.donateEnabled ? (
                  <Button
                    component="a"
                    href={homeContent.donateButtonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    startIcon={<VolunteerActivismRoundedIcon />}
                  >
                    {homeContent.donateButtonLabel}
                  </Button>
                ) : null}
              </Stack>
            </Box>

            {homeContentReady && homeContent.spotlightEnabled ? (
              <Box className={styles.spotlight}>
                <Typography component="p">
                  {homeContent.spotlightEyebrow}
                </Typography>
                <Typography component="h3">
                  {homeContent.spotlightHeading}
                </Typography>
                <Typography component="span">
                  {homeContent.spotlightBody}
                </Typography>
                <Button
                  component="a"
                  href={homeContent.spotlightButtonUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<OpenInNewRoundedIcon />}
                >
                  {homeContent.spotlightButtonLabel}
                </Button>
              </Box>
            ) : homeContentReady && homeContent.featuredLinkEnabled ? (
              <Box className={styles.spotlight}>
                <Typography component="p">Field connection</Typography>
                <Typography component="h3">
                  Go deeper with the community.
                </Typography>
                <Button
                  component="a"
                  href={homeContent.featuredLinkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<OpenInNewRoundedIcon />}
                >
                  {homeContent.featuredLinkLabel}
                </Button>
              </Box>
            ) : null}
          </Container>
        </Box>

        <Box
          component="section"
          className={styles.sponsorsSection}
          aria-labelledby="sponsors-heading"
        >
          <Container maxWidth="lg">
            <Box className={styles.sponsorHeading}>
              <Typography component="p" className={styles.sectionEyebrow}>
                Partners in the work
              </Typography>
              <Typography
                id="sponsors-heading"
                component="h2"
                className={styles.sectionTitle}
              >
                The people who help make airtime possible.
              </Typography>
            </Box>
            <SponsorGrid sponsorsByTier={sponsorTiers} />
          </Container>
        </Box>
      </main>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify({
            '@context': 'https://schema.org',
            '@type': 'PodcastSeries',
            '@id': PODCAST_ID,
            name: SITE_NAME,
            alternateName: 'The Avalanche Hour',
            description: SITE_DESCRIPTION,
            url: SITE_URL,
            image: SITE_IMAGE_URL,
            thumbnailUrl: SITE_LOGO_URL,
            inLanguage: 'en-US',
            genre: ['Education', 'Science', 'Outdoor Recreation'],
            keywords: SITE_KEYWORDS,
            sameAs: SOCIAL_PROFILES,
            author: {
              '@type': 'Organization',
              '@id': ORGANIZATION_ID,
              name: 'The Avalanche Hour Team',
            },
            publisher: {
              '@type': 'Organization',
              '@id': ORGANIZATION_ID,
              name: SITE_NAME,
            },
          }),
        }}
      />
    </>
  );
}
