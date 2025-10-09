// components/VoicemailCTA.jsx
import React from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import CallIcon from '@mui/icons-material/Call';

export default function VoicemailCTA() {
  const number = '541-406-0221';
  const tel = `tel:${number.replace(/[^\\d]/g, '')}`;

  return (
    <Paper
      elevation={3}
      sx={{
        p: { xs: 2, md: 3 },
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flexWrap: 'wrap',
        borderLeft: (theme) => `6px solid ${theme.palette.primary.main}`,
      }}
      aria-label="VoicemailBag call to action"
    >
      <CallIcon aria-hidden />
      <Box sx={{ flex: 1, minWidth: 260 }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          VoicemailBag
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Leave us a message—your stories, comments, news, and questions may be highlighted on the next episode of
          <em> Slabs and Sluffs with Dom and Sara</em> (airs at the end of each month).
        </Typography>
      </Box>
      <Button component="a" href={tel} variant="contained" size="large">
        Call {number}
      </Button>
    </Paper>
  );
}