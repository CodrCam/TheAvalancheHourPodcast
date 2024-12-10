import * as React from 'react';
import { Container, Typography, Box, TextField, Button } from '@mui/material';
import Navbar from '../components/Navbar';

export default function Contact() {
  return (
    <React.Fragment>
      <Navbar />
      <Container maxWidth="sm">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Contact Us
          </Typography>
          <Typography variant="body1" sx={{ mb: 4 }}>
            Please email us directly at <a href="mailto:theavalanchehourpodcast@gmail.com">theavalanchehourpodcast@gmail.com</a>.
          </Typography>
        </Box>
      </Container>
    </React.Fragment>
  );
}