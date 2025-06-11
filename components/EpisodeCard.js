import React from 'react';
import { 
  Card, 
  CardContent, 
  CardMedia, 
  Typography, 
  Button, 
  Box, 
  Chip,
  CardActionArea,
  Skeleton
} from '@mui/material';
import { PlayArrow, Schedule } from '@mui/icons-material';

export default function EpisodeCard({ episode, loading = false }) {
  if (loading) {
    return (
      <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Skeleton variant="rectangular" height={140} />
        <CardContent sx={{ flexGrow: 1 }}>
          <Skeleton variant="text" sx={{ fontSize: '1.5rem' }} />
          <Skeleton variant="text" />
          <Skeleton variant="text" />
          <Skeleton variant="rectangular" width={100} height={36} sx={{ mt: 2 }} />
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDuration = (durationMs) => {
    if (!durationMs) return null;
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${remainingMinutes}m`;
    }
    return `${minutes}m`;
  };

  const truncateDescription = (text, maxLength = 150) => {
    if (!text) return 'No description available.';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength).trim() + '...';
  };

  return (
    <Card 
      sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
        }
      }}
      elevation={2}
    >
      <CardActionArea
        href={episode.external_urls?.spotify || '#'}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Listen to ${episode.name} on Spotify`}
        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
      >
        <Box
          sx={{
            height: 200, // Increased height for better visual impact
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <CardMedia
            component="img"
            image={episode.images?.[0]?.url || '/images/default.jpg'}
            alt={`Cover art for ${episode.name}`}
            sx={{
              maxHeight: '100%',
              maxWidth: '100%',
              objectFit: 'contain',
              transition: 'transform 0.3s ease-in-out',
            }}
          />
          {/* Play overlay */}
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0,
              transition: 'opacity 0.3s ease-in-out',
              '.MuiCardActionArea-root:hover &': {
                opacity: 1,
              }
            }}
          >
            <PlayArrow 
              sx={{ 
                fontSize: 48, 
                color: 'white',
                filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))'
              }} 
            />
          </Box>
        </Box>

        <CardContent sx={{ flexGrow: 1, p: 3 }}>
          <Typography 
            variant="h6" 
            component="h3"
            gutterBottom
            sx={{
              fontWeight: 600,
              lineHeight: 1.3,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '3.2em', // Ensure consistent height
            }}
          >
            {episode.name}
          </Typography>

          <Typography 
            variant="body2" 
            color="text.secondary"
            sx={{
              mb: 2,
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: '4.2em', // Ensure consistent height
            }}
          >
            {truncateDescription(episode.description)}
          </Typography>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 'auto' }}>
            {/* Date and Duration */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <Chip
                label={formatDate(episode.release_date)}
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.75rem' }}
              />
              {episode.duration_ms && (
                <Chip
                  icon={<Schedule sx={{ fontSize: '0.875rem !important' }} />}
                  label={formatDuration(episode.duration_ms)}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.75rem' }}
                />
              )}
            </Box>
          </Box>
        </CardContent>
      </CardActionArea>

      {/* Separate button area to prevent double-click issues */}
      <Box sx={{ p: 2, pt: 0 }}>
        <Button
          variant="contained"
          color="primary"
          href={episode.external_urls?.spotify || '#'}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<PlayArrow />}
          fullWidth
          sx={{
            textTransform: 'none',
            fontWeight: 600,
            py: 1,
            '&:hover': {
              backgroundColor: 'primary.dark',
            }
          }}
          aria-label={`Listen to ${episode.name} on Spotify`}
        >
          Listen on Spotify
        </Button>
      </Box>
    </Card>
  );
}