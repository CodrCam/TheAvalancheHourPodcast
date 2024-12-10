import * as React from 'react';
import { Typography, Grid, Card, CardContent, CardMedia, Link } from '@mui/material';

const sponsors = [
  {
    id: 1,
    name: 'Sponsor One',
    logo: '/images/sponsor1.png',
    link: 'https://sponsorone.com',
    code: 'AVALANCHE10',
  },
  // Add more sponsors as needed
];

export default function Sponsors() {
  return (
    <React.Fragment>
      <Typography variant="h4" component="h2" gutterBottom sx={{ mt: 4 }}>
        Our Sponsors
      </Typography>
      <Grid container spacing={4}>
        {sponsors.map((sponsor) => (
          <Grid item key={sponsor.id} xs={12} sm={6} md={4}>
            <Card>
              <Link href={sponsor.link} target="_blank" rel="noopener">
                <CardMedia
                  component="img"
                  height="140"
                  image={sponsor.logo}
                  alt={sponsor.name}
                />
              </Link>
              <CardContent>
                <Typography gutterBottom variant="h5" component="div">
                  {sponsor.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Use Code: {sponsor.code}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </React.Fragment>
  );
}
