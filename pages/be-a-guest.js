// pages/be-a-guest.js - Simplified version
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
import { Send, Mic, Person, Work, Schedule } from '@mui/icons-material';
import Navbar from '../components/Navbar';
import PublicPageHero from '../components/PublicPageHero';
import PublicFormHumanCheck from '../components/PublicFormHumanCheck';
import SEO from '../components/SEO';
import publicStyles from '../styles/PublicSite.module.css';

export default function BeAGuest() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    background: '',
    topics: '',
    contact: '',
    website: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [turnstileToken, setTurnstileToken] = useState('');
  const [humanCheckResetKey, setHumanCheckResetKey] = useState(0);

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
    
    if (!formData.background.trim()) {
      newErrors.background = 'Please tell us a bit about yourself';
    } else if (formData.background.trim().length < 20) {
      newErrors.background = 'Please include a few words about your experience';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    
    if (!validateForm()) {
      // Scroll to first error
      const firstErrorField = Object.keys(errors)[0];
      if (firstErrorField) {
        document.getElementById(firstErrorField)?.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center'
        });
      }
      return;
    }

    if (!turnstileToken) {
      setError('Please complete the security check before submitting.');
      return;
    }
    
    setLoading(true);
    setError('');
    setSuccess(false);
    
    try {
      const response = await fetch('/api/guest-application', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ...formData, turnstileToken }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSuccess(true);
        setFormData({
          name: '',
          email: '',
          background: '',
          topics: '',
          contact: '',
          website: ''
        });
        
        // Scroll to success message
        setTimeout(() => {
          document.getElementById('success-message')?.scrollIntoView({ 
            behavior: 'smooth' 
          });
        }, 100);
      } else {
        setError(data.message || data.error || 'Failed to submit application');
      }
    } catch (error) {
      console.error('Guest application error:', error);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setTurnstileToken('');
      setHumanCheckResetKey((current) => current + 1);
      setLoading(false);
    }
  };

  return (
    <>
      <SEO
        title="Be a Guest - The Avalanche Hour Podcast"
        description="Apply to be a guest on The Avalanche Hour Podcast. Share your expertise in avalanche safety, snow science, or backcountry recreation with our community."
        keywords="avalanche podcast guest, snow science expert, podcast interview, avalanche professional, backcountry expert"
        url="/be-a-guest"
      />
      
      <Navbar />
      <Box component="main" className={publicStyles.publicPage}>
        <PublicPageHero
          eyebrow="Bring your experience to the conversation"
          title="Tell us what the mountain taught you."
          description="Have a story worth sharing? The application takes about two minutes. The conversation is relaxed, remote, and built around what you know."
        />

        <Container maxWidth="md" className={publicStyles.content}>
          <Box>

          {/* Success Message */}
          {success && (
            <Fade in={success}>
              <Alert 
                severity="success" 
                sx={{ mb: 4 }}
                id="success-message"
              >
                <Typography variant="h6" gutterBottom>
                  Application submitted! 🎙️
                </Typography>
                <Typography>
                  Thanks for your interest. Your application was sent privately
                  to our team for review; we will contact you if there is a fit
                  for an available episode.
                </Typography>
              </Alert>
            </Fade>
          )}

          {/* Error Message */}
          {error && (
            <Alert severity="error" sx={{ mb: 4 }} onClose={() => setError('')}>
              <Typography variant="subtitle1" gutterBottom>
                Unable to submit application
              </Typography>
              <Typography variant="body2">
                {error}
              </Typography>
            </Alert>
          )}

          {/* What to Expect */}
          <Paper elevation={1} sx={{ p: 3, mb: 4, backgroundColor: 'primary.50' }}>
            <Typography variant="h6" component="h2" gutterBottom sx={{ fontWeight: 600, textAlign: 'center' }}>
              What to expect as a guest
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Person sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="subtitle2" gutterBottom>Friendly Chat</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Casual conversation about your experiences
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Schedule sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="subtitle2" gutterBottom>60-90 Minutes</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Remote recording from your location
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={4}>
                <Box sx={{ textAlign: 'center' }}>
                  <Mic sx={{ fontSize: 40, color: 'primary.main', mb: 1 }} />
                  <Typography variant="subtitle2" gutterBottom>Share Your Story</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Help others learn from your expertise
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>

          {/* Simple Application Form */}
          <Paper elevation={2} sx={{ p: 4 }}>
            <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 600, mb: 3 }}>
              Guest Application
            </Typography>
            
            <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
              Just tell us a bit about yourself and what you'd like to talk about. We'll handle the rest!
            </Typography>
            
            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Box
                aria-hidden="true"
                sx={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}
              >
                <label htmlFor="guest-website">Website</label>
                <input
                  id="guest-website"
                  name="website"
                  value={formData.website}
                  onChange={handleChange}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </Box>
              <Grid container spacing={3}>
                
                {/* Basic Info */}
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
                    inputProps={{ maxLength: 120 }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    required
                    fullWidth
                    id="email"
                    name="email"
                    label="Email Address"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    error={!!errors.email}
                    helperText={errors.email}
                    disabled={loading}
                    autoComplete="email"
                    inputProps={{ maxLength: 254 }}
                  />
                </Grid>
                
                {/* Background */}
                <Grid item xs={12}>
                  <TextField
                    required
                    fullWidth
                    id="background"
                    name="background"
                    label="Tell us about yourself"
                    multiline
                    rows={4}
                    value={formData.background}
                    onChange={handleChange}
                    error={!!errors.background}
                    helperText={errors.background || "What's your role? What do you do in the avalanche/snow world? Any cool experiences?"}
                    disabled={loading}
                    inputProps={{ maxLength: 4000 }}
                    placeholder="e.g., I'm a ski patroller at Whistler, been doing avalanche work for 10 years, love backcountry skiing..."
                  />
                </Grid>
                
                {/* Topics */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    id="topics"
                    name="topics"
                    label="What would you like to talk about? (Optional)"
                    multiline
                    rows={3}
                    value={formData.topics}
                    onChange={handleChange}
                    disabled={loading}
                    inputProps={{ maxLength: 4000 }}
                    placeholder="Any specific stories, experiences, or topics you'd be excited to discuss? Recent projects, lessons learned, funny stories, etc."
                    helperText="Don't worry if you're not sure - we'll brainstorm together!"
                  />
                </Grid>
                
                {/* Contact Preference */}
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    id="contact"
                    name="contact"
                    label="Best way to reach you & availability (Optional)"
                    multiline
                    rows={2}
                    value={formData.contact}
                    onChange={handleChange}
                    disabled={loading}
                    inputProps={{ maxLength: 1000 }}
                    placeholder="Phone number, best days/times, time zone, etc."
                    helperText="Helps us coordinate scheduling"
                  />
                </Grid>

                <Grid item xs={12}>
                  <PublicFormHumanCheck
                    action="guest_application"
                    onToken={setTurnstileToken}
                    resetKey={humanCheckResetKey}
                  />
                </Grid>

              </Grid>
              
              <Divider sx={{ my: 4 }} />

              {/* Submit */}
              <Box sx={{ textAlign: 'center' }}>
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={loading || !turnstileToken}
                  startIcon={loading ? <CircularProgress size={20} /> : <Send />}
                  sx={{ 
                    minWidth: 200,
                    py: 1.5,
                    px: 4,
                    fontSize: '1.1rem'
                  }}
                >
                  {loading ? 'Submitting...' : 'Submit Application'}
                </Button>
                
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  We'll get back to you within 1-2 weeks
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1, fontStyle: 'italic' }}>
                  Questions? Email us at{' '}
                  <a href="mailto:theavalanchehourpodcast@gmail.com" style={{ color: 'inherit' }}>
                    theavalanchehourpodcast@gmail.com
                  </a>
                </Typography>
              </Box>
            </Box>
          </Paper>
          </Box>
        </Container>
      </Box>
    </>
  );
}
