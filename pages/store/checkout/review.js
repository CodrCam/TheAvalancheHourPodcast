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
  TextField,
  Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import VerifiedUserOutlinedIcon from '@mui/icons-material/VerifiedUserOutlined';
import Navbar from '../../../components/Navbar';
import {
  CheckoutHero,
  CheckoutPage,
  optionLabel,
} from '../../../components/CheckoutFlow';
import { ecommerceEvent } from '../../../lib/gtag';
import { getOptimizedPublicImage } from '../../../lib/publicImage.mjs';
import styles from '../../../styles/Checkout.module.css';
import {
  CART_KEY,
  CHECKOUT_ATTEMPT_KEY,
  CHECKOUT_DISCOUNT_KEY,
  CHECKOUT_EMAIL_KEY,
  CHECKOUT_PAYMENT_KEY,
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

function writeCart(items) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event('ah_cart_updated'));
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
  const [orderId, setOrderId] = React.useState(null);
  const [breakdown, setBreakdown] = React.useState(null);
  const [checkoutAttemptId, setCheckoutAttemptId] = React.useState('');

  const [loading, setLoading] = React.useState(true);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [inventoryProblems, setInventoryProblems] = React.useState([]);
  const [stockBySku, setStockBySku] = React.useState({});

  // Load cart + shipping/email from storage
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    const cartItems = readCart();

    let shippingData = null;
    let emailData = '';
    try {
      const sRaw = sessionStorage.getItem(CHECKOUT_SHIPPING_KEY);
      const eRaw = sessionStorage.getItem(CHECKOUT_EMAIL_KEY);
      const dRaw = sessionStorage.getItem(CHECKOUT_DISCOUNT_KEY);
      let attemptId = sessionStorage.getItem(CHECKOUT_ATTEMPT_KEY);
      if (!attemptId) {
        attemptId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        sessionStorage.setItem(CHECKOUT_ATTEMPT_KEY, attemptId);
      }
      shippingData = sRaw ? JSON.parse(sRaw) : null;
      emailData = eRaw || '';
      setCheckoutAttemptId(attemptId);
      if (dRaw) {
        setDiscountInput(dRaw);
        setAppliedDiscountCode(dRaw);
      }
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

  React.useEffect(() => {
    if (!items.length) {
      setStockBySku({});
      return;
    }

    const skus = [...new Set(items.map((item) => item.sku).filter(Boolean))];
    if (!skus.length) return;

    let ignore = false;

    async function syncStock() {
      try {
        const query = skus.map(encodeURIComponent).join(',');
        const res = await fetch(`/api/stock?sku=${query}`);
        const data = await res.json();
        if (ignore || !res.ok || data.ok === false) return;

        const nextStock = Object.fromEntries(skus.map((sku) => [sku, 0]));
        for (const row of data.data || []) {
          const sku = row.sku || row.sku_key;
          nextStock[sku] = row.hidden ? 0 : Math.max(0, Number(row.quantity) || 0);
        }
        setStockBySku(nextStock);

        let adjusted = false;
        const nextItems = items
          .map((item) => {
            if (!item.sku || !(item.sku in nextStock)) return item;
            const available = nextStock[item.sku];
            if (available <= 0) {
              adjusted = true;
              return null;
            }
            const qty = Math.min(item.qty || 1, available);
            if (qty !== item.qty) adjusted = true;
            return { ...item, qty };
          })
          .filter(Boolean);

        if (adjusted) {
          setItems(nextItems);
          setInventoryProblems([]);
          writeCart(nextItems);
          if (!nextItems.length) router.push('/store/cart');
        }
      } catch {
        // The final payment-intent request still validates stock server-side.
      }
    }

    syncStock();

    return () => {
      ignore = true;
    };
  }, [items, router]);

  // Whenever we have items + shipping, (re)create the PaymentIntent
  React.useEffect(() => {
    if (!items.length || !shipping || !checkoutAttemptId) return;

    let ignore = false;

    async function prepareOrder() {
      setLoading(true);
      setErrorMsg('');
      setClientSecret(null);
      setIntentId(null);
      setOrderId(null);
      setInventoryProblems([]);

      try {
        const res = await fetch('/api/store/create-payment-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            email,
            shipping,
            discountCode: appliedDiscountCode || null,
            checkoutAttemptId,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (res.status === 409 && Array.isArray(data?.details)) {
            setInventoryProblems(data.details);
            setClientSecret(null);
            setIntentId(null);
            setOrderId(null);
            setBreakdown(null);
            setErrorMsg(
              'Some quantities are no longer available. Update or remove those items before payment.'
            );
            setLoading(false);
            return;
          }

          setErrorMsg(
            data?.error || 'We could not prepare this order. Please try again.'
          );
          setLoading(false);
          return;
        }

        if (ignore) return;

        setInventoryProblems([]);
        if (
          !data.clientSecret ||
          !data.intentId ||
          !data.orderId ||
          !data.breakdown
        ) {
          throw new Error('The payment service returned an incomplete order.');
        }

        setClientSecret(data.clientSecret);
        setIntentId(data.intentId);
        setOrderId(data.orderId);
        setBreakdown(data.breakdown);
        try {
          if (data.breakdown.discountCode) {
            sessionStorage.setItem(
              CHECKOUT_DISCOUNT_KEY,
              data.breakdown.discountCode
            );
          } else {
            sessionStorage.removeItem(CHECKOUT_DISCOUNT_KEY);
          }
        } catch {
          // The payment snapshot write below is the required storage check.
        }
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
  }, [items, shipping, email, appliedDiscountCode, checkoutAttemptId]);

  function handleRemoveItem(key) {
    const next = items.filter((it) => it.key !== key);
    setItems(next);
    writeCart(next);
    if (!next.length) {
      router.push('/store/cart');
    }
  }

  function handleQtyChange(key, qty) {
    const next = items.map((it) =>
      it.key === key
        ? {
            ...it,
            qty: Math.max(
              1,
              Math.min(
                it.sku && Number.isFinite(stockBySku[it.sku])
                  ? stockBySku[it.sku]
                  : it.sku
                    ? it.qty || 1
                    : 99,
                qty || 1
              )
            ),
          }
        : it
    );
    setItems(next);
    writeCart(next);
  }

  const problemBySku = React.useMemo(() => {
    return new Map(inventoryProblems.map((p) => [p.key || p.sku, p]));
  }, [inventoryProblems]);

  async function handleContinueToPayment() {
    if (!clientSecret || !intentId || !orderId || !breakdown) return;

    ecommerceEvent('add_shipping_info', {
      items,
      value: (breakdown.totalCents || 0) / 100,
      shipping_tier: breakdown.shippingWaived
        ? 'Shipping waived'
        : 'Flat rate',
    });

    try {
      if (typeof window !== 'undefined') {
        // IMPORTANT: key must match CHECKOUT_PAYMENT_KEY in src/config/store.js
        sessionStorage.setItem(
          CHECKOUT_PAYMENT_KEY,
          JSON.stringify({
            clientSecret,
            intentId,
            orderId,
            breakdown,
            discountCode: breakdown.discountCode || null,
            items,
            email,
            shipping,
          })
        );
      }
    } catch {
      setErrorMsg(
        'This browser could not save the secure payment step. Please enable site data or try a standard browsing window.'
      );
      return;
    }

    router.push('/store/checkout/payment');
  }

  const subtotalCents = breakdown?.subtotalCents ?? 0;
  const discountCents = breakdown?.discountAmountCents ?? 0;
  const taxCents = breakdown?.taxAmountCents ?? 0;
  const shippingCents = breakdown?.shippingCents ?? 0; // NEW: show shipping on Review
  const shippingWaived = Boolean(breakdown?.shippingWaived);
  const totalCents = breakdown?.totalCents ?? 0;
  const cartSubtotalCents = items.reduce(
    (sum, item) => sum + (item.price || 0) * (item.qty || 0),
    0
  );

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

      <CheckoutPage>
        <CheckoutHero
          currentStep={3}
          title="Check the route."
          description="Review the destination, quantities, and final order total before opening the secure payment step."
        />

        <Container maxWidth="lg" className={styles.content}>
          <Button
            component={Link}
            href="/store/checkout/shipping"
            startIcon={<ArrowBackIcon />}
            className={styles.backLink}
          >
            Back to shipping
          </Button>

          {errorMsg ? (
            <Box role="alert" className={styles.errorNotice} sx={{ mb: 2.5 }}>
              {errorMsg}
            </Box>
          ) : null}

          <Box className={styles.layout}>
            <Box className={styles.mainColumn}>
              <Paper elevation={0} className={styles.panel}>
                <Box className={styles.panelHeader}>
                  <Box>
                    <Typography component="p" className={styles.panelEyebrow}>
                      Destination
                    </Typography>
                    <Typography component="h2" className={styles.panelTitle}>
                      Contact &amp; shipping
                    </Typography>
                  </Box>
                </Box>
                {shipping ? (
                  <Box className={styles.addressPanel}>
                    <Typography component="div" className={styles.addressText}>
                      <strong>{shipping.name}</strong>
                      {email}
                      <br />
                      {shipping.line1}
                      {shipping.line2 ? `, ${shipping.line2}` : ''}
                      <br />
                      {shipping.city}, {shipping.state} {shipping.postal_code}
                      <br />
                      {shipping.country}
                    </Typography>
                    <Link
                      href="/store/checkout/shipping"
                      className={styles.editLink}
                    >
                      Edit details
                    </Link>
                  </Box>
                ) : (
                  <Box className={styles.notice}>
                    Shipping details are missing. Return to the previous step to
                    continue.
                  </Box>
                )}
              </Paper>

              <Paper elevation={0} className={styles.panel}>
                <Box className={styles.panelHeader}>
                  <Box>
                    <Typography component="p" className={styles.panelEyebrow}>
                      Field goods
                    </Typography>
                    <Typography component="h2" className={styles.panelTitle}>
                      Review your items
                    </Typography>
                  </Box>
                  <span className={styles.panelCount}>
                    {items.reduce((sum, item) => sum + (item.qty || 0), 0)} items
                  </span>
                </Box>

                <Box>
                  {items.map((it) => {
                    const problem =
                      problemBySku.get(it.key) || problemBySku.get(it.sku);
                    const available =
                      it.sku && Number.isFinite(stockBySku[it.sku])
                        ? stockBySku[it.sku]
                        : it.sku
                          ? it.qty || 1
                          : 99;
                    const atMax = it.qty >= available && available < 99;

                    return (
                      <Box key={it.key} className={styles.reviewItem}>
                        <Box
                          component="img"
                          src={getOptimizedPublicImage(it.image)}
                          alt={it.name}
                          loading="lazy"
                          decoding="async"
                          className={styles.reviewImage}
                        />
                        <Box>
                          <Typography component="h3" className={styles.cartName}>
                            {it.name}
                          </Typography>
                          {optionLabel(it.options) ? (
                            <Typography className={styles.cartOptions}>
                              {optionLabel(it.options)}
                            </Typography>
                          ) : null}
                          {problem ? (
                            <Typography className={styles.stockMessage}>
                              {problem.available > 0
                                ? 'Only limited stock remains for this item.'
                                : 'This item is no longer available.'}
                            </Typography>
                          ) : null}
                          {!problem && atMax ? (
                            <Typography className={styles.stockMessage}>
                              Maximum available quantity selected.
                            </Typography>
                          ) : null}
                        </Box>
                        <Box className={styles.reviewItemActions}>
                          <Typography className={styles.lineTotal}>
                            {money(it.price * it.qty)}
                          </Typography>
                          <Box className={styles.reviewQty}>
                            <span>Qty</span>
                            <input
                              type="number"
                              min={1}
                              max={available}
                              value={it.qty}
                              onChange={(event) =>
                                handleQtyChange(
                                  it.key,
                                  parseInt(event.target.value, 10) || 1
                                )
                              }
                              aria-label={`${it.name} quantity`}
                              className={styles.reviewQtyInput}
                            />
                          </Box>
                          <Button
                            onClick={() => handleRemoveItem(it.key)}
                            className={styles.removeText}
                          >
                            Remove
                          </Button>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>

              <Paper elevation={0} className={styles.panel}>
                <Box className={styles.panelHeader}>
                  <Box>
                    <Typography component="p" className={styles.panelEyebrow}>
                      Have a code?
                    </Typography>
                    <Typography component="h2" className={styles.panelTitle}>
                      Discount
                    </Typography>
                  </Box>
                </Box>
                <Box className={styles.discountForm}>
                  <TextField
                    label="Discount code"
                    value={discountInput}
                    onChange={(event) => setDiscountInput(event.target.value)}
                    placeholder="Optional discount or event code"
                    className={styles.field}
                  />
                  <Button
                    variant="outlined"
                    onClick={() =>
                      setAppliedDiscountCode(discountInput.trim().toUpperCase())
                    }
                    className={styles.applyButton}
                  >
                    Apply
                  </Button>
                </Box>
              </Paper>
            </Box>

            <Box className={styles.sideColumn}>
              <Paper elevation={0} className={styles.summaryCard}>
                <Box className={styles.summaryTop}>
                  <Typography component="p" className={styles.summaryEyebrow}>
                    Final check
                  </Typography>
                  <Typography component="h2" className={styles.summaryTitle}>
                    Order total
                  </Typography>
                </Box>
                <Box className={styles.summaryBody}>
                  <Box className={styles.summaryRows}>
                    <Box className={styles.summaryRow}>
                      <span>Subtotal</span>
                      <strong>
                        {money(breakdown ? subtotalCents : cartSubtotalCents)}
                      </strong>
                    </Box>
                    {discountCents > 0 ? (
                      <Box
                        className={`${styles.summaryRow} ${styles.discountRow}`}
                      >
                        <span>{discountLabel}</span>
                        <strong>-{money(discountCents)}</strong>
                      </Box>
                    ) : null}
                    <Box className={styles.summaryRow}>
                      <span>Shipping</span>
                      <strong>
                        {loading
                          ? '—'
                          : shippingWaived
                            ? 'Waived'
                            : money(shippingCents)}
                      </strong>
                    </Box>
                {taxCents > 0 ? (
                  <Box className={styles.summaryRow}>
                    <span>Tax</span>
                    <strong>{loading ? '—' : money(taxCents)}</strong>
                  </Box>
                ) : null}
                  </Box>
                  <Box className={styles.summaryTotal}>
                    <span>Total</span>
                    <strong>{loading ? '—' : money(totalCents)}</strong>
                  </Box>
                  <Box className={styles.summaryStatus}>
                    <span
                      className={`${styles.statusDot} ${
                        errorMsg ? styles.statusDotWarning : ''
                      }`}
                      aria-hidden="true"
                    />
                    <span>
                      {loading
                        ? 'Preparing your secure order total…'
                        : errorMsg
                          ? 'The order needs attention before payment.'
                          : 'Inventory and pricing are confirmed for payment.'}
                    </span>
                  </Box>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleContinueToPayment}
                    disabled={
                      !clientSecret ||
                      !intentId ||
                      !orderId ||
                      !breakdown ||
                      loading
                    }
                    endIcon={<ArrowForwardRoundedIcon />}
                    className={styles.primaryButton}
                  >
                    Continue to secure payment
                  </Button>
                  <Box className={styles.trustRow}>
                    <VerifiedUserOutlinedIcon />
                    <span>
                      The amount shown here is calculated on the server, not
                      trusted from the browser.
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
