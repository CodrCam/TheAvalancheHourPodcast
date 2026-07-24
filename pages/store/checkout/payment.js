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
  CHECKOUT_ATTEMPT_KEY,
  CHECKOUT_DISCOUNT_KEY,
  CHECKOUT_PAYMENT_KEY,
  LAST_ORDER_KEY,
} from '../../../src/config/store';
import { ecommerceEvent } from '../../../lib/gtag';

const stripePublishableKey =
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = stripePublishableKey
  ? loadStripe(stripePublishableKey)
  : null;

const money = (cents) =>
  (Number(cents || 0) / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

function writeCart(items) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  try {
    window.dispatchEvent(new Event('ah_cart_updated'));
  } catch {
    // ignore
  }
}

function PaymentForm({ checkout }) {
  const router = useRouter();
  const stripe = useStripe();
  const elements = useElements();

  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');
  const returnHandledRef = React.useRef(false);
  const {
    clientSecret,
    breakdown,
    email,
    shipping,
    items,
    orderId,
    intentId,
  } = checkout;

  const finalizePayment = React.useCallback(
    async (pi) => {
      if (!pi?.id || pi.id !== intentId) {
        setErrorMsg(
          'We could not verify this payment response. Your cart has not been cleared. Please contact us before trying again.'
        );
        return;
      }

      if (pi.status !== 'succeeded') {
        setErrorMsg(
          pi.status === 'processing'
            ? 'Your payment is still processing. Please do not retry it. Check your email for the receipt or contact us for help.'
            : 'Payment was not completed. Please review your payment details and try again.'
        );
        setSubmitting(pi.status === 'processing');
        return;
      }

      const last4 =
        pi?.charges?.data?.[0]?.payment_method_details?.card?.last4 ||
        pi?.payment_method?.card?.last4 ||
        '';

      const amountCents =
        typeof pi.amount_received === 'number'
          ? pi.amount_received
          : typeof pi.amount === 'number'
          ? pi.amount
          : 0;

      let orderRecordPending = false;
      try {
        const recordResponse = await fetch('/api/store/record-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            paymentIntentId: pi.id,
            items,
            email,
            shipping,
          }),
        });
        if (!recordResponse.ok) {
          orderRecordPending = true;
          console.error(
            'Order recording will be completed by the Stripe webhook:',
            recordResponse.status
          );
        }
      } catch (err) {
        orderRecordPending = true;
        console.error('Failed to record order via API:', err);
      }

      try {
        sessionStorage.setItem(
          LAST_ORDER_KEY,
          JSON.stringify({
            email: email || '',
            orderId,
            amountCents,
            last4,
            items,
            paymentIntentId: pi.id,
            paymentStatus: pi.status,
            orderRecordPending,
            createdAt: new Date().toISOString(),
          })
        );
      } catch {
        // The Stripe receipt remains the durable customer confirmation.
      }

      writeCart([]);
      try {
        for (const key of [
          CHECKOUT_PAYMENT_KEY,
          CHECKOUT_SHIPPING_KEY,
          CHECKOUT_EMAIL_KEY,
          CHECKOUT_DISCOUNT_KEY,
          CHECKOUT_ATTEMPT_KEY,
        ]) {
          sessionStorage.removeItem(key);
        }
      } catch {
        // Clearing client checkout state is best-effort after a paid order.
      }
      router.replace('/store/thank-you');
    },
    [email, intentId, items, orderId, router, shipping]
  );

  React.useEffect(() => {
    if (
      !router.isReady ||
      router.query.payment_return !== '1' ||
      !stripe ||
      returnHandledRef.current
    ) {
      return;
    }

    returnHandledRef.current = true;
    setSubmitting(true);
    setErrorMsg('');

    stripe.retrievePaymentIntent(clientSecret).then(({ error, paymentIntent }) => {
      if (error) {
        setErrorMsg(
          error.message ||
            'We could not verify the returned payment. Please contact us before trying again.'
        );
        return;
      }
      finalizePayment(paymentIntent);
    });
  }, [
    clientSecret,
    finalizePayment,
    router.isReady,
    router.query.payment_return,
    stripe,
  ]);

  async function handlePay() {
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setErrorMsg(
          submitError.message ||
            'Please complete your payment details and try again.'
        );
        setSubmitting(false);
        return;
      }

      ecommerceEvent('add_payment_info', {
        items,
        value: (breakdown?.totalCents || 0) / 100,
        payment_type: 'card',
      });

      const result = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/store/checkout/payment?payment_return=1`,
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

      await finalizePayment(result.paymentIntent);
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
        <Button
          component={Link}
          href="/store/checkout/review"
          aria-disabled={submitting}
          onClick={(event) => {
            if (submitting) event.preventDefault();
          }}
          startIcon={<ArrowBackIcon />}
          variant="outlined"
        >
          Back to review
        </Button>
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

function PaymentWrapper({ checkout }) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: checkout.clientSecret,
        appearance: { theme: 'stripe' },
      }}
    >
      <PaymentForm checkout={checkout} />
    </Elements>
  );
}

export default function PaymentPage() {
  const router = useRouter();
  const [checkout, setCheckout] = React.useState(null);
  const pageError = stripePublishableKey
    ? ''
    : 'Secure payment is temporarily unavailable. Please contact us or try again later.';

  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const raw = sessionStorage.getItem(CHECKOUT_PAYMENT_KEY);
      if (!raw) {
        router.replace('/store/checkout/review');
        return;
      }
      const parsed = JSON.parse(raw);
      if (
        !parsed.clientSecret ||
        !parsed.intentId ||
        !parsed.orderId ||
        !parsed.breakdown ||
        !parsed.email ||
        !parsed.shipping ||
        !Array.isArray(parsed.items) ||
        !parsed.items.length
      ) {
        router.replace('/store/checkout/review');
        return;
      }
      setCheckout(parsed);
    } catch {
      router.replace('/store/checkout/review');
    }
  }, [router]);

  if (!checkout && !pageError) {
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
        {pageError ? (
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 2,
            }}
          >
            <Typography sx={{ color: 'error.main', mb: 2 }}>
              {pageError}
            </Typography>
            <Button
              component={Link}
              href="/store/checkout/review"
              variant="outlined"
            >
              Back to review
            </Button>
          </Paper>
        ) : (
          <PaymentWrapper checkout={checkout} />
        )}
      </Container>
    </>
  );
}
