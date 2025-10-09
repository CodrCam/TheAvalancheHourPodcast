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
  // Balanced visual steps + centered layout
  const cfg = {
    legacy: {
      mediaH: { xs: 100, sm: 120, md: 140 },
      nameFs: { xs: '0.95rem', md: '1.05rem' },
      maxW: { xs: 340, sm: 380, md: 420 },
      borderW: 5,
      elevation: 2,
    },
    partner: {
      mediaH: { xs: 80, sm: 95, md: 110 },
      nameFs: { xs: '0.9rem', md: '0.98rem' },
      maxW: { xs: 300, sm: 340, md: 360 },
      borderW: 4,
      elevation: 1,
    },
    friends: {
      mediaH: { xs: 64, sm: 72, md: 88 },
      nameFs: { xs: '0.85rem', md: '0.9rem' },
      maxW: { xs: 260, sm: 280, md: 300 },
      borderW: 3,
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
        justifyContent="center" // center the row of cards
      >
        {items.map((s) => {
          const hasLogo = Boolean(s.logo && s.logo.trim());

          return (
            <Grid
              item
              key={s.name}
              xs={12}
              sm="auto"
              md="auto"
              sx={{ display: 'flex', justifyContent: 'center' }}
            >
              <Card
                elevation={cfg.elevation}
                sx={{
                  width: '100%',
                  maxWidth: cfg.maxW,
                  borderLeft: (theme) => `${cfg.borderW}px solid ${theme.palette.primary.main}`,
                  transition: 'transform 120ms ease, box-shadow 120ms ease',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
                }}
              >
                <CardActionArea
                  component="a"
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.name} // no hostname usage
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
                        p: { xs: 1, sm: 1.5 },
                      }}
                    />
                  ) : (
                    // Graceful fallback when no logo: show the sponsor name only
                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{ fontWeight: 600, fontSize: cfg.nameFs, lineHeight: 1.3 }}
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
      <Tier title="Legacy" items={sponsors.legacy} variant="legacy" />
      <Divider sx={{ my: 2 }} />
      <Tier title="Partner" items={sponsors.partner} variant="partner" />
      <Divider sx={{ my: 2 }} />
      <Tier title="Friends" items={sponsors.friends} variant="friends" />
    </Box>
  );
}