// pages/store/checkout/payment.js
import * as React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Container,
  Paper,
  Box,
  Typography,
  Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import Navbar from '../../../components/Navbar';
import {
  CART_KEY,
  CHECKOUT_SHIPPING_KEY,
  CHECKOUT_EMAIL_KEY,
  CHECKOUT_PAYMENT_KEY,
  LAST_ORDER_KEY,
} from '../../../src/config/store';

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || ''
);

const money = (cents) =>
  (Number(cents || 0) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

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
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  try {
    window.dispatchEvent(new Event('ah_cart_updated'));
  } catch {
    // ignore
  }
}

function PaymentForm({ clientSecret, breakdown }) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();

  const [email, setEmail] = React.useState('');
  const [shipping, setShipping] = React.useState(null);
  const [items, setItems] = React.useState([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    let shippingData = null;
    let emailData = '';
    try {
      const sRaw = sessionStorage.getItem(CHECKOUT_SHIPPING_KEY);
      const eRaw = sessionStorage.getItem(CHECKOUT_EMAIL_KEY);
      shippingData = sRaw ? JSON.parse(sRaw) : null;
      emailData = eRaw || '';
    } catch {
      shippingData = null;
      emailData = '';
    }

    setShipping(shippingData);
    setEmail(emailData);
    setItems(readCart());
  }, []);

  async function handlePay() {
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // We do NOT send shipping here (it was set on the server).
          receipt_email: email || undefined,
        },
        redirect: 'if_required',
      });

      if (result.error) {
        setErrorMsg(
          result.error.message ||
            'Payment failed. Please check your details and try again.'
        );
        setSubmitting(false);
        return;
      }

      const pi = result.paymentIntent || {};

      const last4 =
        pi?.charges?.data?.[0]?.payment_method_details?.card?.last4 ||
        pi?.payment_method?.card?.last4 ||
        '';

      const orderId = (pi.metadata && pi.metadata.order_id) || pi.id || '';
      const amountCents =
        typeof pi.amount_received === 'number'
          ? pi.amount_received
          : typeof pi.amount === 'number'
          ? pi.amount
          : 0;

      // Record order for admin backend
      try {
        await fetch('/api/store/record-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            paymentIntentId: pi.id,
            status: pi.status || 'paid',
            amountCents,
            items,
            email,
            shipping,
          }),
        });
      } catch (err) {
        console.error('Failed to record order via API:', err);
      }

      // Save snapshot for thank-you page
      try {
        sessionStorage.setItem(
          LAST_ORDER_KEY,
          JSON.stringify({
            email: email || '',
            orderId,
            amountCents,
            last4,
            items,
            createdAt: new Date().toISOString(),
          })
        );
      } catch {
        // ignore
      }

      // Clear cart + state
      writeCart([]);
      try {
        sessionStorage.removeItem(CHECKOUT_PAYMENT_KEY);
      } catch {}
      router.push('/store/thank-you');
    } catch (e) {
      setErrorMsg(e?.message || 'Unexpected error during payment.');
      setSubmitting(false);
    }
  }

  const subtotal = breakdown?.subtotalCents ?? 0;
  const discount = breakdown?.discountAmountCents ?? 0;
  const shippingCents = breakdown?.shippingCents ?? 0;
  const tax = breakdown?.taxAmountCents ?? 0;
  const total = breakdown?.totalCents ?? 0;

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, md: 3 },
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
      }}
    >
      <Typography variant="h5" sx={{ mb: 2 }}>
        Payment
      </Typography>

      {/* Summary carried over from Review */}
      {breakdown ? (
        <Box sx={{ mb: 2, fontSize: 14 }}>
          <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
            Order summary
          </Typography>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between' }}
          >
            <span>Subtotal</span>
            <span>{money(subtotal)}</span>
          </Box>
          {discount > 0 ? (
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                color: 'success.main',
              }}
            >
              <span>Discount</span>
              <span>-{money(discount)}</span>
            </Box>
          ) : null}
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between' }}
          >
            <span>Shipping</span>
            <span>{money(shippingCents)}</span>
          </Box>
          <Box
            sx={{ display: 'flex', justifyContent: 'space-between' }}
          >
            <span>Tax</span>
            <span>{money(tax)}</span>
          </Box>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              mt: 0.5,
            }}
          >
            <span>Total charged</span>
            <span>{money(total)}</span>
          </Box>
        </Box>
      ) : null}

      {errorMsg ? (
        <Typography
          sx={{ color: 'error.main', mb: 2, fontSize: 14 }}
        >
          {errorMsg}
        </Typography>
      ) : null}

      <PaymentElement />

      <Box sx={{ mt: 3, display: 'flex', gap: 1 }}>
        <Link href="/store/checkout/review" legacyBehavior>
          <Button startIcon={<ArrowBackIcon />} variant="outlined">
            Back to review
          </Button>
        </Link>
        <Button
          onClick={handlePay}
          disabled={!stripe || submitting}
          variant="contained"
          startIcon={<ShoppingCartCheckoutIcon />}
        >
          {submitting ? 'Processing…' : 'Pay now'}
        </Button>
      </Box>
    </Paper>
  );
}

function PaymentWrapper({ clientSecret, breakdown }) {
  return (
    <Elements
      stripe={stripePromise}
      options={{ clientSecret, appearance: { theme: 'stripe' } }}
    >
      <PaymentForm
        clientSecret={clientSecret}
        breakdown={breakdown}
      />
    </Elements>
  );
}

export default function PaymentPage() {
  const router = useRouter();
  const [clientSecret, setClientSecret] = React.useState(null);
  const [breakdown, setBreakdown] = React.useState(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = sessionStorage.getItem(CHECKOUT_PAYMENT_KEY);
      if (!raw) {
        router.replace('/store/checkout/review');
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed.clientSecret) {
        router.replace('/store/checkout/review');
        return;
      }
      setClientSecret(parsed.clientSecret);
      setBreakdown(parsed.breakdown || null);
    } catch {
      router.replace('/store/checkout/review');
    }
  }, [router]);

  if (!clientSecret) {
    return null;
  }

  return (
    <>
      <Head>
        <title>Checkout – Payment — The Avalanche Hour</title>
        <meta
          name="description"
          content="Secure payment for The Avalanche Hour Store"
        />
      </Head>

      <Navbar />

      <Container maxWidth="sm" sx={{ py: { xs: 3, md: 5 } }}>
        <PaymentWrapper
          clientSecret={clientSecret}
          breakdown={breakdown}
        />
      </Container>
    </>
  );
}