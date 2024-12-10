import React, { useEffect, useState } from 'react';
import { Container, Typography, Grid, Box, CircularProgress } from '@mui/material';
import Navbar from '../components/Navbar';
import ParallaxSection from '../components/ParallaxSection';
import EpisodeCard from '../components/EpisodeCard';
import SponsorGrid from '../components/SponsorGrid';
import SurveyBanner from '../components/SurveyBanner'; // Import SurveyBanner

const topSectionHeight = 350; // Height of the tagline section
const separatorSectionHeight = 300; // Height of each parallax separator section

export default function Home() {
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEpisodes() {
      try {
        const response = await fetch('/api/spotify'); // Fetch data from your API
        if (!response.ok) throw new Error('Failed to fetch episodes');

        const data = await response.json();

        // Sort episodes by release date (descending) and pick the latest three
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

  return (
    <>
      <Navbar />
      <SurveyBanner /> {/* Add the survey banner */}

      {/* First Parallax Section with Tagline */}
      <ParallaxSection
        backgroundImage="/images/background1.jpg"
        height={`${topSectionHeight}px`}
        strength={500}
        bgImageStyle={{
          objectFit: 'cover',
          objectPosition: 'top',
        }}
      >
        <Box
          sx={{
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
            variant="h4"
            component="h1"
            sx={{
              maxWidth: '800px',
              fontSize: { xs: '1.5rem', md: '2.5rem' },
              fontFamily: 'Amatic, sans-serif',
              fontWeight: 'bold',
              color: 'text.primary',
            }}
          >
            Creating a stronger community through sharing stories, knowledge, and news amongst
            people who have a curious fascination with avalanches.
          </Typography>
        </Box>
      </ParallaxSection>

      {/* Latest Episodes Section with White Background */}
      <Box sx={{ backgroundColor: 'white', py: 4 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            component="h2"
            gutterBottom
            align="center"
            sx={{
              fontFamily: 'Amatic, sans-serif',
              fontWeight: 'bold',
              color: 'text.primary',
            }}
          >
            Latest Episodes
          </Typography>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={4}>
          {episodes.map((episode) => (
            <Grid item xs={12} sm={6} md={4} key={episode.id}>
              <EpisodeCard
                episode={{
                  ...episode,
                  images: episode.images || [{ url: '/images/default.jpg' }], // Fallback image
                }}
              />
            </Grid>
          ))}
        </Grid>
          )}
        </Container>
      </Box>

      {/* Second Parallax Section as Separator with the Same Background Image */}
      <ParallaxSection
        backgroundImage="/images/background1.jpg"
        height={`${separatorSectionHeight}px`}
        strength={500}
        bgImageStyle={{
          objectFit: 'cover',
          objectPosition: `center`,
        }}
      />

      {/* Sponsors Section with White Background */}
      <Box sx={{ backgroundColor: 'white', py: 4 }}>
        <Container maxWidth="lg">
          <Typography
            variant="h4"
            component="h2"
            gutterBottom
            align="center"
            sx={{
              fontFamily: 'Amatic, sans-serif',
              fontWeight: 'bold',
              color: 'text.primary',
            }}
          >
            Our Sponsors
          </Typography>
          <SponsorGrid />
        </Container>
      </Box>
    </>
  );
}