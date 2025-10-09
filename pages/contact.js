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
  Divider,
  FormControlLabel,
  Checkbox,
  Chip
} from '@mui/material';
import { 
  Send, 
  Email, 
  Phone, 
  LocationOn, 
  Business,
  AttachMoney,
  Info
} from '@mui/icons-material';
import Navbar from '../components/Navbar';
import SurveyBanner from '../components/SurveyBanner';
import SEO from '../components/SEO';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    isSponsorship: false,
    companyName: '',
    sponsorshipBudget: '',
    sponsorshipGoals: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [wasSponsorship, setWasSponsorship] = useState(false);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
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
    
    // Sponsorship specific validation
    if (formData.isSponsorship) {
      if (!formData.companyName.trim()) {
        newErrors.companyName = 'Company name is required for sponsorship inquiries';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!validateForm()) return;

        setLoading(true);
        setError('');
        setSuccess(false);

        try {
          const response = await fetch('/api/contact', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData),
          });

          const data = await response.json();

          if (response.ok) {
            setWasSponsorship(formData.isSponsorship);
            setSuccess(true);

            // reset form
            setFormData({
              name: '',
              email: '',
              subject: '',
              message: '',
              isSponsorship: false,
              companyName: '',
              sponsorshipBudget: '',
              sponsorshipGoals: ''
            });

            // Scroll to success message (async to allow render)
            setTimeout(() => {
              document.getElementById('success-message')
                ?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          } else {
            setError(data.message || data.error || 'Failed to send message');
          }
        } catch (err) {
          console.error('Contact form error:', err);
          setError('Network error. Please check your connection and try again.');
        } finally {
          setLoading(false);
        }
    };

  return (
    <>
      <SEO
        title="Contact Us & Sponsorship - The Avalanche Hour Podcast"
        description="Get in touch with The Avalanche Hour Podcast team. Send us your questions, feedback, story ideas, or explore sponsorship opportunities."
        keywords="contact avalanche podcast, sponsorship opportunities, podcast advertising, snow science questions"
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
            Have a question, story idea, feedback, or interested in sponsorship? We'd love to hear from you.
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
                  {wasSponsorship 
                    ? "Thank you for your sponsorship inquiry. We'll send you our media kit and get back to you within 2-3 business days."
                    : "Thank you for reaching out. We'll get back to you within 24-48 hours."
                  }
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
                    {/* Sponsorship Checkbox */}
                    <Grid item xs={12}>
                      <Paper 
                        elevation={0} 
                        sx={{ 
                          p: 2, 
                          backgroundColor: formData.isSponsorship ? 'primary.50' : 'grey.50',
                          border: formData.isSponsorship ? '2px solid' : '1px solid',
                          borderColor: formData.isSponsorship ? 'primary.main' : 'grey.300',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={formData.isSponsorship}
                              onChange={handleChange}
                              name="isSponsorship"
                              color="primary"
                            />
                          }
                          label={
                            <Box>
                              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                <AttachMoney sx={{ fontSize: 16, verticalAlign: 'middle', mr: 0.5 }} />
                                I'm interested in sponsorship opportunities
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                Request our media kit with audience demographics and sponsorship packages
                              </Typography>
                            </Box>
                          }
                        />
                      </Paper>
                    </Grid>

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

                    {/* Sponsorship-specific fields */}
                    {formData.isSponsorship && (
                      <>
                        <Grid item xs={12} sm={6}>
                          <TextField
                            required
                            fullWidth
                            id="companyName"
                            name="companyName"
                            label="Company/Organization Name"
                            value={formData.companyName}
                            onChange={handleChange}
                            error={!!errors.companyName}
                            helperText={errors.companyName}
                            disabled={loading}
                            autoComplete="organization"
                          />
                        </Grid>

                        <Grid item xs={12} sm={6}>
                          <TextField
                            fullWidth
                            id="sponsorshipBudget"
                            name="sponsorshipBudget"
                            label="Estimated Budget Range (Optional)"
                            value={formData.sponsorshipBudget}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="e.g., $1,000-$5,000"
                          />
                        </Grid>

                        <Grid item xs={12}>
                          <TextField
                            fullWidth
                            id="sponsorshipGoals"
                            name="sponsorshipGoals"
                            label="Marketing Goals & Target Audience (Optional)"
                            multiline
                            rows={3}
                            value={formData.sponsorshipGoals}
                            onChange={handleChange}
                            disabled={loading}
                            placeholder="Tell us about your marketing objectives and target audience..."
                          />
                        </Grid>
                      </>
                    )}
                    
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        id="subject"
                        name="subject"
                        label="Subject (Optional)"
                        value={formData.subject}
                        onChange={handleChange}
                        disabled={loading}
                        placeholder={formData.isSponsorship ? "Sponsorship Inquiry" : "Brief description of your message"}
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
                        placeholder={formData.isSponsorship 
                          ? "Tell us about your company and what type of sponsorship you're interested in..."
                          : "Tell us what's on your mind..."
                        }
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
                        {loading ? 'Sending...' : formData.isSponsorship ? 'Request Media Kit' : 'Send Message'}
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </Paper>
            </Grid>

            {/* Contact Information */}
            <Grid item xs={12} md={4}>
              {/* Sponsorship Information Box */}
              <Paper elevation={1} sx={{ p: 3, mb: 3, backgroundColor: 'primary.50' }}>
                <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 600 }}>
                  <Business sx={{ verticalAlign: 'middle', mr: 1 }} />
                  Sponsorship Opportunities
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Reach our engaged audience of avalanche professionals and backcountry enthusiasts
                </Typography>
                
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, mt: 2 }}>
                  What you'll receive:
                </Typography>
                <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Detailed media kit with audience demographics
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Download statistics and listener analytics
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Sponsorship package options
                  </Typography>
                  <Typography component="li" variant="body2" color="text.secondary">
                    Custom advertising solutions
                  </Typography>
                </Box>
              </Paper>

              {/* Listener Survey Box */}
              <Paper elevation={1} sx={{ p: 3, mb: 3, backgroundColor: 'secondary.50' }}>
                <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 600 }}>
                  📋 Take Our Listener Survey
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  We value your feedback! Help us improve the podcast by sharing your thoughts.
                </Typography>
                
                <Button
                  variant="contained"
                  href="https://docs.google.com/forms/d/e/1FAIpQLSfnbrZtDSgrBZR9YRPwyrYr_GlqSo7vyNVWLaLdNzw1-lrpzA/viewform"
                  target="_blank"
                  rel="noopener noreferrer"
                  fullWidth
                  sx={{
                    backgroundColor: '#7B7B7B',
                    color: '#fff',
                    textTransform: 'none',
                    '&:hover': { backgroundColor: '#5B5B5B' },
                  }}
                >
                  Take the Survey
                </Button>
              </Paper>

                            {/* VoicemailBag Hotline */}
              <Paper elevation={1} sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 600 }}>
                  VoicemailBag Hotline
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Leave your stories, comments, news, and questions. Selected messages may air on
                  <em> Slabs and Sluffs with Dom and Sara</em>.
                </Typography>
                <Button component="a" href="tel:15414060221" variant="contained">
                  Call 541-406-0221
                </Button>
              </Paper>

              {/* Other Information Box */}
              <Paper elevation={1} sx={{ p: 3, backgroundColor: 'grey.50' }}>
                <Typography variant="h6" component="h3" gutterBottom sx={{ fontWeight: 600 }}>
                  Response Times
                </Typography>
                
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  📧 <strong>General inquiries:</strong> 24-48 hours
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  💼 <strong>Sponsorship inquiries:</strong> 2-3 business days
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