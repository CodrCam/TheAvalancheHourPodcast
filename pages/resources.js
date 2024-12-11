import React from 'react';
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
} from '@mui/material';
import Navbar from '../components/Navbar';

export default function Resources() {
  const resources = [
    {
      name: 'International Snow Science Workshops (ISSW) Proceedings',
      link: 'https://arc.lib.montana.edu/snow-science/',
    },
    {
      name: 'American Avalanche Association',
      link: 'https://www.americanavalancheassociation.org/',
    },
    {
      name: 'Canadian Avalanche Association',
      link: 'https://www.avalancheassociation.ca',
    },
    {
      name: 'National Avalanche Center',
      link: 'https://avalanche.org/national-avalanche-center/',
    },
  ];

  const forecastOrganizations = [
    {
      name: 'National Avalanche Center',
      link: 'https://avalanche.org/#/current',
      image: '/images/NAC.png',
    },
    {
      name: 'Avalanche Canada',
      link: 'https://avalanche.ca/',
      image: '/images/AvCan-logo.svg',
    },
    {
      name: 'Chugach National Forest Avalanche Information Center',
      link: 'https://www.cnfaic.org/',
      image: '/images/chugach-logo.png',
    },
    {
      name: 'Hatcher Pass Avalanche Center',
      link: 'https://hpavalanche.org/',
      image: '/images/hatcher-logo.png',
    },
    {
      name: 'Alaska Avalanche Information Center',
      link: 'https://alaskasnow.org/',
      image: '/images/AAIC-logo.png.webp',
    },
    {
      name: 'Northwest Avalanche Center',
      link: 'https://nwac.us/',
      image: '/images/nwac-logo.png',
    },
    {
      name: 'Central Oregon Avalanche Center',
      link: 'http://www.coavalanche.org',
      image: '/images/coac-logo.png',
    },
    {
      name: 'Wallowa Avalanche Center',
      link: 'https://wallowaavalanchecenter.org',
      image: '/images/WalAC-Logo.png',
    },
    {
      name: 'Colorado Avalanche Information Center',
      link: 'https://avalanche.state.co.us/',
      image: '/images/caic-logo.jpg',
    },
    {
      name: 'Crested Butte Avalanche Center',
      link: 'https://cbavalanchecenter.org',
      image: '/images/cbac-logo.png',
    },
    {
      name: 'Shasta Avalanche Center',
      link: 'https://www.shastaavalanche.org/#/',
      image: '/images/SAC-logo.png',
    },
    {
      name: 'Sierra Avalanche Center',
      link: 'https://www.sierraavalanchecenter.org/',
      image: '/images/sierra-logo.png',
    },
    {
      name: 'Eastern Sierra Avalanche Center',
      link: 'https://www.esavalanche.org',
      image: '/images/Esac-Logo.png',
    },
    {
      name: 'Bridgeport Avalanche Center',
      link: 'https://bridgeportavalanchecenter.org',
      image: '/images/bac-logo.png.webp',
    },
    {
      name: 'Utah Avalanche Center',
      link: 'https://utahavalanchecenter.org/',
      image: '/images/uac-logo.svg',
    },
    {
      name: 'Gallatin National Forest Avalanche Center',
      link: 'https://www.mtavalanche.com/',
      image: '/images/gnfac-logo.png',
    },
    {
      name: 'The Flathead Avalanche Center',
      link: 'https://www.flatheadavalanche.org',
      image: '/images/Flathead-logo.jpg',
    },
    {
      name: 'Missoula Avalanche Center',
      link: 'https://missoulaavalanche.org',
      image: '/images/missoula-logo.svg',
    },
    {
      name: 'Bridger-Teton Avalanche Center',
      link: 'https://www.jhavalanche.org/',
      image: '/images/BTAC-Logos.png',
    },
    {
      name: 'Idaho Panhandle Avalanche Center',
      link: 'https://www.idahopanhandleavalanche.org',
      image: '/images/IPAC-logo.webp',
    },
    {
      name: 'Sawtooth Avalanche Center',
      link: 'https://www.sawtoothavalanche.com',
      image: '/images/stac-logo.webp',
    },
    {
      name: 'Payette Avalanche Center',
      link: 'https://payetteavalanche.org',
      image: '/images/pac-logo.png',
    },
    {
      name: 'Kachina Peaks Avalanche Center',
      link: 'https://kachinapeaks.org',
      image: '/images/Kpac-logo.png',
    },
    {
      name: 'Taos Avalanche Center',
      link: 'https://taosavalanchecenter.org',
      image: '/images/TAC-logo.png',
    },
    {
      name: 'Mt. Washington Avalanche Center',
      link: 'https://www.mountwashingtonavalanchecenter.org',
      image: '/images/MWAC-Logo.webp',
    },
  ];

  return (
    <React.Fragment>
      <Navbar />
      <Container maxWidth="md" sx={{ mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Resources
        </Typography>
        <Typography variant="body1" gutterBottom>
          Here are some essential resources for snow science, avalanche safety, and education:
        </Typography>
        <List>
          {resources.map((resource, index) => (
            <ListItem
              key={index}
              component="a"
              href={resource.link}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                textDecoration: 'none',
                color: 'inherit',
                '&:hover': { textDecoration: 'underline', color: 'primary.main' },
              }}
            >
              <ListItemText primary={resource.name} />
            </ListItem>
          ))}
        </List>

        <Box sx={{ mt: 6 }}>
          <Typography variant="h5" gutterBottom>
            Avalanche Forecasting Organizations
          </Typography>
          <Typography variant="body1" gutterBottom>
            Below are organizations that provide avalanche forecasts and valuable backcountry information:
          </Typography>

          <Grid container spacing={4} sx={{ mt: 2 }}>
            {forecastOrganizations.map((org, idx) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={idx}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardMedia
                  component="img"
                  image={org.image}
                  alt={org.name}
                  sx={{
                    height: 140,          // Set a fixed height
                    width: '100%',        // Ensure the image spans the full width of the card
                    objectFit: 'contain', // Fit the entire image inside the card without cropping
                    objectPosition: 'center', // Center the image within the container
                    backgroundColor: '#f5f5f5', // Add a background color to fill any empty space
                    borderRadius: '4px',  // Optional: Round the corners slightly
                  }}
                />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      {org.name}
                    </Typography>
                    <Button
                      variant="outlined"
                      href={org.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ textTransform: 'none' }}
                    >
                      Visit Site
                    </Button>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    </React.Fragment>
  );
}