// components/SponsorGrid.js
import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActionArea,
  Typography,
  Divider,
} from '@mui/material';
import { sponsors } from '../src/data/sponsors';

function Tier({ title, items, variant, visibility }) {
  const visibleItems = items.filter((s) => visibility?.[s.id] !== false);
  if (!visibleItems.length) return null;

  const cfg = {
    legacy: {
      mediaH: { xs: 126, sm: 146, md: 164 },
      nameFs: { xs: '0.95rem', md: '1.05rem' },
      maxW: { xs: 320, sm: 350, md: 380 },
      borderW: 3,
      elevation: 2,
      imageP: { xs: 1.25, sm: 1.75 },
    },
    partner: {
      mediaH: { xs: 48, sm: 56, md: 64 },
      nameFs: { xs: '0.88rem', md: '0.95rem' },
      maxW: { xs: 230, sm: 245, md: 260 },
      borderW: 1,
      elevation: 1,
      imageP: { xs: 0.75, sm: 1 },
    },
    friends: {
      mediaH: { xs: 60, sm: 70, md: 80 },
      nameFs: { xs: '0.85rem', md: '0.9rem' },
      maxW: { xs: 260, sm: 280, md: 300 },
      borderW: 1,
      elevation: 0,
      imageP: { xs: 0.75, sm: 1 },
    },
  }[variant];

  return (
    <Box sx={{ mb: 6 }}>
      <Typography
        variant="h5"
        component="h3"
        sx={{
          fontWeight: 700,
          mb: 2,
          textAlign: 'center',
          fontSize: { xs: '1.2rem', md: '1.4rem' },
        }}
      >
        {title}
      </Typography>

      <Grid
        container
        spacing={{ xs: 2, sm: 3 }}
        justifyContent="center"
      >
        {visibleItems.map((s) => {
          const hasLogo = Boolean(s.logo && s.logo.trim());

          return (
            <Grid
              item
              key={s.id || s.name}
              xs={12}
              sm="auto"
              md="auto"
              sx={{ display: 'flex', justifyContent: 'center' }}
            >
              <Card
                elevation={cfg.elevation}
                sx={{
                  width: '100%',
                  maxWidth: cfg.maxW, // default per tier
                  borderLeft: (theme) =>
                    `${cfg.borderW}px solid ${theme.palette.primary.main}`,
                  transition: 'transform 120ms ease, box-shadow 120ms ease',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                }}
              >
                <CardActionArea
                  component="a"
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                  }}
                >
                  {hasLogo ? (
                    <CardMedia
                      component="img"
                      image={s.logo}
                      alt={`${s.name} logo`}
                      loading="lazy"
                      sx={{
                        height: cfg.mediaH,
                        objectFit: 'contain',
                        backgroundColor: '#fff',
                        mixBlendMode: 'multiply',
                        p: cfg.imageP,
                      }}
                    />
                  ) : (
                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: 600,
                          fontSize: cfg.nameFs,
                          lineHeight: 1.3,
                        }}
                      >
                        {s.name}
                      </Typography>
                    </CardContent>
                  )}
                </CardActionArea>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
}

export default function SponsorGrid({ sponsorsByTier = sponsors, visibility = {} }) {
  const legacyItems = sponsorsByTier.legacy || [];
  const partnerItems = sponsorsByTier.partner || [];
  const legacyVisible = legacyItems.some((s) => visibility?.[s.id] !== false);
  const partnerVisible = partnerItems.some((s) => visibility?.[s.id] !== false);

  return (
    <Box sx={{ px: { xs: 1, sm: 2 } }}>
      {/* Homepage: Legacy + Partner only */}
      <Tier
        title="Legacy"
        items={legacyItems}
        variant="legacy"
        visibility={visibility}
      />
      {legacyVisible && partnerVisible ? <Divider sx={{ my: 2 }} /> : null}
      <Tier
        title="Partner"
        items={partnerItems}
        variant="partner"
        visibility={visibility}
      />
    </Box>
  );
}
