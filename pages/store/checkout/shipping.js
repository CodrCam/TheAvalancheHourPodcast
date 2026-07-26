// /pages/store/checkout/shipping.js
import * as React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Container,
  Paper,
  Box,
  Typography,
  Grid,
  TextField,
  Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import Navbar from '../../../components/Navbar';
import {
  CheckoutHero,
  CheckoutPage,
  optionLabel,
} from '../../../components/CheckoutFlow';
import { ecommerceEvent } from '../../../lib/gtag';
import styles from '../../../styles/Checkout.module.css';
import {
  CART_KEY,
  CHECKOUT_ATTEMPT_KEY,
  CHECKOUT_EMAIL_KEY,
  CHECKOUT_SHIPPING_KEY,
} from '../../../src/config/store';

function readCart() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function money(cents) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

export default function ShippingPage() {
  const router = useRouter();

  const [email, setEmail] = React.useState('');
  const [shipping, setShipping] = React.useState({
    name: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'US', // we only ship in the US
  });
  const [errorMsg, setErrorMsg] = React.useState('');
  const trackedBeginCheckoutRef = React.useRef(false);
  const [items, setItems] = React.useState([]);

  React.useEffect(() => {
    setItems(readCart());
  }, []);

  React.useEffect(() => {
    if (trackedBeginCheckoutRef.current || !items.length) return;
    trackedBeginCheckoutRef.current = true;
    ecommerceEvent('begin_checkout', { items });
  }, [items]);

  // Hydrate from any existing session data
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const sRaw = sessionStorage.getItem('ah_checkout_shipping');
      const eRaw = sessionStorage.getItem('ah_checkout_email');
      if (sRaw) {
        const parsed = JSON.parse(sRaw);
        setShipping((prev) => ({ ...prev, ...parsed }));
      }
      if (eRaw) {
        setEmail(eRaw);
      }
    } catch {
      // ignore
    }
  }, []);

  const subtotal = React.useMemo(
    () => items.reduce((sum, it) => sum + it.price * it.qty, 0),
    [items]
  );

  function emailIsValid(value) {
    const v = value.trim();
    if (!v) return false;
    // Simple: something@something.something
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
  }

  function postalCodeIsValid(value) {
    return /^\d{5}(?:-\d{4})?$/.test(value.trim());
  }

  function createCheckoutAttemptId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function handleContinue(event) {
    event?.preventDefault();
    setErrorMsg('');

    if (!items.length) {
      setErrorMsg('Your cart is empty.');
      return;
    }

    if (!emailIsValid(email)) {
      setErrorMsg(
        'Please enter a valid email address (for example: name@example.com).'
      );
      return;
    }

    if (!shipping.name.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }

    if (!shipping.line1.trim()) {
      setErrorMsg('Please enter your street address.');
      return;
    }

    if (!shipping.city.trim()) {
      setErrorMsg('Please enter your city.');
      return;
    }

    if (!shipping.state.trim()) {
      setErrorMsg('Please enter your state.');
      return;
    }

    if (!postalCodeIsValid(shipping.postal_code)) {
      setErrorMsg('Please enter a valid U.S. ZIP code (for example: 97814).');
      return;
    }

    // Enforce US-only shipping
    const country = (shipping.country || '').trim().toUpperCase();
    if (country && country !== 'US' && country !== 'USA') {
      setErrorMsg('We currently only ship within the United States.');
      return;
    }

    try {
      sessionStorage.setItem(
        CHECKOUT_SHIPPING_KEY,
        JSON.stringify({
          ...shipping,
          name: shipping.name.trim(),
          line1: shipping.line1.trim(),
          line2: shipping.line2.trim(),
          city: shipping.city.trim(),
          state: shipping.state.trim(),
          postal_code: shipping.postal_code.trim(),
          country: 'US',
        })
      );
      sessionStorage.setItem(CHECKOUT_EMAIL_KEY, email.trim().toLowerCase());
      if (!sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY)) {
        sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, createCheckoutAttemptId());
      }
    } catch {
      setErrorMsg(
        'This browser is blocking checkout storage. Please enable site data or try a standard browsing window.'
      );
      return;
    }

    router.push('/store/checkout/review');
  }

  function handleShippingChange(field) {
    return (e) => {
      const value = e.target.value;
      setShipping((prev) => ({ ...prev, [field]: value }));
    };
  }

  return (
    <>
      <Head>
        <title>Checkout – Shipping — The Avalanche Hour</title>
        <meta
          name="description"
          content="Enter shipping details for The Avalanche Hour Store"
        />
      </Head>

      <Navbar />

      <CheckoutPage>
        <CheckoutHero
          currentStep={2}
          title="Where should it land?"
          description="Give us the contact and shipping details we need. We currently ship field goods within the United States."
        />

        <Container maxWidth="lg" className={styles.content}>
          <Button
            component={Link}
            href="/store/cart"
            startIcon={<ArrowBackIcon />}
            className={styles.backLink}
          >
            Back to cart
          </Button>

          <Box className={styles.layout}>
            <Paper
              component="form"
              noValidate
              onSubmit={handleContinue}
              elevation={0}
              className={`${styles.panel} ${styles.formPanel}`}
            >
              <Box className={styles.panelHeader}>
                <Box>
                  <Typography component="p" className={styles.panelEyebrow}>
                    Delivery details
                  </Typography>
                  <Typography component="h2" className={styles.panelTitle}>
                    Shipping &amp; contact
                  </Typography>
                </Box>
              </Box>

              {errorMsg ? (
                <Box role="alert" className={styles.errorNotice}>
                  {errorMsg}
                </Box>
              ) : null}

              <Box className={styles.formSection}>
                <Box className={styles.sectionHeading}>
                  <span className={styles.sectionNumber}>01</span>
                  <Typography component="h3" className={styles.sectionTitle}>
                    Contact
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="Email"
                      type="email"
                      name="email"
                      autoComplete="email"
                      fullWidth
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      helperText="We’ll send your order and shipping updates here."
                      className={styles.field}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Full name"
                      name="name"
                      autoComplete="name"
                      fullWidth
                      value={shipping.name}
                      onChange={handleShippingChange('name')}
                      required
                      className={styles.field}
                    />
                  </Grid>
                </Grid>
              </Box>

              <Box className={styles.formSection}>
                <Box className={styles.sectionHeading}>
                  <span className={styles.sectionNumber}>02</span>
                  <Typography component="h3" className={styles.sectionTitle}>
                    Shipping address
                  </Typography>
                </Box>
                <Grid container spacing={2}>
                  <Grid item xs={12}>
                    <TextField
                      label="Street address"
                      name="address-line1"
                      autoComplete="address-line1"
                      fullWidth
                      value={shipping.line1}
                      onChange={handleShippingChange('line1')}
                      required
                      className={styles.field}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      label="Apartment, suite, etc. (optional)"
                      name="address-line2"
                      autoComplete="address-line2"
                      fullWidth
                      value={shipping.line2}
                      onChange={handleShippingChange('line2')}
                      className={styles.field}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="City"
                      name="address-level2"
                      autoComplete="address-level2"
                      fullWidth
                      value={shipping.city}
                      onChange={handleShippingChange('city')}
                      required
                      className={styles.field}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="State"
                      name="address-level1"
                      autoComplete="address-level1"
                      fullWidth
                      value={shipping.state}
                      onChange={handleShippingChange('state')}
                      required
                      className={styles.field}
                    />
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField
                      label="ZIP code"
                      name="postal-code"
                      autoComplete="postal-code"
                      fullWidth
                      value={shipping.postal_code}
                      onChange={handleShippingChange('postal_code')}
                      required
                      className={styles.field}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Country"
                      fullWidth
                      value="United States"
                      disabled
                      helperText="U.S. shipping only for the current drop."
                      className={styles.field}
                    />
                  </Grid>
                </Grid>
              </Box>

              <Box className={styles.trustRow}>
                <LockOutlinedIcon />
                <span>
                  These details are used only to process this order and provide
                  delivery updates.
                </span>
              </Box>

              <Box className={styles.formActions}>
                <Button
                  component={Link}
                  href="/store/cart"
                  variant="outlined"
                  className={styles.secondaryButton}
                >
                  Review cart
                </Button>
                <Button
                  variant="contained"
                  type="submit"
                  endIcon={<ArrowForwardRoundedIcon />}
                  className={styles.primaryButton}
                >
                  Continue to review
                </Button>
              </Box>
            </Paper>

            <Box className={styles.sideColumn}>
              <Paper elevation={0} className={styles.summaryCard}>
                <Box className={styles.summaryTop}>
                  <Typography component="p" className={styles.summaryEyebrow}>
                    Packed so far
                  </Typography>
                  <Typography component="h2" className={styles.summaryTitle}>
                    Your field goods
                  </Typography>
                </Box>
                <Box className={styles.summaryBody}>
                  <Box className={styles.miniItems}>
                    {items.map((item) => (
                      <Box key={item.key} className={styles.miniItem}>
                        <Box
                          component="img"
                          src={item.image}
                          alt=""
                          className={styles.miniImage}
                        />
                        <Box>
                          <Typography className={styles.miniName}>
                            {item.name} × {item.qty}
                          </Typography>
                          {optionLabel(item.options) ? (
                            <Typography className={styles.miniOptions}>
                              {optionLabel(item.options)}
                            </Typography>
                          ) : null}
                        </Box>
                        <Typography className={styles.miniPrice}>
                          {money(item.price * item.qty)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                  <Box className={styles.summaryTotal}>
                    <span>Subtotal</span>
                    <strong>{money(subtotal)}</strong>
                  </Box>
                  <Box className={styles.summaryStatus}>
                    <LocalShippingOutlinedIcon fontSize="small" />
                    <span>
                      Shipping is confirmed on the next step.
                    </span>
                  </Box>
                </Box>
              </Paper>
            </Box>
          </Box>
        </Container>
      </CheckoutPage>
    </>
  );
}
