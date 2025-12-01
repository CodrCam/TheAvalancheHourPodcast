// pages/episodes/current.js
import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  TextField,
  Box,
  CircularProgress,
  Alert,
  Chip,
  InputAdornment,
  IconButton,
  Fade,
  Button,
} from '@mui/material';
import { Search, Clear, CalendarToday } from '@mui/icons-material';
import Navbar from '../../components/Navbar';
import SEO from '../../components/SEO';
import { sponsors } from '../../src/data/sponsors';

// Import your performance hooks
import {
  usePerformanceMonitor,
  useRenderPerformance,
  useApiPerformance,
} from '../../hooks/usePerformanceMonitor';

export default function CurrentSeason() {
  const [searchQuery, setSearchQuery] = useState('');
  const [episodes, setEpisodes] = useState([]);
  const [filteredEpisodes, setFilteredEpisodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentSeasonInfo, setCurrentSeasonInfo] = useState(null);

  // Performance monitoring hooks
  const { startTimer, endTimer, getTimings } = usePerformanceMonitor(
    'Current Season Page Load'
  );
  const { measureApiCall } = useApiPerformance();
  useRenderPerformance('CurrentSeason Component');

  useEffect(() => {
    async function fetchEpisodes() {
      // Start performance timer
      startTimer();

      try {
        console.log('🔄 Fetching episodes for current season...');
        setLoading(true);
        setError(null);

        // Use API performance measurement
        const data = await measureApiCall('Spotify Episodes API', async () => {
          const response = await fetch('/api/spotify');
          console.log('📡 Response status:', response.status);

          if (!response.ok) {
            const errorData = await response.text();
            console.error('❌ API Error:', errorData);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          return response.json();
        });

        console.log('✅ Received data:', { count: data.length });

        if (!Array.isArray(data)) {
          throw new Error('Invalid data format received from API');
        }

        // Measure data processing time
        const processingStart = performance.now();

        const currentSeasonEpisodes = getCurrentSeasonEpisodes(data);
        const seasonInfo = getCurrentSeasonInfo();

        const processingTime = performance.now() - processingStart;
        console.log(`⚙️ Data processing: ${processingTime.toFixed(2)}ms`);

        setEpisodes(currentSeasonEpisodes);
        setFilteredEpisodes(currentSeasonEpisodes);
        setCurrentSeasonInfo(seasonInfo);
        setLoading(false);

        // End performance timer
        const totalTime = endTimer();

        // Log performance summary
        console.log('📊 Performance Summary:', {
          totalLoadTime: totalTime,
          episodeCount: currentSeasonEpisodes.length,
          averageTimePerEpisode:
            currentSeasonEpisodes.length > 0
              ? totalTime / currentSeasonEpisodes.length
              : 0,
        });
      } catch (error) {
        console.error('💥 Error fetching episodes:', error);
        setError(error.message);
        setLoading(false);
        endTimer(); // Still end timer on error
      }
    }

    fetchEpisodes();
  }, [startTimer, endTimer, measureApiCall]);

  // Performance monitoring for search
  const handleSearch = (event) => {
    const searchStart = performance.now();
    const query = event.target.value.toLowerCase();
    setSearchQuery(query);

    if (query.trim()) {
      setFilteredEpisodes(
        episodes.filter(
          (episode) =>
            episode.name.toLowerCase().includes(query) ||
            (episode.description &&
              episode.description.toLowerCase().includes(query))
        )
      );
    } else {
      setFilteredEpisodes(episodes);
    }

    const searchTime = performance.now() - searchStart;
    console.log(`🔍 Search performance: ${searchTime.toFixed(2)}ms for "${query}"`);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredEpisodes(episodes);
  };

  // Season runs from August to July (August 2024 - July 2025 = 2024-2025 season)
  const getCurrentSeasonInfo = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based (0 = January, 7 = August)

    // If we're in August or later, it's the current year season
    // If we're before August, it's the previous year season
    const seasonStartYear = currentMonth >= 7 ? currentYear : currentYear - 1;
    const seasonEndYear = seasonStartYear + 1;

    return {
      startYear: seasonStartYear,
      endYear: seasonEndYear,
      startDate: new Date(seasonStartYear, 7, 1), // August 1st
      endDate: new Date(seasonEndYear, 6, 31), // July 31st
      label: `${seasonStartYear}-${seasonEndYear}`,
    };
  };

  const getCurrentSeasonEpisodes = (allEpisodes) => {
    const seasonInfo = getCurrentSeasonInfo();

    return allEpisodes
      .filter((episode) => {
        const releaseDate = new Date(episode.release_date);
        return (
          releaseDate >= seasonInfo.startDate &&
          releaseDate <= seasonInfo.endDate
        );
      })
      .sort(
        (a, b) =>
          new Date(b.release_date).getTime() -
          new Date(a.release_date).getTime()
      );
  };

  const truncateDescription = (text, maxLength = 150) => {
    if (!text) return 'No description available';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  // Debug function to show performance data (only in development)
  const showPerformanceData = () => {
    if (process.env.NODE_ENV === 'development') {
      console.table(getTimings());
    }
  };

  // Add this button in development mode for debugging
  const PerformanceDebugButton = () => {
    if (process.env.NODE_ENV !== 'development') return null;

    return (
      <Button
        onClick={showPerformanceData}
        variant="outlined"
        size="small"
        sx={{ position: 'fixed', bottom: 20, right: 20, zIndex: 1000 }}
      >
        Show Performance Data
      </Button>
    );
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <Container maxWidth="lg">
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress size={60} />
          </Box>
          <Typography variant="h6" align="center" sx={{ mt: 2 }}>
            Loading current season episodes...
          </Typography>
        </Container>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Navbar />
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
        title={`Current Season ${currentSeasonInfo?.label} Episodes - The Avalanche Hour Podcast`}
        description={`Listen to the latest episodes from the current ${currentSeasonInfo?.label} season of The Avalanche Hour Podcast. ${episodes.length} episodes available.`}
        keywords="current avalanche podcast episodes, latest episodes, current season, snow science"
        url="/episodes/current"
      />

      <Navbar />

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
              mb: 2,
            }}
          >
            Current Season
          </Typography>

          {currentSeasonInfo && (
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <Chip
                icon={<CalendarToday />}
                label={`Season ${currentSeasonInfo.label}`}
                color="primary"
                variant="outlined"
                size="large"
                sx={{ mb: 2, fontSize: '1.1rem', py: 3 }}
              />
              <Typography variant="h6" color="text.secondary">
                August {currentSeasonInfo.startYear} - July{' '}
                {currentSeasonInfo.endYear}
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ mt: 1 }}
              >
                {episodes.length} episode
                {episodes.length !== 1 ? 's' : ''} available
              </Typography>

              {/* Friend-level sponsors for this season */}
              {sponsors?.friends && sponsors.friends.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    This season is supported by:
                  </Typography>

                  <Grid
                    container
                    spacing={2}
                    justifyContent="center"
                  >
                    {sponsors.friends.map((s) => (
                      <Grid
                        item
                        key={s.id}
                        xs={6}
                        sm={4}
                        md={3}
                        lg={2}
                      >
                        <Box
                          component="a"
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            px: 1.5,
                            py: 1,
                            borderRadius: 999,
                            bgcolor: 'grey.50',
                            border: '1px solid',
                            borderColor: 'grey.200',
                            textDecoration: 'none',
                            height: '100%',
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              mb: 0.5,
                              width: '100%',
                            }}
                          >
                            <img
                              src={s.logo}
                              alt={s.name}
                              style={{
                                maxHeight: 28,
                                width: 'auto',
                                maxWidth: '100%',
                                display: 'block',
                              }}
                            />
                          </Box>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            align="center"
                            sx={{
                              fontWeight: 500,
                              lineHeight: 1.3,
                              px: 0.5,
                            }}
                          >
                            {s.name}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </Box>
          )}

          {/* Search */}
          <Box sx={{ mb: 4, maxWidth: '600px', mx: 'auto' }}>
            <TextField
              fullWidth
              label="Search current season episodes"
              variant="outlined"
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Search by title or description..."
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={clearSearch}
                      size="small"
                      aria-label="Clear search"
                    >
                      <Clear />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
          </Box>

          {/* Results Summary */}
          <Box sx={{ mb: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {searchQuery
                ? `Showing ${filteredEpisodes.length} of ${episodes.length} episodes matching "${searchQuery}"`
                : `Showing all ${filteredEpisodes.length} episodes from current season`}
            </Typography>
          </Box>

          {/* Episodes Grid */}
          {filteredEpisodes.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {searchQuery ? 'No episodes found' : 'No episodes available'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {searchQuery
                  ? 'Try adjusting your search criteria.'
                  : 'Episodes will appear here as they are released.'}
              </Typography>
            </Box>
          ) : (
            <Fade in={true}>
              <Grid container spacing={4}>
                {filteredEpisodes.map((episode) => (
                  <Grid item key={episode.id} xs={12} sm={6} md={4}>
                    <Card
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: '100%',
                        transition:
                          'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: 4,
                        },
                      }}
                    >
                      <Box
                        sx={{
                          height: 160,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#f5f5f5',
                        }}
                      >
                        <CardMedia
                          component="img"
                          image={episode.images?.[0]?.url || '/images/default.jpg'}
                          alt={episode.name}
                          sx={{
                            maxHeight: '100%',
                            maxWidth: '100%',
                            objectFit: 'contain',
                          }}
                        />
                      </Box>
                      <CardContent sx={{ flexGrow: 1, p: 3 }}>
                        <Typography
                          gutterBottom
                          variant="h6"
                          component="h3"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.3,
                            minHeight: '3.6em',
                            fontWeight: 600,
                          }}
                        >
                          <a
                            href={episode.external_urls?.spotify}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              textDecoration: 'none',
                              color: 'inherit',
                            }}
                          >
                            {episode.name}
                          </a>
                        </Typography>

                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            mb: 2,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            lineHeight: 1.4,
                            minHeight: '4.2em',
                          }}
                        >
                          {truncateDescription(episode.description)}
                        </Typography>

                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Chip
                            label={new Date(
                              episode.release_date
                            ).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                            size="small"
                            variant="outlined"
                            color="primary"
                          />

                          {episode.duration_ms && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {Math.floor(episode.duration_ms / 60000)} min
                            </Typography>
                          )}
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Fade>
          )}
        </Box>

        {/* Debug button for development */}
        <PerformanceDebugButton />
      </Container>
    </>
  );
}