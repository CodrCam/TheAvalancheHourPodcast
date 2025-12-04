// /pages/store/checkout/review.js
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
  Divider,
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

function writeCart(items) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}

function money(cents) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

export default function ReviewPage() {
  const router = useRouter();

  const [items, setItems] = React.useState([]);
  const [email, setEmail] = React.useState('');
  const [shipping, setShipping] = React.useState(null);

  const [discountInput, setDiscountInput] = React.useState('');
  const [appliedDiscountCode, setAppliedDiscountCode] = React.useState('');

  const [clientSecret, setClientSecret] = React.useState(null);
  const [intentId, setIntentId] = React.useState(null);
  const [breakdown, setBreakdown] = React.useState(null);

  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState('');

  // Load cart + shipping/email from storage
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const cartItems = readCart();

    let shippingData = null;
    let emailData = '';
    try {
      const sRaw = sessionStorage.getItem('ah_checkout_shipping');
      const eRaw = sessionStorage.getItem('ah_checkout_email');
      shippingData = sRaw ? JSON.parse(sRaw) : null;
      emailData = eRaw || '';
    } catch {
      shippingData = null;
    }

    if (!cartItems.length) {
      setErrorMsg('Your cart is empty.');
      setItems([]);
      setLoading(false);
      return;
    }

    if (!shippingData || !emailData) {
      setErrorMsg(
        'Missing shipping or email info. Please go back and fill in your details.'
      );
      setItems([]);
      setLoading(false);
      return;
    }

    setItems(cartItems);
    setShipping(shippingData);
    setEmail(emailData);
  }, []);

  // Whenever we have items + shipping, (re)create the PaymentIntent
  React.useEffect(() => {
    if (!items.length || !shipping) return;

    let ignore = false;

    async function prepareOrder() {
      setLoading(true);
      setErrorMsg('');

      try {
        const res = await fetch('/api/store/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            email,
            shipping,
            discountCode: appliedDiscountCode || null,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          setErrorMsg(
            data?.error || 'Failed to prepare order (tax/total).'
          );
          setLoading(false);
          return;
        }

        if (ignore) return;

        setClientSecret(data.clientSecret);
        setIntentId(data.intentId);
        setBreakdown(data.breakdown || null);
        setLoading(false);
      } catch (e) {
        if (!ignore) {
          setErrorMsg(
            e?.message || 'Network error preparing order.'
          );
          setLoading(false);
        }
      }
    }

    prepareOrder();

    return () => {
      ignore = true;
    };
  }, [items, shipping, email, appliedDiscountCode]);

  function handleRemoveItem(key) {
    const next = items.filter((it) => it.key !== key);
    setItems(next);
    writeCart(next);
    if (!next.length) {
      router.push('/store/cart');
    }
  }

  function handleQtyChange(key, qty) {
    const safeQty = Math.max(1, Math.min(99, qty || 1));
    const next = items.map((it) =>
      it.key === key ? { ...it, qty: safeQty } : it
    );
    setItems(next);
    writeCart(next);
  }

  async function handleContinueToPayment() {
    if (!clientSecret || !intentId || !breakdown) return;

    try {
      if (typeof window !== 'undefined') {
        // IMPORTANT: key must match CHECKOUT_PAYMENT_KEY in src/config/store.js
        sessionStorage.setItem(
          'ah_checkout_payment',
          JSON.stringify({
            clientSecret,
            intentId,
            breakdown,
            discountCode: breakdown.discountCode || null,
          })
        );
      }
    } catch {
      // ignore
    }

    router.push('/store/checkout/payment');
  }

  const subtotalCents = breakdown?.subtotalCents ?? 0;
  const discountCents = breakdown?.discountAmountCents ?? 0;
  const taxCents = breakdown?.taxAmountCents ?? 0;
  const shippingCents = breakdown?.shippingCents ?? 0; // NEW: show shipping on Review
  const totalCents = breakdown?.totalCents ?? 0;

  // Just show a generic label so we never leak old code names like "Friends 20"
  const discountLabel = 'Discount';

  return (
    <>
      <Head>
        <title>Checkout – Review — The Avalanche Hour</title>
        <meta
          name="description"
          content="Review your order before payment at The Avalanche Hour Store"
        />
      </Head>

      <Navbar />

      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Link href="/store/checkout/shipping" legacyBehavior>
            <Button size="small" startIcon={<ArrowBackIcon />}>
              Back to shipping
            </Button>
          </Link>
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
            Review your order
          </Typography>

          {errorMsg ? (
            <Typography
              sx={{ color: 'error.main', mb: 2, fontSize: 14 }}
            >
              {errorMsg}
            </Typography>
          ) : null}

          <Grid container spacing={3}>
            {/* Left: Shipping + discount */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Contact &amp; Shipping
              </Typography>

              {shipping ? (
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 500 }}>
                    {shipping.name}
                  </Typography>
                  <Typography>{email}</Typography>
                  <Typography sx={{ mt: 1 }}>
                    {shipping.line1}
                    {shipping.line2 ? `, ${shipping.line2}` : ''}
                  </Typography>
                  <Typography>
                    {shipping.city}, {shipping.state}{' '}
                    {shipping.postal_code}
                  </Typography>
                  <Typography>{shipping.country}</Typography>
                </Box>
              ) : null}

              <Divider sx={{ my: 2 }} />

              {/* Discount code input */}
              <Box
                sx={{
                  display: 'flex',
                  gap: 1,
                  alignItems: 'center',
                  mb: 2,
                  flexWrap: 'wrap',
                }}
              >
                <TextField
                  label="Discount code"
                  size="small"
                  value={discountInput}
                  onChange={(e) => setDiscountInput(e.target.value)}
                  sx={{ flexGrow: 1, minWidth: 160 }}
                  placeholder="Optional – host/friends code"
                />
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() =>
                    setAppliedDiscountCode(discountInput.trim())
                  }
                >
                  Apply
                </Button>
              </Box>
            </Grid>

            {/* Right: Items */}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle1" sx={{ mb: 1 }}>
                Items
              </Typography>

              <Box sx={{ display: 'grid', gap: 1 }}>
                {items.map((it) => (
                  <Box
                    key={it.key}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                    }}
                  >
                    <Box
                      component="img"
                      src={it.image}
                      alt={it.name}
                      sx={{
                        width: 56,
                        height: 56,
                        objectFit: 'cover',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    />
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography
                        variant="body1"
                        sx={{ fontWeight: 600 }}
                      >
                        {it.name}
                      </Typography>
                      {it.options ? (
                        <Typography
                          variant="body2"
                          sx={{ color: 'text.secondary' }}
                        >
                          {[
                            it.options.style,
                            it.options.size,
                            it.options.color,
                          ]
                            .filter(Boolean)
                            .join(' • ')}
                        </Typography>
                      ) : null}
                      <Typography
                        variant="body2"
                        sx={{ color: 'text.secondary' }}
                      >
                        Qty:{' '}
                        <input
                          type="number"
                          min={1}
                          max={99}
                          value={it.qty}
                          onChange={(e) =>
                            handleQtyChange(
                              it.key,
                              parseInt(e.target.value, 10) || 1
                            )
                          }
                          style={{
                            width: 56,
                            padding: 4,
                            borderRadius: 6,
                            border: '1px solid #ccc',
                            textAlign: 'center',
                            marginLeft: 4,
                          }}
                        />
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography sx={{ fontWeight: 500 }}>
                        {money(it.price * it.qty)}
                      </Typography>
                      <Button
                        size="small"
                        color="inherit"
                        onClick={() => handleRemoveItem(it.key)}
                      >
                        Remove
                      </Button>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Grid>
          </Grid>

          <Divider sx={{ my: 2 }} />

          {/* Price breakdown */}
          <Box sx={{ display: 'grid', gap: 0.5, mb: 2 }}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Subtotal</span>
              <strong>{money(subtotalCents)}</strong>
            </Box>

            {discountCents > 0 ? (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'success.main',
                }}
              >
                <span>{discountLabel}</span>
                <span>-{money(discountCents)}</span>
              </Box>
            ) : null}

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Shipping</span>
              <span>{money(shippingCents)}</span>
            </Box>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>Tax</span>
              <span>{money(taxCents)}</span>
            </Box>

            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 18,
                fontWeight: 600,
                mt: 0.5,
              }}
            >
              <span>Total</span>
              <span>{money(totalCents)}</span>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleContinueToPayment}
              disabled={!clientSecret || !intentId || !breakdown || loading}
            >
              Continue to payment
            </Button>
          </Box>
        </Paper>
      </Container>
    </>
  );
}