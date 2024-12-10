import React from 'react';
import { Box, Typography, Button } from '@mui/material';

export default function SurveyBanner() {
  return (
    <Box
      sx={{
        backgroundColor: '#00BCFE', 
        color: '#000',
        py: 2,
        px: 2,
        textAlign: 'center',
        boxShadow: 1,
        position: 'relative',
        zIndex: 1,
      }}
    >
      <Typography variant="h6" component="p" sx={{ mb: 1, fontWeight: 'bold' }}>
        We value your feedback! Take our Listener Survey.
      </Typography>
      <Button
        variant="contained"
        href="https://docs.google.com/forms/d/e/1FAIpQLSfnbrZtDSgrBZR9YRPwyrYr_GlqSo7vyNVWLaLdNzw1-lrpzA/viewform"
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          backgroundColor: '#7B7B7B',
          color: '#fff',
          textTransform: 'none',
          '&:hover': { backgroundColor: '#1565c0' },
        }}
      >
        Take the Survey
      </Button>
    </Box>
  );
}