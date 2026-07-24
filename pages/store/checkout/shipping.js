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
import Navbar from '../../../components/Navbar';
import { ecommerceEvent } from '../../../lib/gtag';
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

      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Button
            component={Link}
            href="/store/cart"
            size="small"
            startIcon={<ArrowBackIcon />}
          >
            Back to cart
          </Button>
          <Box sx={{ flexGrow: 1 }} />
          {subtotal > 0 && (
            <Typography sx={{ fontWeight: 500 }}>
              Subtotal: {money(subtotal)}
            </Typography>
          )}
        </Box>

        <Paper
          component="form"
          noValidate
          onSubmit={handleContinue}
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="h5" sx={{ mb: 2 }}>
            Shipping &amp; Contact
          </Typography>

          {errorMsg ? (
            <Typography
              sx={{ color: 'error.main', mb: 2, fontSize: 14 }}
            >
              {errorMsg}
            </Typography>
          ) : null}

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                label="Email"
                type="email"
                name="email"
                autoComplete="email"
                size="small"
                fullWidth
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                helperText="We’ll send your order and shipping updates here."
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Full name"
                name="name"
                autoComplete="name"
                size="small"
                fullWidth
                value={shipping.name}
                onChange={handleShippingChange('name')}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Street address"
                name="address-line1"
                autoComplete="address-line1"
                size="small"
                fullWidth
                value={shipping.line1}
                onChange={handleShippingChange('line1')}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                label="Apartment, suite, etc. (optional)"
                name="address-line2"
                autoComplete="address-line2"
                size="small"
                fullWidth
                value={shipping.line2}
                onChange={handleShippingChange('line2')}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="City"
                name="address-level2"
                autoComplete="address-level2"
                size="small"
                fullWidth
                value={shipping.city}
                onChange={handleShippingChange('city')}
                required
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <TextField
                label="State / Province"
                name="address-level1"
                autoComplete="address-level1"
                size="small"
                fullWidth
                value={shipping.state}
                onChange={handleShippingChange('state')}
                required
              />
            </Grid>

            <Grid item xs={12} sm={3}>
              <TextField
                label="Postal code"
                name="postal-code"
                autoComplete="postal-code"
                size="small"
                fullWidth
                value={shipping.postal_code}
                onChange={handleShippingChange('postal_code')}
                required
              />
            </Grid>

            <Grid item xs={12} sm={4}>
              <TextField
                label="Country"
                size="small"
                fullWidth
                value="United States"
                disabled
                helperText="We currently only ship within the United States."
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="contained" type="submit">
              Continue to review
            </Button>
          </Box>
        </Paper>
      </Container>
    </>
  );
}
