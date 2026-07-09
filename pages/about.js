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
  Stack,
  Paper,
} from '@mui/material';
import Link from 'next/link';
import Navbar from '../components/Navbar';
import SEO from '../components/SEO';
import { DEFAULT_HOME_CONTENT } from '../lib/siteContentDefaults';
import { getHomeContent } from '../lib/siteContentStore';
import { getStaticPeopleSeed, listPeople } from '../lib/peopleStore';

const PLACEHOLDER_IMG = '/images/placeholder-person.jpg';

export default function AboutPage({ people, aboutContent }) {
  return (
    <>
      <SEO
        title="About The Avalanche Hour Podcast"
        description="Learn about The Avalanche Hour Podcast, why Caleb Merrill started the program, and meet the hosts and producers behind it."
        url="/about"
      />
      <Navbar />
      <Container maxWidth="lg" sx={{ mt: { xs: 4, md: 6 }, mb: { xs: 6, md: 10 } }}>
        <Box
          component="section"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.25fr) minmax(280px, 0.75fr)' },
            gap: { xs: 3, md: 5 },
            alignItems: 'start',
            mb: { xs: 5, md: 7 },
          }}
        >
          <Box>
            <Typography
              variant="overline"
              color="primary"
              sx={{ fontWeight: 800, letterSpacing: 0 }}
            >
              {aboutContent.aboutEyebrow}
            </Typography>
            <Typography
              variant="h1"
              sx={{
                fontWeight: 800,
                lineHeight: 1.08,
                mt: 1,
                mb: 2.5,
                fontSize: { xs: '2.2rem', md: '3.4rem' },
              }}
            >
              {aboutContent.aboutHeading}
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontSize: { xs: '1rem', md: '1.08rem' }, lineHeight: 1.8 }}
            >
              {aboutContent.aboutIntro}
            </Typography>
          </Box>

          <Paper
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'grey.200',
              borderRadius: 2,
              p: { xs: 2.5, md: 3 },
              bgcolor: 'grey.50',
            }}
          >
            <Typography variant="h5" sx={{ fontWeight: 800, mb: 1.5 }}>
              {aboutContent.aboutMissionHeading}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ lineHeight: 1.75, mb: 2.5 }}
            >
              {aboutContent.aboutMissionBody}
            </Typography>
            {aboutContent.aboutListenUrl ? (
              <Button
                component="a"
                href={aboutContent.aboutListenUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="contained"
              >
                {aboutContent.aboutListenLabel}
              </Button>
            ) : null}
          </Paper>
        </Box>

        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
          justifyContent="space-between"
          sx={{ mb: { xs: 3, md: 4 } }}
        >
          <Box>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 800,
                fontSize: { xs: '1.8rem', md: '2.5rem' },
              }}
            >
              Meet the Team
            </Typography>
            <Typography color="text.secondary">
              Hosts and producers helping carry the conversations forward.
            </Typography>
          </Box>
          <Chip label={`${people.length} team members`} variant="outlined" />
        </Stack>

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
                      : PLACEHOLDER_IMG
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
                    {person.title ? (
                      <Chip size="small" label={person.title} variant="outlined" />
                    ) : null}
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
                  <Button
                    component={Link}
                    href={`/hosts/${person.slug}`}
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
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </>
  );
}

export async function getServerSideProps() {
  let peopleResult;
  let contentResult;

  try {
    peopleResult = await listPeople({ allowStaticFallback: true });
  } catch {
    peopleResult = { people: getStaticPeopleSeed(), source: 'static', configured: false };
  }

  try {
    contentResult = await getHomeContent({ allowDefault: true });
  } catch {
    contentResult = { content: DEFAULT_HOME_CONTENT };
  }

  return {
    props: {
      people: peopleResult.people || [],
      aboutContent: {
        ...DEFAULT_HOME_CONTENT,
        ...(contentResult.content || {}),
      },
    },
  };
}
