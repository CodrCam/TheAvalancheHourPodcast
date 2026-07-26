// pages/episodes/index.js
import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Box,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Paper
} from '@mui/material';
import { 
  PlayArrow, 
  CalendarToday, 
  History, 
  TrendingUp, 
  LibraryBooks,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import Navbar from '../../components/Navbar';
import PublicPageHero from '../../components/PublicPageHero';
import SurveyBanner from '../../components/SurveyBanner';
import SEO from '../../components/SEO';
import publicStyles from '../../styles/PublicSite.module.css';

export default function Episodes() {
  const [episodeStats, setEpisodeStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchEpisodeStats() {
      try {
        console.log('📄 Fetching episode statistics...');
        setLoading(true);
        setError(null);

        const response = await fetch('/api/spotify');
        console.log('📡 Response status:', response.status);

        if (!response.ok) {
          const errorData = await response.text();
          console.error('❌ API Error:', errorData);
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('✅ Received data:', { count: data.length });

        if (!Array.isArray(data)) {
          throw new Error('Invalid data format received from API');
        }

        const stats = calculateEpisodeStats(data);
        setEpisodeStats(stats);
        setLoading(false);

      } catch (error) {
        console.error('💥 Error fetching episodes:', error);
        setError(error.message);
        setLoading(false);
      }
    }

    fetchEpisodeStats();
  }, []);

  const getCurrentSeasonInfo = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const seasonStartYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    const seasonEndYear = seasonStartYear + 1;

    return {
      startYear: seasonStartYear,
      endYear: seasonEndYear,
      startDate: new Date(seasonStartYear, 7, 1), // August 1st
      endDate: new Date(seasonEndYear, 6, 31), // July 31st
      label: `${seasonStartYear}-${seasonEndYear}`
    };
  };

  const calculateEpisodeStats = (allEpisodes) => {
    const currentSeasonInfo = getCurrentSeasonInfo();
    
    // Split episodes into current and past
    const currentSeasonEpisodes = allEpisodes.filter(episode => {
      const releaseDate = new Date(episode.release_date);
      return releaseDate >= currentSeasonInfo.startDate && releaseDate <= currentSeasonInfo.endDate;
    });

    const pastEpisodes = allEpisodes.filter(episode => {
      const releaseDate = new Date(episode.release_date);
      return releaseDate < currentSeasonInfo.startDate;
    });

    // Group past episodes by season
    const pastSeasons = {};
    pastEpisodes.forEach(episode => {
      const releaseDate = new Date(episode.release_date);
      const releaseYear = releaseDate.getFullYear();
      const releaseMonth = releaseDate.getMonth();
      const seasonStartYear = releaseMonth >= 7 ? releaseYear : releaseYear - 1;
      const seasonLabel = `${seasonStartYear}-${seasonStartYear + 1}`;

      if (!pastSeasons[seasonLabel]) {
        pastSeasons[seasonLabel] = [];
      }
      pastSeasons[seasonLabel].push(episode);
    });

    // Get latest episode
    const latestEpisode = allEpisodes
      .sort((a, b) => new Date(b.release_date) - new Date(a.release_date))[0];

    return {
      total: allEpisodes.length,
      currentSeason: {
        count: currentSeasonEpisodes.length,
        info: currentSeasonInfo
      },
      pastSeasons: {
        count: pastEpisodes.length,
        seasons: Object.keys(pastSeasons).length
      },
      latestEpisode,
      allEpisodes
    };
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <SurveyBanner />
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress size={60} />
          </Box>
          <Typography variant="h6" align="center" sx={{ mt: 2 }}>
            Loading episode information...
          </Typography>
        </Container>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
        <SurveyBanner />
        <Container maxWidth="lg">
          <Alert severity="error" sx={{ mt: 4 }}>
            <Typography variant="h6">Error loading episodes</Typography>
            <Typography>{error}</Typography>
          </Alert>
        </Container>
      </>
    );
  }

  return (
    <>
      <SEO
        title="Episodes - The Avalanche Hour Podcast"
        description={`Browse all ${episodeStats?.total || 0} episodes of The Avalanche Hour Podcast. New episodes released 3 times per month from October through June.`}
        keywords="avalanche podcast episodes, snow science interviews, backcountry safety, avalanche education episodes"
        url="/episodes"
      />
      
      <Navbar />
      <Box component="main" className={publicStyles.publicPage}>
        <PublicPageHero
          eyebrow="The complete listening map"
          title="Stories from the snow."
          description="Explore conversations, field lessons, research, and lived experience from across the avalanche and snow science community."
        >
          <Typography
            component="p"
            sx={{
              color: '#c8e4ed',
              fontSize: '.67rem',
              fontWeight: 900,
              letterSpacing: '.17em',
              textTransform: 'uppercase',
            }}
          >
            Available now
          </Typography>
          <Typography
            component="p"
            sx={{
              my: 1,
              color: '#fff',
              fontFamily: 'Amatic SC, cursive',
              fontSize: '4.3rem',
              fontWeight: 700,
              lineHeight: .9,
            }}
          >
            {episodeStats?.total || 0} episodes
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,.62)' }}>
            New conversations arrive three times a month from October through
            June.
          </Typography>
        </PublicPageHero>

        <Container maxWidth="lg" className={publicStyles.content}>
          <Box>

          {/* Release Schedule Banner */}
          <Paper 
            elevation={0}
            sx={{ 
              p: 3, 
              mb: 4, 
              border: '1px solid rgba(16,34,45,.18)',
              borderLeft: '7px solid #ef6f35',
              borderRadius: 0,
              background: '#dce9e9',
              color: 'white',
              textAlign: 'left'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <ScheduleIcon sx={{ fontSize: 34, color: '#10222d' }} />
              <Box>
              <Typography variant="h5" component="h2" sx={{ color: '#10222d', fontWeight: 850 }}>
                Three new episodes per month
              </Typography>
              <Typography variant="body1" sx={{ color: '#405965' }}>
                October through June · timed to the North American avalanche season
              </Typography>
              </Box>
            </Box>
          </Paper>

          {/* Navigation Cards */}
          <Grid container spacing={4} sx={{ mb: 4 }}>
            {/* Current Season Card */}
            <Grid item xs={12} md={6}>
              <Card 
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 20px 46px rgba(16,34,45,.12)',
                  },
                  cursor: 'pointer'
                }}
                onClick={() => router.push('/episodes/current')}
              >
                <CardContent sx={{ flexGrow: 1, p: 4, textAlign: 'center' }}>
                  <Box sx={{ mb: 3 }}>
                    <TrendingUp sx={{ fontSize: 60, color: 'primary.main' }} />
                  </Box>
                  
                  <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Current Season
                  </Typography>
                  
                  {episodeStats && (
                    <>
                      <Chip 
                        icon={<CalendarToday />}
                        label={`Season ${episodeStats.currentSeason.info.label}`}
                        color="primary"
                        size="large"
                        sx={{ mb: 2, fontSize: '1rem', py: 3 }}
                      />
                      
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        {episodeStats.currentSeason.count} Episodes Available
                      </Typography>
                    </>
                  )}
                  
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    Listen to the latest episodes from the current season.
                  </Typography>
                  
                  <Button
                    variant="contained"
                    size="large"
                    startIcon={<PlayArrow />}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push('/episodes/current');
                    }}
                    sx={{ minWidth: 200 }}
                  >
                    Listen Now
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Past Seasons Card */}
            <Grid item xs={12} md={6}>
              <Card 
                sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 20px 46px rgba(16,34,45,.12)',
                  },
                  cursor: 'pointer'
                }}
                onClick={() => router.push('/episodes/archive')}
              >
                <CardContent sx={{ flexGrow: 1, p: 4, textAlign: 'center' }}>
                  <Box sx={{ mb: 3 }}>
                    <LibraryBooks sx={{ fontSize: 60, color: 'secondary.main' }} />
                  </Box>
                  
                  <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Past Seasons
                  </Typography>
                  
                  {episodeStats && (
                    <>
                      <Chip 
                        icon={<History />}
                        label={`${episodeStats.pastSeasons.seasons} Seasons`}
                        color="secondary"
                        size="large"
                        sx={{ mb: 2, fontSize: '1rem', py: 3 }}
                      />
                      
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        {episodeStats.pastSeasons.count} Episodes in Archive
                      </Typography>
                    </>
                  )}
                  
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                    Explore our complete archive of past seasons. Search through 
                    years of conversations with experts and community members.
                  </Typography>
                  
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<History />}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push('/episodes/archive');
                    }}
                    sx={{ minWidth: 200 }}
                  >
                    Browse Archive
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Season Information */}
          <Paper elevation={1} sx={{ p: 3, backgroundColor: 'grey.50' }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              About Our Release Schedule
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              The Avalanche Hour Podcast releases <strong>3 new episodes per month from October through June</strong>, 
              perfectly timed with the North American avalanche season. This schedule ensures our content 
              is most relevant when our community needs it most.
            </Typography>
            <Typography variant="body1" color="text.secondary">
              
            </Typography>
          </Paper>
        </Box>
        </Container>
      </Box>
    </>
  );
}
