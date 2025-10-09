// pages/hosts/[slug].js
import React from 'react';
import Head from 'next/head';
import { Container, Box, Typography, Grid, CardMedia, Breadcrumbs, Link as MLink, Chip, Alert } from '@mui/material';
import Navbar from '../../components/Navbar';
import SEO from '../../components/SEO';
import { people } from '../../src/data/people';

const PLACEHOLDER_IMG = '/images/placeholder-person.jpg';

export default function HostProfile({ person }) {
  if (!person) {
    // Shouldn't happen with notFound: true, but keep a guard for dev
    return (
      <>
        <Navbar />
        <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
          <Alert severity="warning">Profile not found.</Alert>
        </Container>
      </>
    );
  }

  const {
    name,
    role,
    images = [],
    bioShort = '',
    bioFull = '',
    needsBio,
    needsImages,
    slug,
  } = person;

  const imgList = images.length ? images : [PLACEHOLDER_IMG];
  const roleLabel = role === 'host' ? 'Host' : 'Producer';

  // Simple JSON-LD for Person (SEO)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    description: bioShort || bioFull?.replace(/<[^>]+>/g, '')?.slice(0, 260),
    url: `https://www.theavalanchehour.com/hosts/${slug}`,
    image: imgList.map((src) => `https://www.theavalanchehour.com${src}`),
    jobTitle: roleLabel,
  };

  return (
    <>
      <SEO
        title={`${name} – ${roleLabel} | The Avalanche Hour`}
        description={bioShort || `Profile page for ${name}, ${roleLabel} at The Avalanche Hour.`}
        url={`/hosts/${slug}`}
      />
      <Head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>
      <Navbar />
      <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
        <Breadcrumbs sx={{ mb: 2 }}>
          <MLink href="/about">About</MLink>
          <Typography color="text.primary">{name}</Typography>
        </Breadcrumbs>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1, flexWrap: 'wrap' }}>
          <Typography variant="h3" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{name}</Typography>
          <Chip label={roleLabel} />
          {needsBio && <Chip label="Bio coming soon" color="warning" variant="outlined" />}
          {needsImages && <Chip label="Images needed" color="warning" variant="outlined" />}
        </Box>

        {bioShort && (
          <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
            {bioShort}
          </Typography>
        )}

        {/* Image gallery */}
        {imgList?.length > 0 && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {imgList.map((src, i) => (
              <Grid item xs={12} sm={6} md={4} key={`${src}-${i}`}>
                <CardMedia
                  component="img"
                  image={src}
                  alt={`${name} ${i + 1}`}
                  sx={{ height: 260, objectFit: 'cover', borderRadius: 2 }}
                />
              </Grid>
            ))}
          </Grid>
        )}

        {/* Full bio (HTML allowed) */}
        {bioFull ? (
          <Typography
            variant="body1"
            sx={{ lineHeight: 1.7 }}
            dangerouslySetInnerHTML={{ __html: bioFull }}
          />
        ) : (
          <Typography variant="body1">Bio coming soon.</Typography>
        )}
      </Container>
    </>
  );
}

export async function getStaticPaths() {
  // Pre-render all profiles
  const paths = people.map((p) => ({ params: { slug: p.slug } }));
  return { paths, fallback: false };
}

export async function getStaticProps({ params }) {
  const person = people.find((p) => p.slug === params.slug) || null;
  if (!person) return { notFound: true };
  return { props: { person } };
}