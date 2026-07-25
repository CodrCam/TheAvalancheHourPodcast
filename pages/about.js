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
import {
  PEOPLE_SECTIONS,
  groupPeopleForDisplay,
} from '../lib/peoplePresentation.mjs';

const PLACEHOLDER_IMG = '/images/placeholder-person.svg';

function getCategoryLabel(role) {
  if (role === 'host') return 'Host';
  if (role === 'webmaster') return 'Webmaster';
  if (role === 'social_media_manager') return 'Social Media Manager';
  if (role === 'team') return 'Team';
  return 'Producer';
}

function getAdditionalLabels(person) {
  const reserved = new Set(
    [getCategoryLabel(person.role), person.title]
      .map((label) => String(label || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const seen = new Set();

  return (person.roles || []).filter((label) => {
    const key = String(label || '').trim().toLowerCase();
    if (!key || reserved.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export default function AboutPage({ people, aboutContent }) {
  const groupedPeople = groupPeopleForDisplay(people);

  return (
    <>
      <SEO
        title="About The Avalanche Hour Podcast"
        description="Learn about The Avalanche Hour Podcast, why Caleb Merrill started the program, and meet the hosts and team behind it."
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
              Hosts and team members helping carry the conversations forward.
            </Typography>
          </Box>
          <Chip label={`${people.length} team members`} variant="outlined" />
        </Stack>

        {PEOPLE_SECTIONS.map((section, sectionIndex) => {
          const sectionPeople = groupedPeople[section.id];
          if (!sectionPeople.length) return null;

          return (
            <Box
              component="section"
              key={section.id}
              aria-labelledby={`${section.id}-heading`}
              sx={{
                mt: sectionIndex === 0 ? 0 : { xs: 6, md: 8 },
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
                justifyContent="space-between"
                sx={{ mb: 2.5, pb: 2, borderBottom: '1px solid', borderColor: 'grey.200' }}
              >
                <Box>
                  <Typography
                    id={`${section.id}-heading`}
                    variant="h3"
                    sx={{
                      fontWeight: 800,
                      fontSize: { xs: '1.7rem', md: '2.2rem' },
                    }}
                  >
                    {section.label}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    {section.description}
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={`${sectionPeople.length} ${
                    sectionPeople.length === 1 ? 'person' : 'people'
                  }`}
                  variant="outlined"
                />
              </Stack>

              <Grid container spacing={{ xs: 2, sm: 3, md: 4 }}>
                {sectionPeople.map((person) => {
                  const categoryLabel = getCategoryLabel(person.role);
                  const displayTitle =
                    person.title &&
                    person.title.trim().toLowerCase() !==
                      categoryLabel.toLowerCase()
                      ? person.title
                      : '';
                  const additionalLabels = getAdditionalLabels(person);

                  return (
                    <Grid item xs={12} sm={6} md={4} key={person.slug}>
                      <Card
                        sx={{
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: 'grey.200',
                          boxShadow: '0 8px 28px rgba(44, 62, 80, 0.07)',
                        }}
                      >
                        <CardMedia
                          component="img"
                          image={
                            !person.needsImages &&
                            person.images &&
                            person.images.length > 0
                              ? person.images[0]
                              : PLACEHOLDER_IMG
                          }
                          alt={
                            person.needsImages
                              ? `Profile photo coming soon for ${person.name}`
                              : person.name
                          }
                          sx={{
                            height: { xs: 240, sm: 270, md: 290 },
                            objectFit: 'cover',
                          }}
                        />

                        <CardContent sx={{ flexGrow: 1 }}>
                          <Chip
                            size="small"
                            label={categoryLabel}
                            color={person.role === 'host' ? 'primary' : 'default'}
                            variant={person.role === 'host' ? 'filled' : 'outlined'}
                            sx={{ mb: 1.25 }}
                          />
                          <Typography
                            variant="h6"
                            component="h4"
                            sx={{
                              fontWeight: 700,
                              fontSize: { xs: '1.15rem', md: '1.3rem' },
                              mb: displayTitle ? 0.25 : 1.25,
                            }}
                          >
                            {person.name}
                          </Typography>
                          {displayTitle ? (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ fontWeight: 600, mb: 1.25 }}
                            >
                              {displayTitle}
                            </Typography>
                          ) : null}
                          {additionalLabels.length ? (
                            <Stack
                              direction="row"
                              spacing={0.75}
                              useFlexGap
                              flexWrap="wrap"
                              sx={{ mb: 1.5 }}
                            >
                              {additionalLabels.map((roleLabel) => (
                                <Chip
                                  key={roleLabel}
                                  size="small"
                                  label={roleLabel}
                                  variant="outlined"
                                  sx={{ color: 'text.secondary' }}
                                />
                              ))}
                            </Stack>
                          ) : null}

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              fontSize: { xs: '0.88rem', md: '0.95rem' },
                              lineHeight: 1.65,
                            }}
                          >
                            {person.needsBio ? 'Bio coming soon.' : person.bioShort}
                          </Typography>
                        </CardContent>

                        <Box sx={{ p: 2.5, pt: 0 }}>
                          <Button
                            component={Link}
                            href={`/hosts/${person.slug}`}
                            variant="outlined"
                            color="primary"
                            fullWidth
                            sx={{
                              py: { xs: 1, md: 1.1 },
                              fontSize: { xs: '0.9rem', md: '0.95rem' },
                            }}
                          >
                            View Profile
                          </Button>
                        </Box>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          );
        })}
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
