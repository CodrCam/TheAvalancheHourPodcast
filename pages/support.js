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
  Handshake,
  LibraryMusic,
  LocalOffer,
  OpenInNew,
  PictureAsPdf,
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

const season11SponsorshipDeckUrl = '/files/avalanche-hour-s11-sponsorship-deck.pdf';
const sponsorshipGuideUrl = '/files/avalanche-hour-s11-sponsorship-guide.pdf';

const supportTiers = [
  {
    name: 'Friend',
    subtitle: 'Single-episode support',
    price: '$500 / episode',
    checkoutUrl: 'https://buy.stripe.com/14A6oH6ifbYlbdj6VvgrS01',
    ctaLabel: 'Sponsor an Episode',
    icon: <Campaign />,
    highlights: [
      '1–2 minutes of mid-episode advertising or messaging',
      'Support acknowledgment in the episode intro or outro',
      'Social media post and logo placement on the website',
    ],
  },
  {
    name: 'Partner',
    subtitle: 'Season-long support',
    price: '$4,000 / season',
    checkoutUrl: 'https://buy.stripe.com/6oUfZh5eb1jH6X3cfPgrS02',
    ctaLabel: 'Become a Season Partner',
    icon: <Handshake />,
    highlights: [
      '10–15 minutes per season for a representative to talk to the audience',
      'Support acknowledgment in the intro or outro of 25+ episodes',
      'Social media post and logo placement on the website',
    ],
  },
  {
    name: 'Legacy',
    subtitle: 'Deeper, ongoing alignment',
    price: '$6,000 / season',
    checkoutUrl: 'https://buy.stripe.com/aFa14ngWT7I5gxD2FfgrS03',
    ctaLabel: 'Choose Legacy Support',
    icon: <WorkspacePremium />,
    featured: true,
    highlights: [
      'Season-long support designed to help grow the podcast',
      'A deeper, ongoing relationship with The Avalanche Hour',
    ],
  },
  {
    name: 'Slabs ’n Sluffs',
    subtitle: 'Dedicated support for the recap show',
    price: '$5,000+ / season',
    checkoutUrl: 'https://buy.stripe.com/6oUfZhbCz3rP817enXgrS00',
    ctaLabel: 'Support Slabs ’n Sluffs',
    icon: <LibraryMusic />,
    highlights: [
      'Extended access for a company representative',
      'Guest or topic proposals, subject to editorial approval',
      'Custom collaboration options',
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
        title="Support the Show | The Avalanche Hour"
        description="Fund independent avalanche storytelling, sponsor an episode or season, explore year-round partnerships, and review The Avalanche Hour sponsorship guide."
        keywords="The Avalanche Hour sponsorship, podcast advertising, avalanche podcast support, podcast underwriting"
        url="/support"
      />

      <Navbar />

      <Box component="main" className={publicStyles.publicPage}>
        <PublicPageHero
          eyebrow="Independent voices · community supported"
          title="Keep the signal strong."
          description="Fund independent avalanche storytelling and the conversations people carry into the field. Choose a support level below, or review the Season 11 deck and expanded guide first."
        >
          <Stack
            spacing={1.25}
            sx={{ '& .MuiButton-root': { mt: '0 !important' } }}
          >
            <Typography
              variant="overline"
              component="p"
              sx={{ color: '#C8E4ED', fontWeight: 800, letterSpacing: '0.16em' }}
            >
              Ready to support the show?
            </Typography>
            <Button
              component="a"
              href="#support-options"
              variant="contained"
              startIcon={<Handshake />}
              endIcon={<ArrowForward />}
            >
              Choose a Support Level
            </Button>
            <Divider sx={{ borderColor: 'rgba(200,228,237,.28)', my: 0.5 }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,.72)' }}>
              Review the Season 11 sponsorship deck, or open the expanded guide for
              additional audience and partnership details.
            </Typography>
            <Button
              component="a"
              href={season11SponsorshipDeckUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="outlined"
              startIcon={<PictureAsPdf />}
              endIcon={<OpenInNew />}
              aria-label="View Season 11 Sponsorship Deck PDF (opens in a new tab)"
              sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.52)' }}
            >
              View Season 11 Sponsorship Deck
            </Button>
            <Button
              component="a"
              href={sponsorshipGuideUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="text"
              startIcon={<PictureAsPdf />}
              endIcon={<OpenInNew />}
              aria-label="View Expanded Sponsorship Guide PDF (opens in a new tab)"
              sx={{
                color: '#fff',
                justifyContent: 'flex-start',
              }}
            >
              View Expanded Sponsorship Guide
            </Button>
          </Stack>
        </PublicPageHero>

        <Box
          component="section"
          id="support-options"
          sx={{
            bgcolor: 'background.default',
            py: { xs: 5, md: 8 },
            scrollMarginTop: '96px',
          }}
        >
          <Container maxWidth="lg">
            <Box sx={{ mb: 4 }}>
              <Typography variant="h2" sx={{ mb: 1 }}>
                Choose Your Level of Support
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 760 }}>
                From one focused episode to a season-long or year-round relationship,
                choose the option that fits. Every level helps fund independent
                conversations across the avalanche community. Checkout opens securely in
                a new tab.
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
                            <Typography variant="h5" component="h3">
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
                          aria-label={`${tier.ctaLabel} — ${tier.price} (checkout opens in a new tab)`}
                        >
                          {tier.ctaLabel}
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
                Support the Sponsors Behind the Show
              </Typography>
              <Typography
                variant="body1"
                color="text.secondary"
                sx={{ maxWidth: 760 }}
              >
                These partners help carry The Avalanche Hour forward. When a
                listener offer is available, you’ll find the details and code
                on the sponsor card.
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
                    We’re updating the current sponsor list. Check back soon.
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
              <Typography variant="h2">Have Another Idea?</Typography>
              <Typography variant="body1" color="text.secondary">
                If these options don’t fit, tell us what you have in mind. We’ll
                work with you on a sponsorship or underwriting package that serves
                your goals and the avalanche community.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button component={Link} href="/contact" variant="contained">
                  Start a Conversation
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
