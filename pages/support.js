import React from 'react';
import Link from 'next/link';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import {
  ArrowForward,
  Campaign,
  Download,
  Handshake,
  LibraryMusic,
  WorkspacePremium,
} from '@mui/icons-material';
import Navbar from '../components/Navbar';
import SEO from '../components/SEO';

const rateCardUrl = '/files/avalanche-hour-s11-rate-card.pdf';

const supportTiers = [
  {
    name: 'Friend Level',
    subtitle: 'Single Episode Support',
    price: '$500 / episode',
    checkoutUrl: 'https://buy.stripe.com/14A6oH6ifbYlbdj6VvgrS01',
    icon: <Campaign />,
    highlights: [
      '1-2 minutes of mid-episode advertising or messaging',
      'Support acknowledgement in the episode intro or outro',
      'Social media post and logo placement on the website',
    ],
  },
  {
    name: 'Partner Level',
    subtitle: 'Season-Long Support',
    price: '$4000 / season',
    checkoutUrl: 'https://buy.stripe.com/6oUfZh5eb1jH6X3cfPgrS02',
    icon: <Handshake />,
    highlights: [
      '10-15 minutes per season for a representative to talk to the audience',
      'Support acknowledgement in the intro or outro of 25+ episodes',
      'Social media post and logo placement on the website',
    ],
  },
  {
    name: 'Legacy Level',
    subtitle: 'Season-long support that helps grow the podcast',
    price: '$6000+ / season',
    checkoutUrl: 'https://buy.stripe.com/aFa14ngWT7I5gxD2FfgrS03',
    icon: <WorkspacePremium />,
    featured: true,
    highlights: [
      'The Avalanche Hour Podcast proudly presented by your company',
      '10-15 minute slots per season for a representative to talk to the audience',
      'Selection of a guest or topic for a podcast episode',
      'Social media posts and logo placement on the website',
    ],
  },
  {
    name: "Slabs 'n Sluffs",
    subtitle: 'Season-long support of the pod spinoff and recap show',
    price: '$5000 / season',
    checkoutUrl: 'https://buy.stripe.com/6oUfZhbCz3rP817enXgrS00',
    icon: <LibraryMusic />,
    highlights: [
      "Slabs and Sluffs proudly presented by your company",
      "Company logo on the cover art for Slabs 'n Sluffs",
      'Selection of a guest or topic for a podcast episode',
      'Social media posts and logo placement on the website',
    ],
  },
];

