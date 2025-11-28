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

const CART_KEY = 'ah_cart';

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

  const items = React.useMemo(() => readCart(), []);

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

  function handleContinue() {
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

    if (!shipping.postal_code.trim()) {
      setErrorMsg('Please enter your postal code.');
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
        'ah_checkout_shipping',
        JSON.stringify(shipping)
      );
      sessionStorage.setItem('ah_checkout_email', email.trim());
    } catch {
      // ignore; Review page will complain if it can't load data
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
          <Link href="/store/cart" legacyBehavior>
            <Button size="small" startIcon={<ArrowBackIcon />}>
              Back to cart
            </Button>
          </Link>
          <Box sx={{ flexGrow: 1 }} />
          {subtotal > 0 && (
            <Typography sx={{ fontWeight: 500 }}>
              Subtotal: {money(subtotal)}
            </Typography>
          )}
        </Box>

        <Paper
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
                size="small"
                fullWidth
                value={shipping.line2}
                onChange={handleShippingChange('line2')}
              />
            </Grid>

            <Grid item xs={12} sm={6}>
              <TextField
                label="City"
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
            <Button variant="contained" onClick={handleContinue}>
              Continue to review
            </Button>
          </Box>
        </Paper>
      </Container>
    </>
  );
}