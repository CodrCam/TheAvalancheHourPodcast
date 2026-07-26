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
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  ExpressCheckoutElement,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import Navbar from '../../../components/Navbar';
import {
  CheckoutHero,
  CheckoutPage,
} from '../../../components/CheckoutFlow';
import styles from '../../../styles/Checkout.module.css';
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
  const [expressAvailable, setExpressAvailable] = React.useState(false);
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

  async function handleExpressConfirm(event) {
    if (!stripe || !elements || submitting) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      ecommerceEvent('add_payment_info', {
        items,
        value: (breakdown?.totalCents || 0) / 100,
        payment_type: event?.expressPaymentType || 'wallet',
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
        const message =
          result.error.message ||
          'Express payment failed. Please try again or use another payment method.';
        event?.paymentFailed?.({ reason: 'fail', message });
        setErrorMsg(message);
        setSubmitting(false);
        return;
      }

      if (result.paymentIntent) {
        await finalizePayment(result.paymentIntent);
      }
    } catch (e) {
      const message =
        e?.message || 'Unexpected error during express payment.';
      event?.paymentFailed?.({ reason: 'fail', message });
      setErrorMsg(message);
      setSubmitting(false);
    }
  }

  const subtotal = breakdown?.subtotalCents ?? 0;
  const discount = breakdown?.discountAmountCents ?? 0;
  const shippingCents = breakdown?.shippingCents ?? 0;
  const shippingWaived = Boolean(breakdown?.shippingWaived);
  const tax = breakdown?.taxAmountCents ?? 0;
  const total = breakdown?.totalCents ?? 0;

  return (
    <Box className={styles.paymentLayout}>
      <Paper
        elevation={0}
        className={`${styles.panel} ${styles.formPanel}`}
      >
        <Box className={styles.panelHeader}>
          <Box>
            <Typography component="p" className={styles.panelEyebrow}>
              Encrypted checkout
            </Typography>
            <Typography component="h2" className={styles.panelTitle}>
              Payment details
            </Typography>
          </Box>
        </Box>

        <Box className={styles.secureHeading}>
          <LockOutlinedIcon />
          <Typography component="p">
            Payment information is handled securely by Stripe.
          </Typography>
        </Box>

        {errorMsg ? (
          <Box role="alert" className={styles.errorNotice} sx={{ mt: 2 }}>
            {errorMsg}
          </Box>
        ) : null}

        <Box
          hidden={!expressAvailable}
          className={styles.expressCheckout}
        >
          <Typography component="p" className={styles.expressEyebrow}>
            Fast track
          </Typography>
          <Typography component="h3" className={styles.expressTitle}>
            Express checkout
          </Typography>
          <Typography component="p" className={styles.expressCopy}>
            Apple Pay, Google Pay, and Amazon Pay appear when they are
            available on this device.
          </Typography>
          <ExpressCheckoutElement
            options={{
              buttonType: {
                applePay: 'check-out',
                googlePay: 'checkout',
              },
              buttonTheme: {
                applePay: 'black',
                googlePay: 'white',
              },
              buttonHeight: 52,
              layout: {
                maxColumns: 2,
                maxRows: 2,
                overflow: 'auto',
              },
              paymentMethods: {
                applePay: 'always',
                googlePay: 'always',
                link: 'never',
                paypal: 'never',
                klarna: 'never',
              },
            }}
            onReady={({ availablePaymentMethods }) => {
              setExpressAvailable(
                Boolean(
                  availablePaymentMethods &&
                    Object.values(availablePaymentMethods).some(Boolean)
                )
              );
            }}
            onLoadError={() => setExpressAvailable(false)}
            onConfirm={handleExpressConfirm}
          />
        </Box>

        {expressAvailable ? (
          <Box className={styles.paymentDivider}>
            <span />
            <Typography component="p">or use another method</Typography>
            <span />
          </Box>
        ) : null}

        <Box
          className={`${styles.paymentElementWrap} ${
            expressAvailable ? styles.paymentElementWithExpress : ''
          }`}
        >
          <PaymentElement />
        </Box>

        <Box className={styles.paymentActions}>
          <Button
            component={Link}
            href="/store/checkout/review"
            aria-disabled={submitting}
            onClick={(event) => {
              if (submitting) event.preventDefault();
            }}
            variant="outlined"
            className={styles.secondaryButton}
          >
            Back to review
          </Button>
          <Button
            onClick={handlePay}
            disabled={!stripe || submitting}
            variant="contained"
            startIcon={<ShoppingCartCheckoutIcon />}
            className={styles.primaryButton}
          >
            {submitting ? 'Processing securely…' : `Pay ${money(total)}`}
          </Button>
        </Box>
      </Paper>

      <Paper elevation={0} className={styles.summaryCard}>
        <Box className={styles.summaryTop}>
          <Typography component="p" className={styles.summaryEyebrow}>
            Final amount
          </Typography>
          <Typography component="h2" className={styles.summaryTitle}>
            Order summary
          </Typography>
        </Box>
        <Box className={styles.summaryBody}>
          {breakdown ? (
            <>
              <Box className={styles.summaryRows}>
                <Box className={styles.summaryRow}>
                  <span>Subtotal</span>
                  <strong>{money(subtotal)}</strong>
                </Box>
                {discount > 0 ? (
                  <Box
                    className={`${styles.summaryRow} ${styles.discountRow}`}
                  >
                    <span>Discount</span>
                    <strong>-{money(discount)}</strong>
                  </Box>
                ) : null}
                <Box className={styles.summaryRow}>
                  <span>Shipping</span>
                  <strong>
                    {shippingWaived ? 'Waived' : money(shippingCents)}
                  </strong>
                </Box>
                {tax > 0 ? (
                  <Box className={styles.summaryRow}>
                    <span>Tax</span>
                    <strong>{money(tax)}</strong>
                  </Box>
                ) : null}
              </Box>
              <Box className={styles.summaryTotal}>
                <span>Total charged</span>
                <strong>{money(total)}</strong>
              </Box>
            </>
          ) : null}
          <Typography className={styles.summaryNote}>
            You will receive an email receipt and order confirmation after a
            successful payment.
          </Typography>
          <Box className={styles.trustRow}>
            <LockOutlinedIcon />
            <span>
              The order remains in your cart unless Stripe confirms the payment
              succeeded.
            </span>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
}

