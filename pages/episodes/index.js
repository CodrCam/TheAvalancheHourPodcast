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
  LibraryBooks 
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import Navbar from '../../components/Navbar';
import SurveyBanner from '../../components/SurveyBanner';
import SEO from '../../components/SEO';

export default function Episodes() {
  const [episodeStats, setEpisodeStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    async function fetchEpisodeStats() {
      try {
        console.log('🔄 Fetching episode statistics...');
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
        description={`Browse all ${episodeStats?.total || 0} episodes of The Avalanche Hour Podcast. Listen to current season episodes and explore our complete archive.`}
        keywords="avalanche podcast episodes, snow science interviews, backcountry safety, avalanche education episodes"
        url="/episodes"
      />
      
      <Navbar />
      <SurveyBanner />
      
      <Container maxWidth="lg">
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography 
            variant="h1" 
            component="h1" 
            gutterBottom
            sx={{ 
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              fontFamily: 'Amatic SC, cursive',
              textAlign: 'center',
              mb: 2
            }}
          >
            Podcast Episodes
          </Typography>

          <Typography 
            variant="h6" 
            component="p" 
            color="text.secondary" 
            align="center"
            sx={{ mb: 4, maxWidth: '600px', mx: 'auto' }}
          >
            Explore our collection of episodes featuring stories, knowledge, 
            and insights from the avalanche and snow science community.
          </Typography>

          {/* Episode Stats Overview */}
          {episodeStats && (
            <Paper 
              elevation={2} 
              sx={{ 
                p: 4, 
                mb: 4, 
                background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
                textAlign: 'center'
              }}
            >
              <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                {episodeStats.total}
              </Typography>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Total Episodes Available
              </Typography>
              
              {episodeStats.latestEpisode && (
                <Box sx={{ mt: 3 }}>
                  <Typography variant="body1" color="text.secondary" gutterBottom>
                    Latest Episode:
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {episodeStats.latestEpisode.name}
                  </Typography>
                  <Chip 
                    label={new Date(episodeStats.latestEpisode.release_date).toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                    color="primary"
                    variant="outlined"
                    sx={{ mt: 1 }}
                  />
                </Box>
              )}
            </Paper>
          )}

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
                    boxShadow: 6,
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
                    New episodes are released regularly throughout the season.
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
                    boxShadow: 6,
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
              About Our Seasons
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Our podcast seasons follow the natural avalanche season cycle, running from August through July. 
              This aligns with when avalanche professionals and enthusiasts are most active in the backcountry, 
              ensuring our content is timely and relevant to the community's needs.
            </Typography>
          </Paper>
        </Box>
      </Container>
    </>
  );
}