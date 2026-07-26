import React from 'react';
import Link from 'next/link';
import { Box, Container, Typography } from '@mui/material';
import InstagramIcon from '@mui/icons-material/Instagram';
import ArrowOutwardRoundedIcon from '@mui/icons-material/ArrowOutwardRounded';
import { SOCIAL_LINKS, SUPPORT_LINKS } from '../lib/siteLinks';
import styles from '../styles/PublicSite.module.css';

const exploreLinks = [
  ['Episodes', '/episodes'],
  ['Current season', '/episodes/current'],
  ['Past seasons', '/episodes/archive'],
  ['About the team', '/about'],
];

const fieldLinks = [
  ['Avalanche resources', '/resources'],
  ['Support the podcast', '/support'],
  ['Field goods', '/store'],
  ['Be a guest', '/be-a-guest'],
];

function FooterLink({ href, children, external = false }) {
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
        <ArrowOutwardRoundedIcon aria-hidden="true" />
      </a>
    );
  }

  return <Link href={href}>{children}</Link>;
}

export default function SiteFooter() {
  return (
    <Box component="footer" className={styles.siteFooter}>
      <span className={styles.footerContours} aria-hidden="true" />
      <Container maxWidth="lg" className={styles.footerInner}>
        <Box className={styles.footerBrand}>
          <img src="/images/avalanche-hour-podcast-logo-white.png" alt="" />
          <Box>
            <Typography component="p" className={styles.footerKicker}>
              Independent voices · community supported
            </Typography>
            <Typography component="p" className={styles.footerTitle}>
              The Avalanche Hour
            </Typography>
            <Typography component="p" className={styles.footerMission}>
              Stories, knowledge, and hard-earned lessons from the people who
              spend their lives thinking about snow.
            </Typography>
          </Box>
        </Box>

        <Box className={styles.footerNav} aria-label="Footer navigation">
          <Box>
            <Typography component="h2">Listen</Typography>
            {exploreLinks.map(([label, href]) => (
              <FooterLink key={href} href={href}>
                {label}
              </FooterLink>
            ))}
          </Box>
          <Box>
            <Typography component="h2">Go deeper</Typography>
            {fieldLinks.map(([label, href]) => (
              <FooterLink key={href} href={href}>
                {label}
              </FooterLink>
            ))}
          </Box>
          <Box>
            <Typography component="h2">Stay connected</Typography>
            <FooterLink href="/contact">Contact</FooterLink>
            <FooterLink href={SOCIAL_LINKS.instagram} external>
              <InstagramIcon aria-hidden="true" />
              Instagram
            </FooterLink>
            <FooterLink href={SUPPORT_LINKS.paypalDonate} external>
              Donate
            </FooterLink>
          </Box>
        </Box>
      </Container>

      <Container maxWidth="lg" className={styles.footerBase}>
        <span>© {new Date().getFullYear()} The Avalanche Hour Podcast</span>
        <Link href="/admin/login">Team sign in</Link>
      </Container>
    </Box>
  );
}
