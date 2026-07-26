import * as React from 'react';
import Link from 'next/link';
import { Box, Container, Typography } from '@mui/material';
import styles from '../styles/Checkout.module.css';

const CHECKOUT_STEPS = [
  { label: 'Cart', href: '/store/cart' },
  { label: 'Shipping', href: '/store/checkout/shipping' },
  { label: 'Review', href: '/store/checkout/review' },
  { label: 'Payment', href: '/store/checkout/payment' },
];

export function CheckoutHero({
  currentStep,
  eyebrow = 'The Avalanche Hour field goods',
  title,
  description,
  complete = false,
}) {
  return (
    <Box component="header" className={styles.flowHero}>
      <div className={styles.contourLines} aria-hidden="true" />
      <Container maxWidth="lg" className={styles.heroInner}>
        <Box className={styles.heroCopy}>
          <Typography component="p" className={styles.heroEyebrow}>
            {eyebrow}
          </Typography>
          <Typography component="h1" className={styles.heroTitle}>
            {title}
          </Typography>
          {description ? (
            <Typography className={styles.heroDescription}>
              {description}
            </Typography>
          ) : null}
        </Box>

        <Box
          component="nav"
          aria-label="Checkout progress"
          className={styles.checkoutProgress}
        >
          {CHECKOUT_STEPS.map((step, index) => {
            const stepNumber = index + 1;
            const isComplete = complete || stepNumber < currentStep;
            const isCurrent = !complete && stepNumber === currentStep;
            const className = [
              styles.progressStep,
              isComplete ? styles.progressStepComplete : '',
              isCurrent ? styles.progressStepCurrent : '',
            ]
              .filter(Boolean)
              .join(' ');

            const content = (
              <>
                <span className={styles.progressNumber}>
                  {isComplete ? '✓' : stepNumber}
                </span>
                <span className={styles.progressLabel}>{step.label}</span>
              </>
            );

            return (
              <React.Fragment key={step.label}>
                {isComplete && !complete ? (
                  <Link href={step.href} className={className}>
                    {content}
                  </Link>
                ) : (
                  <span
                    className={className}
                    aria-current={isCurrent ? 'step' : undefined}
                  >
                    {content}
                  </span>
                )}
                {index < CHECKOUT_STEPS.length - 1 ? (
                  <span
                    className={`${styles.progressLine} ${
                      isComplete ? styles.progressLineComplete : ''
                    }`}
                    aria-hidden="true"
                  />
                ) : null}
              </React.Fragment>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
}

export function CheckoutPage({ children }) {
  return (
    <Box component="main" className={styles.checkoutPage}>
      {children}
    </Box>
  );
}

export function optionLabel(options = {}) {
  return [options.style, options.color, options.size]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(' · ');
}

