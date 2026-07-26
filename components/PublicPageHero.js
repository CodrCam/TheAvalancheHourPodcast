import React from 'react';
import { Box, Container, Typography } from '@mui/material';
import styles from '../styles/PublicSite.module.css';

export default function PublicPageHero({
  eyebrow,
  title,
  description,
  children,
  compact = false,
}) {
  return (
    <Box
      component="header"
      className={`${styles.pageHero} ${compact ? styles.pageHeroCompact : ''}`}
    >
      <span className={styles.contourLines} aria-hidden="true" />
      <Container maxWidth="lg" className={styles.pageHeroInner}>
        <Box className={styles.pageHeroCopy}>
          {eyebrow ? (
            <Typography component="p" className={styles.eyebrow}>
              {eyebrow}
            </Typography>
          ) : null}
          <Typography component="h1" className={styles.pageTitle}>
            {title}
          </Typography>
          {description ? (
            <Typography component="p" className={styles.pageDescription}>
              {description}
            </Typography>
          ) : null}
        </Box>
        {children ? (
          <Box className={styles.pageHeroAside}>{children}</Box>
        ) : null}
      </Container>
    </Box>
  );
}
