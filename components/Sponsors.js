// components/Sponsors.js
import * as React from 'react';
import {
  Typography,
  Grid,
  Card,
  CardContent,
  CardMedia,
  Link,
  Box,
  Chip,
  Divider,
} from '@mui/material';
import { sponsors } from '../src/data/sponsors';

const TIER_LABELS = {
  legacy: 'Legacy',
  partner: 'Partner',
  friends: 'Friends',
};

export default function Sponsors() {
  return (
    <React.Fragment>
      <Typography variant="h4" component="h2" gutterBottom sx={{ mt: 4, mb: 2 }}>
        Our Sponsors
      </Typography>
      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ mb: 4, maxWidth: 720 }}
      >
        These organizations support The Avalanche Hour and help us keep creating
        stories and education for the snow and avalanche community. Explore
        their work and any listener benefits they offer.
      </Typography>

      {['legacy', 'partner', 'friends'].map((tierKey, tierIndex) => {
        const items = sponsors[tierKey];
        if (!items || items.length === 0) return null;

        return (
          <Box key={tierKey} sx={{ mb: 6 }}>
            {tierIndex > 0 && <Divider sx={{ mb: 3 }} />}

            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                mb: 3,
              }}
            >
              <Typography variant="h5" component="h3">
                {TIER_LABELS[tierKey]}
              </Typography>
              <Chip
                label={`${items.length} sponsor${items.length !== 1 ? 's' : ''}`}
                size="small"
                variant="outlined"
                color={
                  tierKey === 'legacy'
                    ? 'primary'
                    : tierKey === 'partner'
                    ? 'secondary'
                    : 'default'
                }
              />
            </Box>

            <Grid container spacing={3}>
              {items.map((s) => (
                <Grid item key={s.id} xs={12} sm={6} md={4}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition:
                        'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
                      '&:hover': { transform: 'translateY(-3px)', boxShadow: 4 },
                    }}
                  >
                    <Link
                      href={s.url}
                      target="_blank"
                      rel="noopener"
                      underline="none"
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'grey.50',
                        py: 2,
                        px: 2,
                      }}
                    >
                      <CardMedia
                        component="img"
                        image={s.logo}
                        alt={s.name}
                        sx={{
                          maxHeight: 72, // slightly smaller than before
                          width: 'auto',
                          objectFit: 'contain',
                        }}
                      />
                    </Link>
                    <CardContent>
                      <Typography gutterBottom variant="subtitle1" component="div">
                        {s.name}
                      </Typography>
                      {/* Optional: once you have specific listener benefits, add them
                          to the data file (e.g., s.benefitText) and render here. */}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        );
      })}
    </React.Fragment>
  );
}