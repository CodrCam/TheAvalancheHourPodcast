import React from 'react';
import { Card, CardContent, CardMedia, Typography, Button, Box } from '@mui/material';

export default function EpisodeCard({ episode }) {
  return (
    <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box
        sx={{
          height: 140, // Fixed height for consistency
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f5f5f5', // Add background color for letterboxing
        }}
      >
        <CardMedia
          component="img"
          image={episode.images[0]?.url || '/images/default.jpg'}
          alt={episode.name}
          sx={{
            maxHeight: '100%', // Ensure the image fits vertically
            maxWidth: '100%', // Ensure the image fits horizontally
            objectFit: 'contain', // Prevent cropping and maintain aspect ratio
          }}
        />
      </Box>
      <CardContent sx={{ flexGrow: 1 }}>
        <Typography variant="h6" gutterBottom>
          {episode.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {episode.description || 'No description available.'}
        </Typography>
        <Button
          variant="outlined"
          color="primary"
          href={episode.external_urls?.spotify || '#'}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ mt: 2 }}
        >
          Listen Now
        </Button>
      </CardContent>
    </Card>
  );
}