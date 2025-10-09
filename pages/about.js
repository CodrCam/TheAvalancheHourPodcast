// pages/about.js
import React from 'react';
import {
  Container,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Button,
  Chip,
  Box,
} from '@mui/material';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import SEO from '../components/SEO';
import { people } from '../src/data/people';

export default function AboutPage() {
  return (
    <>
      <SEO
        title="About the Hosts & Producers | The Avalanche Hour"
        description="Meet the hosts and producers of The Avalanche Hour Podcast — a diverse team of avalanche professionals, guides, educators, and storytellers."
        url="/about"
      />
      <Navbar />
      <Container maxWidth="lg" sx={{ mt: { xs: 4, md: 6 }, mb: { xs: 6, md: 10 } }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            mb: { xs: 3, md: 4 },
            fontSize: { xs: '1.75rem', md: '2.5rem' },
          }}
        >
          Meet the Team
        </Typography>

        <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
          {people.map((person) => (
            <Grid item xs={12} sm={6} md={4} key={person.slug}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Headshot */}
                <CardMedia
                  component="img"
                  image={
                    person.images && person.images.length > 0
                      ? person.images[0]
                      : '/images/placeholder-person.jpg'
                  }
                  alt={person.name}
                  sx={{
                    height: { xs: 220, sm: 260, md: 280 },
                    objectFit: 'cover',
                  }}
                />

                <CardContent sx={{ flexGrow: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 1,
                      flexWrap: 'wrap',
                    }}
                  >
                    <Typography
                      gutterBottom
                      variant="h6"
                      component="div"
                      sx={{
                        fontWeight: 600,
                        fontSize: { xs: '1.1rem', md: '1.25rem' },
                      }}
                    >
                      {person.name}
                    </Typography>
                    <Chip
                      size="small"
                      label={person.role === 'host' ? 'Host' : 'Producer'}
                      color={person.role === 'host' ? 'primary' : 'secondary'}
                    />
                  </Box>

                  {person.needsBio ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.85rem', md: '0.95rem' } }}
                    >
                      Bio coming soon.
                    </Typography>
                  ) : (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ fontSize: { xs: '0.85rem', md: '0.95rem' } }}
                    >
                      {person.bioShort}
                    </Typography>
                  )}
                </CardContent>

                <Box sx={{ p: 2, pt: 0 }}>
                  <Link href={`/hosts/${person.slug}`} passHref legacyBehavior>
                    <Button
                      variant="contained"
                      color="primary"
                      fullWidth
                      sx={{
                        py: { xs: 1, md: 1.2 },
                        fontSize: { xs: '0.9rem', md: '1rem' },
                      }}
                    >
                      View Profile
                    </Button>
                  </Link>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </>
  );
}