export default function SupportPage() {
  return (
    <>
      <SEO
        title="Support & Advertise | The Avalanche Hour"
        description="Support The Avalanche Hour Podcast through single episode advertising, season-long sponsorship, underwriting, and Slabs 'n Sluffs sponsorship opportunities."
        keywords="The Avalanche Hour sponsorship, podcast advertising, avalanche podcast support, podcast underwriting"
        url="/support"
      />

      <Navbar />

      <Box component="main">
        <Box
          component="section"
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            py: { xs: 6, md: 9 },
          }}
        >
          <Container maxWidth="lg">
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={8}>
                <Typography
                  variant="h1"
                  sx={{
                    fontSize: { xs: '2.75rem', md: '4rem' },
                    mb: 2,
                    color: 'inherit',
                  }}
                >
                  Support The Avalanche Hour
                </Typography>
                <Typography
                  variant="h6"
                  component="p"
                  sx={{
                    maxWidth: 760,
                    color: 'rgba(255,255,255,0.9)',
                    fontWeight: 400,
                  }}
                >
                  Help keep the podcast growing through single-episode ads,
                  season-long support, or underwriting opportunities built for
                  brands, educators, guide services, ski patrols, and avalanche
                  community supporters.
                </Typography>
              </Grid>

              <Grid item xs={12} md={4}>
                <Stack spacing={1.5} alignItems={{ xs: 'stretch', sm: 'flex-start', md: 'stretch' }}>
                  <Button
                    component="a"
                    href={rateCardUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="contained"
                    color="secondary"
                    startIcon={<Download />}
                    sx={{ justifyContent: 'center' }}
                  >
                    View Rate Card
                  </Button>
                  <Button
                    component={Link}
                    href="/contact"
                    variant="outlined"
                    sx={{
                      color: 'primary.contrastText',
                      borderColor: 'rgba(255,255,255,0.75)',
                      justifyContent: 'center',
                      '&:hover': {
                        borderColor: 'primary.contrastText',
                        bgcolor: 'rgba(255,255,255,0.08)',
                      },
                    }}
                  >
                    Ask About Custom Support
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Container>
        </Box>

        <Box component="section" sx={{ bgcolor: 'background.default', py: { xs: 5, md: 8 } }}>
          <Container maxWidth="lg">
            <Box sx={{ mb: 4 }}>
              <Typography variant="h2" sx={{ mb: 1 }}>
                Advertising and Underwriting Options
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
                Choose the level that matches your message. Each checkout button opens a
                secure Stripe payment link in a new tab.
              </Typography>
            </Box>

            <Grid container spacing={3}>
              {supportTiers.map((tier) => (
                <Grid item xs={12} md={6} key={tier.name}>
                  <Card
                    sx={{
                      height: '100%',
                      borderRadius: 2,
                      border: '1px solid',
                      borderColor: tier.featured ? 'primary.main' : 'grey.200',
                      boxShadow: tier.featured ? 4 : 1,
                    }}
                  >
                    <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                        <Box
                          sx={{
                            width: 44,
                            height: 44,
                            borderRadius: '50%',
                            display: 'grid',
                            placeItems: 'center',
                            bgcolor: tier.featured ? 'primary.main' : 'primary.light',
                            color: 'primary.contrastText',
                            flexShrink: 0,
                          }}
                        >
                          {tier.icon}
                        </Box>
                        <Box sx={{ minWidth: 0 }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography variant="h5" component="h2">
                              {tier.name}
                            </Typography>
                            {tier.featured && <Chip label="Premier" size="small" color="primary" />}
                          </Stack>
                          <Typography variant="body2" color="text.secondary">
                            {tier.subtitle}
                          </Typography>
                        </Box>
                      </Stack>

                      <Typography
                        variant="h4"
                        component="p"
                        sx={{ fontFamily: 'inherit', fontWeight: 800, mb: 2 }}
                      >
                        {tier.price}
                      </Typography>

                      <Divider sx={{ mb: 2 }} />

                      <Stack component="ul" spacing={1.25} sx={{ pl: 2.5, mt: 0, mb: 3 }}>
                        {tier.highlights.map((highlight) => (
                          <Typography component="li" variant="body2" key={highlight}>
                            {highlight}
                          </Typography>
                        ))}
                      </Stack>

                      <Box sx={{ mt: 'auto' }}>
                        <Button
                          component="a"
                          href={tier.checkoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          variant="contained"
                          fullWidth
                          endIcon={<ArrowForward />}
                        >
                          Buy Now
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Container>
        </Box>

        <Box component="section" sx={{ bgcolor: 'white', py: { xs: 5, md: 7 } }}>
          <Container maxWidth="md">
            <Stack
              spacing={2}
              alignItems="center"
              sx={{ textAlign: 'center' }}
            >
              <Typography variant="h2">Need Something Different?</Typography>
              <Typography variant="body1" color="text.secondary">
                If these options are not quite right, reach out and the team can
                collaborate on a support package that fits your goals.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button component={Link} href="/contact" variant="contained">
                  Contact the Team
                </Button>
                <Button
                  component="a"
                  href={rateCardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="outlined"
                  startIcon={<Download />}
                >
                  Download PDF
                </Button>
              </Stack>
            </Stack>
          </Container>
        </Box>
      </Box>
    </>
  );
}
