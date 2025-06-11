// pages/episodes/archive.js
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider
} from '@mui/material';
import { Search, Clear, ExpandMore, CalendarToday, History } from '@mui/icons-material';
import Navbar from '../../components/Navbar';
import SurveyBanner from '../../components/SurveyBanner';
import SEO from '../../components/SEO';

export default function PastSeasons() {
  const [searchQuery, setSearchQuery] = useState('');
  const [episodes, setEpisodes] = useState([]);
  const [filteredSeasons, setFilteredSeasons] = useState({});
  const [pastSeasons, setPastSeasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalPastEpisodes, setTotalPastEpisodes] = useState(0);

  useEffect(() => {
    async function fetchEpisodes() {
      try {
        console.log('🔄 Fetching episodes for past seasons...');
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

        const pastSeasonsData = getPastSeasons(data);
        const totalCount = Object.values(pastSeasonsData).reduce((sum, season) => sum + season.length, 0);
        
        setEpisodes(data);
        setPastSeasons(pastSeasonsData);
        setFilteredSeasons(pastSeasonsData);
        setTotalPastEpisodes(totalCount);
        setLoading(false);

      } catch (error) {
        console.error('💥 Error fetching episodes:', error);
        setError(error.message);
        setLoading(false);
      }
    }

    fetchEpisodes();
  }, []);

  // Get current season info to filter out current season episodes
  const getCurrentSeasonInfo = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-based (0 = January, 7 = August)

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

  const getPastSeasons = (allEpisodes) => {
    const currentSeasonInfo = getCurrentSeasonInfo();
    const seasons = {};

    // Filter out current season episodes
    const pastEpisodes = allEpisodes.filter(episode => {
      const releaseDate = new Date(episode.release_date);
      return releaseDate < currentSeasonInfo.startDate;
    });

    // Group episodes by season (August to July)
    pastEpisodes.forEach(episode => {
      const releaseDate = new Date(episode.release_date);
      const releaseYear = releaseDate.getFullYear();
      const releaseMonth = releaseDate.getMonth();

      // Determine which season this episode belongs to
      const seasonStartYear = releaseMonth >= 7 ? releaseYear : releaseYear - 1;
      const seasonLabel = `${seasonStartYear}-${seasonStartYear + 1}`;

      if (!seasons[seasonLabel]) {
        seasons[seasonLabel] = [];
      }

      seasons[seasonLabel].push(episode);
    });

    // Sort episodes within each season by release date (newest first)
    Object.keys(seasons).forEach(seasonKey => {
      seasons[seasonKey].sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
    });

    return seasons;
  };

  const handleSearch = (event) => {
    const query = event.target.value.toLowerCase();
    setSearchQuery(query);

    if (query.trim()) {
      const filtered = {};
      Object.keys(pastSeasons).forEach(season => {
        const matchingEpisodes = pastSeasons[season].filter(episode =>
          episode.name.toLowerCase().includes(query) ||
          (episode.description && episode.description.toLowerCase().includes(query))
        );
        if (matchingEpisodes.length > 0) {
          filtered[season] = matchingEpisodes;
        }
      });
      setFilteredSeasons(filtered);
    } else {
      setFilteredSeasons(pastSeasons);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setFilteredSeasons(pastSeasons);
  };

  const truncateDescription = (text, maxLength = 120) => {
    if (!text) return 'No description available';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  const getTotalFilteredEpisodes = () => {
    return Object.values(filteredSeasons).reduce((sum, season) => sum + season.length, 0);
  };

  // Sort seasons by year (most recent first)
  const sortedSeasonKeys = Object.keys(filteredSeasons).sort((a, b) => {
    const yearA = parseInt(a.split('-')[0]);
    const yearB = parseInt(b.split('-')[0]);
    return yearB - yearA;
  });

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
            Loading past seasons...
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
        title="Past Seasons Archive - The Avalanche Hour Podcast"
        description={`Browse the complete archive of past seasons from The Avalanche Hour Podcast. ${totalPastEpisodes} episodes from previous seasons available.`}
        keywords="avalanche podcast archive, past episodes, previous seasons, episode history"
        url="/episodes/archive"
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
            Past Seasons Archive
          </Typography>

          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Chip 
              icon={<History />}
              label={`${totalPastEpisodes} Episodes`}
              color="secondary"
              variant="outlined"
              size="large"
              sx={{ mb: 2, fontSize: '1.1rem', py: 3 }}
            />
            <Typography variant="h6" color="text.secondary">
              Complete archive of all previous seasons
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
              Each season runs from August to July
            </Typography>
          </Box>

          {/* Search */}
          <Box sx={{ mb: 4, maxWidth: '600px', mx: 'auto' }}>
            <TextField
              fullWidth
              label="Search past episodes"
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
                    <IconButton onClick={clearSearch} size="small" aria-label="Clear search">
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
                ? `Found ${getTotalFilteredEpisodes()} episodes across ${sortedSeasonKeys.length} seasons matching "${searchQuery}"`
                : `Showing ${Object.keys(filteredSeasons).length} past seasons with ${totalPastEpisodes} total episodes`
              }
            </Typography>
          </Box>

          {/* Seasons */}
          {sortedSeasonKeys.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {searchQuery ? 'No episodes found' : 'No past seasons available'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {searchQuery 
                  ? 'Try adjusting your search criteria.'
                  : 'Past seasons will appear here over time.'
                }
              </Typography>
            </Box>
          ) : (
            <Fade in={true}>
              <Box>
                {sortedSeasonKeys.map((seasonKey, index) => (
                  <Accordion 
                    key={seasonKey}
                    defaultExpanded={index < 2} // Expand first 2 seasons by default
                    sx={{ mb: 2 }}
                  >
                    <AccordionSummary 
                      expandIcon={<ExpandMore />}
                      sx={{ 
                        backgroundColor: 'grey.50',
                        '&:hover': { backgroundColor: 'grey.100' }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <CalendarToday sx={{ mr: 2, color: 'primary.main' }} />
                        <Typography variant="h5" component="h2" sx={{ flexGrow: 1, fontWeight: 600 }}>
                          Season {seasonKey}
                        </Typography>
                        <Chip 
                          label={`${filteredSeasons[seasonKey].length} episodes`}
                          color="primary"
                          variant="outlined"
                          size="small"
                        />
                      </Box>
                    </AccordionSummary>
                    
                    <AccordionDetails sx={{ p: 3 }}>
                      <Grid container spacing={3}>
                        {filteredSeasons[seasonKey].map((episode) => (
                          <Grid item key={episode.id} xs={12} sm={6} md={4}>
                            <Card 
                              sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                height: '100%',
                                transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                                '&:hover': {
                                  transform: 'translateY(-2px)',
                                  boxShadow: 3,
                                }
                              }}
                            >
                              <Box
                                sx={{
                                  height: 120,
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
                              <CardContent sx={{ flexGrow: 1, p: 2 }}>
                                <Typography 
                                  gutterBottom 
                                  variant="subtitle1" 
                                  component="h3"
                                  sx={{
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    lineHeight: 1.3,
                                    minHeight: '2.6em',
                                    fontWeight: 600,
                                    fontSize: '0.95rem'
                                  }}
                                >
                                  <a
                                    href={episode.external_urls?.spotify}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ textDecoration: 'none', color: 'inherit' }}
                                  >
                                    {episode.name}
                                  </a>
                                </Typography>
                                
                                <Typography 
                                  variant="body2" 
                                  color="text.secondary"
                                  sx={{
                                    mb: 1.5,
                                    display: '-webkit-box',
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: 'vertical',
                                    overflow: 'hidden',
                                    lineHeight: 1.3,
                                    minHeight: '2.6em',
                                    fontSize: '0.8rem'
                                  }}
                                >
                                  {truncateDescription(episode.description)}
                                </Typography>
                                
                                <Chip 
                                  label={new Date(episode.release_date).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })}
                                  size="small"
                                  variant="outlined"
                                  color="secondary"
                                  sx={{ fontSize: '0.7rem' }}
                                />
                              </CardContent>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                ))}
              </Box>
            </Fade>
          )}
        </Box>
      </Container>
    </>
  );
}