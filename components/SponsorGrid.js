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

function Tier({ title, items, variant }) {
  // Legacy stays as-is; Partner is smaller; Friends kept for reuse if needed.
  const cfg = {
    legacy: {
      mediaH: { xs: 80, sm: 96, md: 110 },
      nameFs: { xs: '0.95rem', md: '1.05rem' },
      maxW: { xs: 300, sm: 320, md: 340 },
      borderW: 3,
      elevation: 2,
    },
    partner: {
      // Make partners visibly smaller than legacy
      mediaH: { xs: 62, sm: 72, md: 82 },
      nameFs: { xs: '0.88rem', md: '0.95rem' },
      maxW: { xs: 250, sm: 270, md: 290 },
      borderW: 2,
      elevation: 1,
    },
    friends: {
      mediaH: { xs: 60, sm: 70, md: 80 },
      nameFs: { xs: '0.85rem', md: '0.9rem' },
      maxW: { xs: 260, sm: 280, md: 300 },
      borderW: 1,
      elevation: 0,
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
        {items.map((s) => {
          const hasLogo = Boolean(s.logo && s.logo.trim());
          const isAvss =
            s.id === 'avss' || s.name.toLowerCase().includes('avss');

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

                  // AVSS: make the entire card narrower than the others
                  ...(isAvss && {
                    maxWidth: { xs: 200, sm: 240, md: 260 },
                  }),
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
                        p: { xs: 0.75, sm: 1 },
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

export default function SponsorGrid() {
  return (
    <Box sx={{ px: { xs: 1, sm: 2 } }}>
      {/* Homepage: Legacy + Partner only */}
      <Tier title="Legacy" items={sponsors.legacy} variant="legacy" />
      <Divider sx={{ my: 2 }} />
      <Tier title="Partner" items={sponsors.partner} variant="partner" />
    </Box>
  );
}