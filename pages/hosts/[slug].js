// pages/hosts/[slug].js
import React from 'react';
import Head from 'next/head';
import { Container, Box, Typography, Grid, CardMedia, Breadcrumbs, Link as MLink, Chip, Alert } from '@mui/material';
import Navbar from '../../components/Navbar';
import SEO from '../../components/SEO';
import { getPersonBySlug, getStaticPeopleSeed } from '../../lib/peopleStore';
import { profileBioToPlainText } from '../../lib/peoplePresentation.mjs';
import { safeJsonLdStringify } from '../../lib/structuredData.mjs';

const PLACEHOLDER_IMG = '/images/placeholder-person.svg';
const SITE_ORIGIN = 'https://www.theavalanchehour.com';

function getPublicImageUrl(value) {
  try {
    const url = new URL(String(value || ''), SITE_ORIGIN);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function getCategoryLabel(role) {
  if (role === 'host') return 'Host';
  if (role === 'webmaster') return 'Webmaster';
  if (role === 'social_media_manager') return 'Social Media Manager';
  if (role === 'team') return 'Team';
  return 'Producer';
}

function getAdditionalLabels(roles = [], reservedLabels = []) {
  const reserved = new Set(
    reservedLabels
      .map((label) => String(label || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const seen = new Set();

  return roles.filter((label) => {
    const key = String(label || '').trim().toLowerCase();
    if (!key || reserved.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
    roles = [],
    title = '',
    bioShort = '',
    bioFull = '',
    slug,
    needsImages = false,
  } = person;

  const usesPlaceholder = needsImages || images.length === 0;
  const imgList = usesPlaceholder ? [PLACEHOLDER_IMG] : images;
  const roleLabel = getCategoryLabel(role);
  const displayTitle =
    title.trim().toLowerCase() === roleLabel.toLowerCase()
      ? ''
      : title.trim();
  const additionalLabels = getAdditionalLabels(roles, [
    roleLabel,
    displayTitle,
  ]);
  const plainBioFull = profileBioToPlainText(bioFull);

  // Simple JSON-LD for Person (SEO)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    description: bioShort || plainBioFull.slice(0, 260),
    url: `${SITE_ORIGIN}/hosts/${slug}`,
    image: imgList.map(getPublicImageUrl).filter(Boolean),
    jobTitle: displayTitle || roleLabel,
  };

  return (
    <>
      <SEO
        title={`${name} – ${roleLabel} | The Avalanche Hour`}
        description={bioShort || `Profile page for ${name}, ${roleLabel} at The Avalanche Hour.`}
        url={`/hosts/${slug}`}
      />
      <Head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
        />
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
          {additionalLabels.map((roleName) => (
            <Chip key={roleName} label={roleName} variant="outlined" />
          ))}
        </Box>

        {displayTitle ? (
          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ mb: 1.5, fontWeight: 600 }}
          >
            {displayTitle}
          </Typography>
        ) : null}

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
                  alt={
                    usesPlaceholder
                      ? `Profile photo coming soon for ${name}`
                      : `${name} ${i + 1}`
                  }
                  sx={{ height: 260, objectFit: 'cover', borderRadius: 2 }}
                />
              </Grid>
            ))}
          </Grid>
        )}

        {plainBioFull ? (
          <Typography
            variant="body1"
            sx={{ lineHeight: 1.7, whiteSpace: 'pre-line' }}
          >
            {plainBioFull}
          </Typography>
        ) : (
          <Typography variant="body1">Bio coming soon.</Typography>
        )}
      </Container>
    </>
  );
}

export async function getServerSideProps({ params }) {
  let person = null;

  try {
    const result = await getPersonBySlug(params.slug, { allowStaticFallback: true });
    person = result.person || null;
  } catch {
    person =
      getStaticPeopleSeed().find((staticPerson) => staticPerson.slug === params.slug) ||
      null;
  }

  if (!person) return { notFound: true };
  return { props: { person } };
}
