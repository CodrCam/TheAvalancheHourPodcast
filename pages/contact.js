// pages/contact.js
import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  TextField,
  Button,
  Alert,
  Paper,
  Grid,
  CircularProgress,
  Fade,
  Divider
} from '@mui/material';
import { Send, Email, Phone, LocationOn } from '@mui/icons-material';
import Navbar from '../components/Navbar';
import SEO from '../components/SEO';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear specific field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters long';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: ''
        });
        
        // Scroll to success message
        setTimeout(() => {
          document.getElementById('success-message')?.scrollIntoView({ 
            behavior: 'smooth' 
          });
        }, 100);
      } else {
        setError(data.message || data.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Contact form error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Contact Us - The Avalanche Hour Podcast"
        description="Get in touch with The Avalanche Hour Podcast team. Send us your questions, feedback, or story ideas about avalanche safety and snow science."
        keywords="contact avalanche podcast, avalanche hour contact, podcast feedback, snow science questions"
        url="/contact"
      />
      
      <Navbar />
      
      <Container maxWidth="md">
        <Box sx={{ mt: 4, mb: 6 }}>
          <Typography 
            variant="h1" 
            component="h1" 
            gutterBottom
            sx={{ 
              fontSize: { xs: '2.5rem', md: '3.5rem' },
              fontFamily: 'Amatic SC, cursive',
              textAlign: 'center',
              mb: 2
            }}
          >
            Contact Us
          </Typography>
          
          <Typography 
            variant="h6" 
            component="p" 
            color="text.secondary" 
            align="center"
            sx={{ mb: 4, maxWidth: '600px', mx: 'auto' }}
          >
            Have a question, story idea, or feedback? We'd love to hear from you!
          </Typography>

          {/* Success Message */}
          {success && (
            <Fade in={success}>
              <Alert 
                severity="success" 
                sx={{ mb: 4 }}
                id="success-message"
              >
                <Typography variant="h6" gutterBottom>
                  Message sent successfully! 🎉
                </Typography>
                <Typography>
                  Thank you for reaching out. We'll get back to you within 24-48 hours.
                </Typography>
              </Alert>
            </Fade>
          )}

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mb: 4 }} onClose={() => setError('')}>
              <Typography variant="subtitle1" gutterBottom>
                Unable to send message
              </Typography>
              <Typography variant="body2">
                {error}
              </Typography>
            </Alert>
          )}

          <Grid container spacing={4}>
            {/* Contact Form */}
            <Grid item xs={12} md={8}>
              <Paper elevation={2} sx={{ p: 4 }}>
                <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
                  Send us a message
                </Typography>
                
                <Box component="form" onSubmit={handleSubmit} noValidate>
                  <Grid container spacing={3}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        required
                        fullWidth
                        id="name"
                        name="name"
                        label="Your Name"
                        value={formData.name}
                        onChange={handleChange}
                        error={!!errors.name}
                        helperText={errors.name}
                        disabled={loading}
                        autoComplete="name"
                      />
                    </Grid>
                    
                    <Grid item xs={12} sm={6}>
                      <TextField
                        required
                        fullWidth
                        id="email"
                        name="email"
                        label="Your Email"
                        type="email"
                        value={formData.email}
                        onChange={handleChange}
                        error={!!errors.email}
                        helperText={errors.email}
                        disabled={loading}
                        autoComplete="email"
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        id="subject"
                        name="subject"
                        label="Subject (Optional)"
                        value={formData.subject}
                        onChange={handleChange}
                        disabled={loading}
                        placeholder="Brief description of your message"
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <TextField
                        required
                        fullWidth
                        id="message"
                        name="message"
                        label="Your Message"
                        multiline
                        rows={6}
                        value={formData.message}
                        onChange={handleChange}
                        error={!!errors.message}
                        helperText={errors.message || `${formData.message.length}/1000 characters`}
                        disabled={loading}
                        inputProps={{ maxLength: 1000 }}
                        placeholder="Tell us what's on your mind..."
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                      <Button
                        type="submit"
                        variant="contained"
                        size="large"
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} /> : <Send />}
                        sx={{ 
                          minWidth: 150,
                          py: 1.5,
                          px: 4
                        }}
                      >
                        {loading ? 'Sending...' : 'Send Message'}
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </Paper>
            </Grid>

            {/* Contact Information */}
            <Grid item xs={12} md={4}>
              <Paper elevation={1} sx={{ p: 3, backgroundColor: 'grey.50' }}>
                <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 600 }}>
                  Other ways to reach us
                </Typography>
                
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Email sx={{ mr: 2, color: 'primary.main' }} />
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Email us directly
                      </Typography>
                      <Typography variant="body1">
                        <a 
                          href="mailto:theavalanchehourpodcast@gmail.com"
                          style={{ 
                            color: 'inherit', 
                            textDecoration: 'none',
                            borderBottom: '1px solid currentColor'
                          }}
                        >
                          theavalanchehourpodcast@gmail.com
                        </a>
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 600, mt: 3 }}>
                  Response Times
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  📧 <strong>Email:</strong> 24-48 hours
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  📝 <strong>General inquiries:</strong> 1-3 business days
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  🎙️ <strong>Guest applications:</strong> 1-2 weeks
                </Typography>

                <Divider sx={{ my: 2 }} />

                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  Want to be a guest on our show? 
                  <br />
                  <a 
                    href="/be-a-guest" 
                    style={{ 
                      color: 'primary.main', 
                      textDecoration: 'none',
                      borderBottom: '1px solid currentColor'
                    }}
                  >
                    Use our guest application form →
                  </a>
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </>
  );
}