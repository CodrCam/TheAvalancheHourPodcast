import * as React from 'react';
import {
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Box,
} from '@mui/material';
import Navbar from '../../components/Navbar';
import SurveyBanner from '../../components/SurveyBanner'; // Import the SurveyBanner component

export default function Episodes() {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [episodes, setEpisodes] = React.useState([]);
  const [filteredEpisodes, setFilteredEpisodes] = React.useState([]);
  const [seasons, setSeasons] = React.useState([]);
  const [selectedSeason, setSelectedSeason] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function fetchEpisodes() {
      try {
        const response = await fetch('/api/spotify');
        if (!response.ok) throw new Error('Failed to fetch episodes');

        const data = await response.json();
        const groupedSeasons = groupEpisodesBySeason(data);

        setEpisodes(data);
        setSeasons(groupedSeasons);
        setSelectedSeason(Object.keys(groupedSeasons)[0]); // Default to the first season
        setFilteredEpisodes(groupedSeasons[Object.keys(groupedSeasons)[0]]);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching episodes:', error);
        setLoading(false);
      }
    }

    fetchEpisodes();
  }, []);

  const groupEpisodesBySeason = (episodes) => {
    const grouped = {};

    episodes.forEach((episode) => {
      const releaseYear = new Date(episode.release_date).getFullYear();
      const releaseMonth = new Date(episode.release_date).getMonth();

      // Define the season break as "new season starts every July (month 6)"
      const seasonKey = releaseMonth >= 6 ? `${releaseYear}` : `${releaseYear - 1}`;

      if (!grouped[seasonKey]) {
        grouped[seasonKey] = [];
      }

      grouped[seasonKey].push(episode);
    });

    return grouped;
  };

  const handleSearch = (event) => {
    const query = event.target.value.toLowerCase();
    setSearchQuery(query);

    if (query) {
      // Search across all episodes from all seasons
      const allEpisodes = Object.values(seasons).flat();
      setFilteredEpisodes(
        allEpisodes.filter(
          (episode) =>
            episode.name.toLowerCase().includes(query) ||
            (episode.description && episode.description.toLowerCase().includes(query))
        )
      );
    } else {
      // If query is empty, revert to the selected season
      setFilteredEpisodes(seasons[selectedSeason] || []);
    }
  };

  const handleSeasonChange = (event) => {
    const season = event.target.value;
    setSelectedSeason(season);

    // Reset filtered episodes to the newly selected season if there's no search query
    if (!searchQuery) {
      setFilteredEpisodes(seasons[season] || []);
    }
  };

  return (
    <React.Fragment>
      <Navbar />
      <SurveyBanner /> {/* Add the survey banner */}
      <Container maxWidth="lg">
        <Typography variant="h4" component="h1" gutterBottom sx={{ mt: 4 }}>
          Episodes
        </Typography>
        <FormControl fullWidth sx={{ mb: 4 }}>
          <InputLabel>Season</InputLabel>
          <Select value={selectedSeason} onChange={handleSeasonChange} label="Season">
            {Object.keys(seasons).map((season) => (
              <MenuItem key={season} value={season}>
                Season {season}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <TextField
          fullWidth
          label="Search by title or description"
          variant="outlined"
          value={searchQuery}
          onChange={handleSearch}
          sx={{ mb: 4 }}
        />
        <Grid container spacing={4}>
          {filteredEpisodes.map((episode) => (
            <Grid item key={episode.id} xs={12} sm={6} md={4}>
              <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Box
                  sx={{
                    height: 140,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#f5f5f5',
                  }}
                >
                  <CardMedia
                    component="img"
                    image={episode.images[0]?.url || '/images/default.jpg'}
                    alt={episode.name}
                    sx={{
                      maxHeight: '100%',
                      maxWidth: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </Box>
                <CardContent>
                  <Typography gutterBottom variant="h5" component="div">
                    <a
                      href={episode.external_urls.spotify}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      {episode.name}
                    </a>
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {episode.description || 'No description available'}
                  </Typography>
                  <Typography variant="caption" display="block" gutterBottom>
                    Release Date: {new Date(episode.release_date).toLocaleDateString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </React.Fragment>
  );
}