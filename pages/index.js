// pages/index.js
import React, { useEffect, useState } from 'react';
import { Container, Typography, Grid, Box, CircularProgress, Button, Stack } from '@mui/material';
import { Instagram } from '@mui/icons-material';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import ParallaxSection from '../components/ParallaxSection';
import EpisodeCard from '../components/EpisodeCard';
import SponsorGrid from '../components/SponsorGrid';
import SEO from '../components/SEO';
import { DEFAULT_HOME_CONTENT } from '../lib/siteContentDefaults';
import { sponsors as DEFAULT_SPONSORS } from '../src/data/sponsors';

const topSectionHeight = 350;
const separatorSectionHeight = 300;

export default function Home() {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [homeContent, setHomeContent] = useState(DEFAULT_HOME_CONTENT);
  const [sponsorTiers, setSponsorTiers] = useState(DEFAULT_SPONSORS);

  useEffect(() => {
    async function fetchEpisodes() {
      try {
        const response = await fetch('/api/spotify');
        if (!response.ok) throw new Error('Failed to fetch episodes');

        const data = await response.json();
        const latestEpisodes = data
          .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))
          .slice(0, 3);

        setEpisodes(latestEpisodes);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching episodes:', error);
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
        description="Creating a stronger community through sharing stories, knowledge, and news amongst people who have a curious fascination with avalanches. Listen to expert interviews, safety tips, and backcountry stories."
        keywords="avalanche podcast, snow science, backcountry safety, avalanche forecasting, winter sports, mountaineering, ski safety, avalanche education"
        url="/"
        type="website"
      />
      
      <Navbar />
      {/* Survey Banner removed from here */}

      {/* Hero Section with improved accessibility */}
      <ParallaxSection
        backgroundImage="/images/background/main-page3.jpg"
        height={`${topSectionHeight}px`}
        strength={500}
        bgImageStyle={{
          objectFit: 'cover',
          objectPosition: 'top',
        }}
        bgImageAlt="Mountain landscape with snow-covered peaks"
      >
        <Box
          sx={{
            position: 'relative',
            width: '100%',
            height: '100%',
          }}
        >
          {/* Overlay */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: 'rgba(0, 0, 0, 0.25)',
              zIndex: 1,
            }}
          />
          {/* Content */}
          <Box
            sx={{
              position: 'relative',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              height: '100%',
              textAlign: 'center',
              px: 2,
            }}
          >
            <Typography
              component="h1"
              sx={{
                maxWidth: '800px',
                fontSize: { xs: '1.5rem', md: '2.5rem' },
                fontFamily: 'sans-serif',
                fontWeight: 'bold',
                color: '#edf0f2',
                lineHeight: 1.2,
              }}
            >
              Creating a stronger community through sharing stories, knowledge, and news amongst
              people who have a curious fascination with avalanches.
            </Typography>
          </Box>
        </Box>
      </ParallaxSection>

      {/* Latest Episodes Section */}
      <Box 
        component="section" 
        sx={{ backgroundColor: 'white', py: 4 }}
        aria-labelledby="latest-episodes-heading"
      >
        <Container maxWidth="lg">
          <Typography
            id="latest-episodes-heading"
            variant="h2"
            component="h2"
            gutterBottom
            align="center"
            sx={{
              fontFamily: 'Amatic SC, sans-serif',
              fontWeight: 'bold',
              color: 'text.primary',
              fontSize: { xs: '2rem', md: '3rem' },
            }}
          >
            Latest Episodes
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress aria-label="Loading latest episodes" />
            </Box>
          ) : episodes.length > 0 ? (
            <Grid container spacing={4}>
              {episodes.map((episode) => (
                <Grid item xs={12} sm={6} md={4} key={episode.id}>
                  <EpisodeCard
                    episode={{
                      ...episode,
                      images: episode.images || [{ url: '/images/default.jpg' }],
                    }}
                  />
                </Grid>
              ))}
            </Grid>
          ) : (
            <Typography variant="body1" align="center" color="text.secondary">
              No episodes available at the moment. Please check back later.
            </Typography>
          )}
        </Container>
      </Box>

      {/* Separator */}
      <ParallaxSection
        backgroundImage="/images/background/main-page1.jpg"
        height={`${separatorSectionHeight}px`}
        strength={500}
        bgImageStyle={{
          objectFit: 'cover',
          objectPosition: 'center',
        }}
        bgImageAlt="Snowy mountain terrain"
      />

      {/* Support Section */}
      <Box
        component="section"
        sx={{ backgroundColor: 'background.default', py: { xs: 5, md: 7 } }}
        aria-labelledby="support-heading"
      >
        <Container maxWidth="lg">
          <Grid container spacing={{ xs: 3, md: 5 }} alignItems="center">
            <Grid item xs={12} md={7}>
              <Typography
                id="support-heading"
                variant="h2"
                component="h2"
                gutterBottom
                sx={{
                  fontFamily: 'Amatic SC, sans-serif',
                  fontWeight: 'bold',
                  color: 'text.primary',
                  fontSize: { xs: '2rem', md: '3rem' },
                }}
              >
                {homeContent.supportHeading}
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
                {homeContent.supportBody}
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} sx={{ mt: 2.5 }}>
                <Button
                  component={Link}
                  href={homeContent.supportButtonUrl}
                  variant="contained"
                >
                  {homeContent.supportButtonLabel}
                </Button>
                {homeContent.socialEnabled ? (
                  <Button
                    component="a"
                    href={homeContent.instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outlined"
                    startIcon={<Instagram />}
                  >
                    {homeContent.socialButtonLabel}
                  </Button>
                ) : null}
              </Stack>
            </Grid>
            {homeContent.spotlightEnabled ? (
              <Grid item xs={12} md={5}>
                <Box
                  sx={{
                    borderLeft: { xs: 0, md: '1px solid' },
                    borderTop: { xs: '1px solid', md: 0 },
                    borderColor: 'grey.300',
                    pl: { xs: 0, md: 4 },
                    pt: { xs: 3, md: 0 },
                  }}
                >
                  <Typography
                    variant="overline"
                    sx={{
                      color: 'primary.main',
                      fontWeight: 800,
                      letterSpacing: 0,
                    }}
                  >
                    {homeContent.spotlightEyebrow}
                  </Typography>
                  <Typography variant="h3" component="h3" sx={{ mt: 0.5, mb: 1 }}>
                    {homeContent.spotlightHeading}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {homeContent.spotlightBody}
                  </Typography>
                  <Button
                    component="a"
                    href={homeContent.spotlightButtonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="contained"
                    color="secondary"
                  >
                    {homeContent.spotlightButtonLabel}
                  </Button>
                </Box>
              </Grid>
            ) : null}
          </Grid>
        </Container>
      </Box>

      {/* Sponsors Section */}
      <Box 
        component="section" 
        sx={{ backgroundColor: 'white', py: 4 }}
        aria-labelledby="sponsors-heading"
      >
        <Container maxWidth="lg">
          <Typography
            id="sponsors-heading"
            variant="h2"
            component="h2"
            gutterBottom
            align="center"
            sx={{
              fontFamily: 'Amatic SC, sans-serif',
              fontWeight: 'bold',
              color: 'text.primary',
              fontSize: { xs: '2rem', md: '3rem' },
            }}
          >
            Our Sponsors
          </Typography>
          <SponsorGrid sponsorsByTier={sponsorTiers} />
        </Container>
      </Box>

      {/* Structured Data for Podcast */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "PodcastSeries",
            "name": "The Avalanche Hour Podcast",
            "description": "Creating a stronger community through sharing stories, knowledge, and news amongst people who have a curious fascination with avalanches.",
            "url": "https://www.theavalanchehour.com",
            "image": "https://www.theavalanchehour.com/images/podcast-logo.jpg",
            "author": {
              "@type": "Organization",
              "name": "The Avalanche Hour Team"
            },
            "publisher": {
              "@type": "Organization",
              "name": "The Avalanche Hour Podcast"
            }
          })
        }}
      />
    </>
  );
}
