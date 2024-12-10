import * as React from 'react';
import { Container, Typography, Box, TextField, Button } from '@mui/material';
import Navbar from '../components/Navbar';

export default function BeAGuest() {
  return (
    <React.Fragment>
      <Navbar />
      <Container maxWidth="sm">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Be a Guest on Our Show
          </Typography>
          <form noValidate autoComplete="off">
            <TextField
              fullWidth
              label="Name"
              variant="outlined"
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Email"
              variant="outlined"
              margin="normal"
              required
            />
            <TextField
              fullWidth
              label="Tell us about yourself"
              variant="outlined"
              margin="normal"
              multiline
              rows={4}
              required
            />
            <Button variant="contained" color="primary" sx={{ mt: 2 }}>
              Submit
            </Button>
          </form>
        </Box>
      </Container>
    </React.Fragment>
  );
}
