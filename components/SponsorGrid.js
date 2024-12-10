import React from 'react';
import { Grid, Box } from '@mui/material';

const sponsors = [
  // Replace with your actual sponsors' data
  { id: 1, name: 'Wyssen', logo: '/images/Sponsor1.png', website: 'https://www.wyssenavalanche.com/en/' },
  { id: 1, name: 'Gordoni', logo: '/images/Sponsor2.png', website: 'https://gordini.com/' },
  { id: 1, name: 'Open Snow', logo: '/images/Sponsor3.png', website: 'https://opensnow.com/' },
  { id: 1, name: 'Beacon', logo: '/images/Sponsor4.png', website: 'https://beaconguidebooks.com/' },
  { id: 1, name: '6point', logo: '/images/Sponsor5.jpg', website: 'https://6pointeng.com/' },
  { id: 1, name: 'Sponsor 1', logo: '/images/Sponsor6.jpg', website: 'https://www.propagationlabs.com/' },
  // ... you're at max of 6 sponsors
];

export default function SponsorGrid() {
  return (
    <Grid container spacing={4} justifyContent="center">
      {sponsors.map((sponsor) => (
        <Grid item key={sponsor.id} xs={6} sm={4} md={2}>
          <a href={sponsor.website} target="_blank" rel="noopener noreferrer">
            <Box
              component="img"
              src={sponsor.logo}
              alt={sponsor.name}
              sx={{ width: '100%', maxHeight: '100px', objectFit: 'contain' }}
            />
          </a>
        </Grid>
      ))}
    </Grid>
  );
}
