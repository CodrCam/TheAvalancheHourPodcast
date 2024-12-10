import * as React from 'react';
import { useState } from 'react';
import { Container, Typography, Box, TextField, Button, Alert } from '@mui/material';
import Navbar from '../components/Navbar';

export default function Contact() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('sending');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setStatus('success');
        setFormData({ name: '', email: '', message: '' }); // Clear the form
      } else {
        setStatus('error');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setStatus('error');
    }
  };

  return (
    <React.Fragment>
      <Navbar />
      <Container maxWidth="sm">
        <Box sx={{ my: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Contact Us
          </Typography>
          <form noValidate autoComplete="off" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              label="Name"
              name="name"
              variant="outlined"
              margin="normal"
              required
              value={formData.name}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              label="Email"
              name="email"
              variant="outlined"
              margin="normal"
              required
              value={formData.email}
              onChange={handleChange}
            />
            <TextField
              fullWidth
              label="Message"
              name="message"
              variant="outlined"
              margin="normal"
              multiline
              rows={4}
              required
              value={formData.message}
              onChange={handleChange}
            />
            <Button type="submit" variant="contained" color="primary" sx={{ mt: 2 }}>
              Send Message
            </Button>
          </form>
          {status === 'sending' && <Alert severity="info" sx={{ mt: 2 }}>Sending...</Alert>}
          {status === 'success' && <Alert severity="success" sx={{ mt: 2 }}>Message sent successfully!</Alert>}
          {status === 'error' && <Alert severity="error" sx={{ mt: 2 }}>Failed to send message. Please try again.</Alert>}
        </Box>
      </Container>
    </React.Fragment>
  );
}