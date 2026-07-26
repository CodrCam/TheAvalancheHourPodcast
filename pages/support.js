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
  LocalOffer,
  WorkspacePremium,
} from '@mui/icons-material';
import Navbar from '../components/Navbar';
import PublicPageHero from '../components/PublicPageHero';
import SEO from '../components/SEO';
import {
  getStaticSponsorSeed,
  listSponsors,
} from '../lib/sponsorStore';
import publicStyles from '../styles/PublicSite.module.css';

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

const sponsorTierLabels = {
  legacy: 'Legacy Sponsor',
  partner: 'Season Partner',
  friend: 'Episode Supporter',
  episode: 'Episode Sponsor',
};

function SponsorSupportCard({ sponsor }) {
  const hasOffer = Boolean(sponsor.promo_code || sponsor.promo_details);

  return (
    <Card
      component="article"
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 0,
        borderColor: hasOffer ? 'primary.main' : 'grey.200',
        boxShadow: hasOffer ? '0 16px 38px rgba(16, 34, 45, 0.10)' : 'none',
      }}
    >
      <CardContent
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          p: { xs: 2.25, md: 2.5 },
          '&:last-child': { pb: { xs: 2.25, md: 2.5 } },
        }}
      >
        <Box
          sx={{
            height: 104,
            minHeight: 104,
            maxHeight: 104,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
            mb: 2,
            p: 1.5,
            borderRadius: 1.5,
            bgcolor: '#f7f8fa',
          }}
        >
          {sponsor.logo ? (
            <Box
              component="img"
              src={sponsor.logo}
              alt={`${sponsor.name} logo`}
              style={{
                width: 'auto',
                height: 'auto',
                maxWidth: '100%',
                maxHeight: '100%',
                display: 'block',
                objectFit: 'contain',
                objectPosition: 'center',
              }}
            />
          ) : (
            <Typography
              variant="h6"
              component="span"
              sx={{ color: 'text.secondary', textAlign: 'center' }}
            >
              {sponsor.name}
            </Typography>
          )}
        </Box>

        <Chip
          label={sponsorTierLabels[sponsor.tier] || 'Sponsor'}
          size="small"
          variant="outlined"
          sx={{ alignSelf: 'flex-start', mb: 1.25, fontWeight: 700 }}
        />
        <Typography variant="h6" component="h3" sx={{ lineHeight: 1.25 }}>
          {sponsor.name}
        </Typography>

        {hasOffer ? (
          <Box
            sx={{
              mt: 2,
              p: 1.5,
              border: '1px solid',
              borderColor: 'success.light',
              borderRadius: 1.5,
              bgcolor: '#f4faf6',
            }}
          >
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.5 }}>
              <LocalOffer color="success" sx={{ fontSize: 18 }} />
              <Typography
                variant="overline"
                component="span"
                sx={{ color: 'success.dark', fontWeight: 800, lineHeight: 1.4 }}
              >
                Listener offer
              </Typography>
            </Stack>
            {sponsor.promo_details ? (
              <Typography variant="body2" sx={{ color: 'text.primary' }}>
                {sponsor.promo_details}
              </Typography>
            ) : null}
            {sponsor.promo_code ? (
              <Box
                component="code"
                sx={{
                  width: 'fit-content',
                  display: 'block',
                  mt: sponsor.promo_details ? 1 : 0,
                  px: 1,
                  py: 0.6,
                  border: '1px dashed',
                  borderColor: 'success.main',
                  borderRadius: 1,
                  color: 'success.dark',
                  bgcolor: 'white',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  overflowWrap: 'anywhere',
                }}
              >
                Use code {sponsor.promo_code}
              </Box>
            ) : null}
          </Box>
        ) : null}

        {sponsor.url ? (
          <Box sx={{ mt: 'auto', pt: 2 }}>
            <Button
              component="a"
              href={sponsor.url}
              target="_blank"
              rel="noopener noreferrer"
              variant={hasOffer ? 'contained' : 'outlined'}
              endIcon={<ArrowForward />}
              fullWidth
            >
              Visit Sponsor
            </Button>
          </Box>
        ) : (
          <Box sx={{ mt: 'auto' }} />
        )}
      </CardContent>
    </Card>
  );
}

export default function SupportPage({ sponsors = [] }) {
  return (
    <>
      <SEO
        title="Support & Advertise | The Avalanche Hour"
        description="Support The Avalanche Hour Podcast, explore advertising and underwriting opportunities, and find current sponsor offers for listeners."
        keywords="The Avalanche Hour sponsorship, podcast advertising, avalanche podcast support, podcast underwriting"
        url="/support"
      />

      <Navbar />

      <Box component="main" className={publicStyles.publicPage}>
        <PublicPageHero
          eyebrow="Independent voices · community supported"
          title="Keep the signal strong."
          description="Help the podcast grow through single-episode ads, season-long support, underwriting, or a direct contribution to the conversations."
        >
          <Stack spacing={1.25}>
            <Button
              component="a"
              href={rateCardUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="contained"
              startIcon={<Download />}
            >
              View Rate Card
            </Button>
            <Button
              component={Link}
              href="/contact"
              variant="outlined"
              sx={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,.52)',
              }}
            >
              Ask About Custom Support
            </Button>
          </Stack>
        </PublicPageHero>

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
                      borderRadius: 0,
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

        <Box
          component="section"
          sx={{ bgcolor: '#f2f5f3', py: { xs: 5, md: 8 } }}
        >
          <Container maxWidth="lg">
            <Box sx={{ mb: 4 }}>
              <Typography variant="h2" sx={{ mb: 1 }}>
                Support the Sponsors Who Support the Show
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: 760 }}
              >
                Explore every current Avalanche Hour sponsor. When a listener
                offer is available, the details and show-specific code appear
                right on the sponsor card.
              </Typography>
            </Box>

            {sponsors.length ? (
              <Grid container spacing={2.5}>
                {sponsors.map((sponsor) => (
                  <Grid item xs={12} sm={6} md={4} key={sponsor.sponsor_id}>
                    <SponsorSupportCard sponsor={sponsor} />
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Card variant="outlined" sx={{ borderRadius: 0 }}>
                <CardContent>
                  <Typography color="text.secondary">
                    The current sponsor list is being updated. Please check back
                    soon.
                  </Typography>
                </CardContent>
              </Card>
            )}
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

export async function getServerSideProps() {
  try {
    const result = await listSponsors({ allowStaticFallback: true });
    return {
      props: {
        sponsors: result.sponsors.filter((sponsor) => sponsor.active),
      },
    };
  } catch (error) {
    console.error('support sponsors error:', error);
    return {
      props: {
        sponsors: getStaticSponsorSeed().filter((sponsor) => sponsor.active),
      },
    };
  }
}
