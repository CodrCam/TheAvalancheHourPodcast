// pages/resources.js
import React, { useState } from 'react';
import {
  Container,
  Typography,
  List,
  ListItem,
  ListItemText,
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Button,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Paper,
  TextField,
  InputAdornment,
  Fade,
} from '@mui/material';
import {
  ExpandMore,
  Search,
  LocationOn,
  School,
  Warning,
  Book,
  Public,
} from '@mui/icons-material';
import Navbar from '../components/Navbar';
import SEO from '../components/SEO';

export default function Resources() {
  const [searchQuery, setSearchQuery] = useState('');

  // General Resources
  const generalResources = [
    {
      name: 'International Snow Science Workshops (ISSW) Proceedings',
      link: 'https://arc.lib.montana.edu/snow-science/',
      description:
        'Research papers and proceedings from international snow science conferences',
    },
    {
      name: 'American Avalanche Association',
      link: 'https://www.americanavalancheassociation.org/',
      description:
        'Professional organization for avalanche workers in the United States',
    },
    {
      name: 'Canadian Avalanche Association',
      link: 'https://www.avalancheassociation.ca',
      description: 'Professional organization for avalanche workers in Canada',
    },
    {
      name: 'Utah Avalanche Center Education',
      link: 'https://utahavalanchecenter.org/education',
      description: 'Comprehensive avalanche education materials and courses',
    },
  ];

  // National/International Centers
  const nationalCenters = [
    {
      name: 'National Avalanche Center',
      link: 'https://avalanche.org/#/current',
      image: '/images/resources/NAC.png',
      description:
        'Coordinating body for avalanche information in the United States',
    },
    {
      name: 'Avalanche Canada',
      link: 'https://avalanche.ca/forecasts',
      image: '/images/resources/AvCan-logo.svg',
      description: 'National avalanche forecasting service for Canada',
    },
  ];

  // Avalanche Centers by State/Region
  const avalancheCentersByState = {
    Alaska: [
      {
        name: 'Chugach National Forest Avalanche Information Center',
        link: 'https://www.cnfaic.org/',
        image: '/images/resources/chugach-logo.png',
      },
      {
        name: 'Hatcher Pass Avalanche Center',
        link: 'https://hpavalanche.org/',
        image: '/images/resources/hatcher-logo.png',
      },
      {
        name: 'Alaska Avalanche Information Center',
        link: 'https://alaskasnow.org/',
        image: '/images/resources/AAIC-logo.png.webp',
      },
    ],
    Washington: [
      {
        name: 'Northwest Avalanche Center',
        link: 'https://nwac.us/',
        image: '/images/resources/nwac-logo.png',
      },
    ],
    Oregon: [
      {
        name: 'Central Oregon Avalanche Center',
        link: 'http://www.coavalanche.org',
        image: '/images/resources/coac-logo.png',
      },
      {
        name: 'Wallowa Avalanche Center',
        link: 'https://wallowaavalanchecenter.org',
        image: '/images/resources/WalAC-Logo.png',
      },
    ],
    California: [
      {
        name: 'Shasta Avalanche Center',
        link: 'https://www.shastaavalanche.org/#/',
        image: '/images/resources/SAC-logo.png',
      },
      {
        name: 'Sierra Avalanche Center',
        link: 'https://www.sierraavalanchecenter.org/',
        image: '/images/resources/sierra-logo.png',
      },
      {
        name: 'Eastern Sierra Avalanche Center',
        link: 'https://www.esavalanche.org',
        image: '/images/resources/Esac-Logo.png',
      },
      {
        name: 'Bridgeport Avalanche Center',
        link: 'https://bridgeportavalanchecenter.org',
        image: '/images/resources/bac-logo.png.webp',
      },
    ],
    Utah: [
      {
        name: 'Utah Avalanche Center',
        link: 'https://utahavalanchecenter.org/',
        image: '/images/resources/uac-logo.svg',
      },
    ],
    Colorado: [
      {
        name: 'Colorado Avalanche Information Center',
        link: 'https://avalanche.state.co.us/',
        image: '/images/resources/caic-logo.jpg',
      },
      {
        name: 'Crested Butte Avalanche Center',
        link: 'https://cbavalanchecenter.org',
        image: '/images/resources/cbac-logo.png',
      },
    ],
    Montana: [
      {
        name: 'Gallatin National Forest Avalanche Center',
        link: 'https://www.mtavalanche.com/',
        image: '/images/resources/gnfac-logo.png',
      },
      {
        name: 'The Flathead Avalanche Center',
        link: 'https://www.flatheadavalanche.org',
        image: '/images/resources/Flathead-logo.jpg',
      },
      {
        name: 'Missoula Avalanche Center',
        link: 'https://missoulaavalanche.org',
        image: '/images/resources/missoula-logo.svg',
      },
    ],
    Wyoming: [
      {
        name: 'Bridger-Teton Avalanche Center',
        link: 'https://www.jhavalanche.org/',
        image: '/images/resources/BTAC-Logos.png',
      },
    ],
    Idaho: [
      {
        name: 'Idaho Panhandle Avalanche Center',
        link: 'https://www.idahopanhandleavalanche.org',
        image: '/images/resources/IPAC-logo.webp',
      },
      {
        name: 'Sawtooth Avalanche Center',
        link: 'https://www.sawtoothavalanche.com',
        image: '/images/resources/stac-logo.webp',
      },
      {
        name: 'Payette Avalanche Center',
        link: 'https://payetteavalanche.org',
        image: '/images/resources/pac-logo.png',
      },
    ],
    Arizona: [
      {
        name: 'Kachina Peaks Avalanche Center',
        link: 'https://kachinapeaks.org',
        image: '/images/resources/Kpac-logo.png',
      },
    ],
    'New Mexico': [
      {
        name: 'Taos Avalanche Center',
        link: 'https://taosavalanchecenter.org',
        image: '/images/resources/TAC-logo.png',
      },
    ],
    'New Hampshire': [
      {
        name: 'Mt. Washington Avalanche Center',
        link: 'https://www.mountwashingtonavalanchecenter.org',
        image: '/images/resources/MWAC-Logo.webp',
      },
    ],
  };

  // Filter function for search
  const filterCenters = (centers) => {
    if (!searchQuery.trim()) return centers;
    return centers.filter((center) =>
      center.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const filterStates = () => {
    if (!searchQuery.trim()) return Object.keys(avalancheCentersByState);
    return Object.keys(avalancheCentersByState).filter((state) => {
      const hasMatchingCenter = avalancheCentersByState[state].some((center) =>
        center.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      return (
        hasMatchingCenter ||
        state.toLowerCase().includes(searchQuery.toLowerCase())
      );
    });
  };

  const renderCenterCard = (center) => (
    <Grid item xs={12} sm={6} md={4} key={center.name}>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
          },
        }}
      >
        <CardMedia
          component="img"
          image={center.image}
          alt={center.name}
          sx={{
            height: 120,
            width: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            backgroundColor: '#f5f5f5',
            p: 2,
          }}
        />
        <CardContent
          sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}
        >
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              fontSize: '1rem',
              fontWeight: 600,
              lineHeight: 1.3,
              minHeight: '2.6em',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {center.name}
          </Typography>
          <Box sx={{ mt: 'auto' }}>
            <Button
              variant="outlined"
              href={center.link}
              target="_blank"
              rel="noopener noreferrer"
              fullWidth
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Visit Forecast
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );

  return (
    <>
      <SEO
        title="Avalanche Resources - The Avalanche Hour Podcast"
        description="Comprehensive directory of avalanche forecasting centers, educational resources, and safety information organized by state and region."
        keywords="avalanche resources, avalanche centers, avalanche forecasts, snow safety, backcountry resources"
        url="/resources"
      />

      <Navbar />

      <Container maxWidth="lg" sx={{ mt: 4, mb: 6 }}>
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
          Avalanche Resources
        </Typography>

        <Typography
          variant="h6"
          component="p"
          color="text.secondary"
          align="center"
          sx={{ mb: 4, maxWidth: '700px', mx: 'auto' }}
        >
          Essential resources for avalanche safety, forecasting, and education.
          Find your local avalanche center and stay informed.
        </Typography>

        {/* Search Box */}
        <Box sx={{ mb: 4, maxWidth: '600px', mx: 'auto' }}>
          <TextField
            fullWidth
            label="Search resources and avalanche centers"
            variant="outlined"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
            }}
            placeholder="Search by center name, state, or region..."
          />
        </Box>

        {/* National/International Centers */}
        <Box sx={{ mb: 6 }}>
          <Typography
            variant="h2"
            component="h2"
            gutterBottom
            sx={{
              fontSize: { xs: '2rem', md: '2.5rem' },
              fontFamily: 'Amatic SC, cursive',
              display: 'flex',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <Public sx={{ mr: 2, fontSize: 'inherit' }} />
            National & International Centers
          </Typography>

          <Grid container spacing={3}>
            {filterCenters(nationalCenters).map((center) =>
              renderCenterCard(center)
            )}
          </Grid>
        </Box>

        {/* General Resources */}
        <Box sx={{ mb: 6 }}>
          <Typography
            variant="h2"
            component="h2"
            gutterBottom
            sx={{
              fontSize: { xs: '2rem', md: '2.5rem' },
              fontFamily: 'Amatic SC, cursive',
              display: 'flex',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <Book sx={{ mr: 2, fontSize: 'inherit' }} />
            Educational Resources
          </Typography>

          <Paper elevation={1} sx={{ p: 3 }}>
            <List>
              {generalResources
                .filter(
                  (resource) =>
                    !searchQuery.trim() ||
                    resource.name
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase()) ||
                    resource.description
                      .toLowerCase()
                      .includes(searchQuery.toLowerCase())
                )
                .map((resource, index) => (
                  <ListItem
                    key={index}
                    component="a"
                    href={resource.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      textDecoration: 'none',
                      color: 'inherit',
                      borderRadius: 1,
                      mb: 1,
                      '&:hover': {
                        backgroundColor: 'action.hover',
                        '& .resource-name': { color: 'primary.main' },
                      },
                    }}
                  >
                    <ListItemText
                      primary={
                        <Typography
                          className="resource-name"
                          sx={{ fontWeight: 600 }}
                        >
                          {resource.name}
                        </Typography>
                      }
                      secondary={resource.description}
                    />
                  </ListItem>
                ))}
            </List>
          </Paper>
        </Box>

        {/* Regional Avalanche Centers */}
        <Box sx={{ mb: 4 }}>
          <Typography
            variant="h2"
            component="h2"
            gutterBottom
            sx={{
              fontSize: { xs: '2rem', md: '2.5rem' },
              fontFamily: 'Amatic SC, cursive',
              display: 'flex',
              alignItems: 'center',
              mb: 3,
            }}
          >
            <LocationOn sx={{ mr: 2, fontSize: 'inherit' }} />
            Regional Avalanche Centers
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ mb: 4 }}
          >
            Find avalanche forecasts and conditions for your region. Centers are
            organized by state and provide critical safety information for
            backcountry travelers.
          </Typography>

          {filterStates().map((state) => (
            <Accordion
              key={state}
              defaultExpanded={searchQuery.trim() !== ''}
              sx={{ mb: 2 }}
            >
              <AccordionSummary
                expandIcon={<ExpandMore />}
                sx={{
                  backgroundColor: 'grey.50',
                  '&:hover': { backgroundColor: 'grey.100' },
                }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                  }}
                >
                  <Typography
                    variant="h5"
                    component="h3"
                    sx={{ flexGrow: 1, fontWeight: 600 }}
                  >
                    {state}
                  </Typography>
                  <Chip
                    label={`${filterCenters(avalancheCentersByState[state]).length} center${
                      filterCenters(avalancheCentersByState[state]).length !== 1
                        ? 's'
                        : ''
                    }`}
                    color="primary"
                    variant="outlined"
                    size="small"
                  />
                </Box>
              </AccordionSummary>

              <AccordionDetails sx={{ p: 3 }}>
                <Grid container spacing={3}>
                  {filterCenters(avalancheCentersByState[state]).map(
                    (center) => renderCenterCard(center)
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>

        {/* Safety Notice */}
        <Paper
          elevation={2}
          sx={{
            p: 3,
            backgroundColor: 'warning.50',
            border: '1px solid',
            borderColor: 'warning.200',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
            <Warning sx={{ color: 'warning.main', mr: 2, mt: 0.5 }} />
            <Box>
              <Typography
                variant="h6"
                component="h3"
                gutterBottom
                sx={{ fontWeight: 600 }}
              >
                Safety Reminder
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Always check current avalanche conditions before heading into the
                backcountry. Carry proper rescue equipment (beacon, probe,
                shovel), travel with experienced partners, and consider taking
                an avalanche safety course. No forecast is a substitute for good
                judgment and proper preparation.
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Container>
    </>
  );
}