function PaymentWrapper({ checkout }) {
  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret: checkout.clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#b9471d',
            colorBackground: '#ffffff',
            colorText: '#10222d',
            colorDanger: '#b9471d',
            borderRadius: '0px',
            fontFamily: 'Arial, Helvetica, sans-serif',
            spacingUnit: '4px',
          },
          rules: {
            '.Input': {
              border: '1px solid rgba(16, 34, 45, 0.28)',
              boxShadow: 'none',
              padding: '13px',
            },
            '.Input:focus': {
              border: '1px solid #ef6f35',
              boxShadow: '0 0 0 1px #ef6f35',
            },
            '.Label': {
              color: '#29414d',
              fontWeight: '600',
            },
          },
        },
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

      <CheckoutPage>
        <CheckoutHero
          currentStep={4}
          title="Finish securely."
          description="Complete payment through Stripe. Your cart is cleared only after the payment is confirmed."
        />

        <Container maxWidth="lg" className={styles.content}>
          <Button
            component={Link}
            href="/store/checkout/review"
            startIcon={<ArrowBackIcon />}
            className={styles.backLink}
          >
            Back to review
          </Button>

          {pageError ? (
            <Paper elevation={0} className={styles.panel}>
              <Box role="alert" className={styles.errorNotice}>
                {pageError}
              </Box>
              <Typography className={styles.summaryNote}>
                Your cart and checkout details have not been cleared.
              </Typography>
              <Button
                component={Link}
                href="/store/checkout/review"
                variant="outlined"
                className={styles.secondaryButton}
              >
                Back to review
              </Button>
            </Paper>
          ) : (
            <PaymentWrapper checkout={checkout} />
          )}
        </Container>
      </CheckoutPage>
    </>
  );
}
