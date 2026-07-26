// /pages/store/thank-you.js
import * as React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  Container,
  Typography,
  Button,
  Paper,
  Box,
} from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import Navbar from '../../components/Navbar';
import {
  CheckoutHero,
  CheckoutPage,
  optionLabel,
} from '../../components/CheckoutFlow';
import { LAST_ORDER_KEY } from '../../src/config/store';
import { ecommerceEvent } from '../../lib/gtag';
import styles from '../../styles/Checkout.module.css';

// Treat the argument as **dollars**, not cents
const money = (amount = 0) =>
  Number(amount || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

function getOrderAmountDollars(meta) {
  if (typeof meta?.amountCents === 'number') return meta.amountCents / 100;
  if (typeof meta?.amount === 'number') return meta.amount;
  return 0;
}

export default function ThankYouPage() {
  const [meta, setMeta] = React.useState(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem(LAST_ORDER_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setMeta(parsed);
    } catch {
      // ignore parse errors
    }
  }, []);

  React.useEffect(() => {
    if (!meta || typeof window === 'undefined') return;

    const transactionId = meta.orderId || meta.paymentIntentId || '';
    const purchaseKey = transactionId
      ? `ah_ga_purchase_${transactionId}`
      : 'ah_ga_purchase_latest';

    try {
      if (sessionStorage.getItem(purchaseKey)) return;
      sessionStorage.setItem(purchaseKey, '1');
    } catch {
      // If session storage is unavailable, still try to record the purchase once.
    }

    ecommerceEvent('purchase', {
      transaction_id: transactionId,
      value: getOrderAmountDollars(meta),
      items: Array.isArray(meta.items) ? meta.items : [],
    });
  }, [meta]);

  const hasItems = !!meta && Array.isArray(meta.items) && meta.items.length > 0;

  return (
    <>
      <Head>
        <title>Thank you — The Avalanche Hour Store</title>
        <meta
          name="description"
          content="Order confirmation for The Avalanche Hour Store"
        />
      </Head>

      <Navbar />

      <CheckoutPage>
        <CheckoutHero
          currentStep={5}
          complete
          eyebrow="Order confirmed"
          title="Your support is on its way."
          description="Thanks for backing independent conversations that make avalanche communities more informed, connected, and honest."
        />

        <Container maxWidth="md" className={styles.content}>
          <Paper elevation={0} className={styles.confirmationCard}>
            <Box className={styles.confirmationMain}>
              <span className={styles.confirmationIcon}>
                <CheckRoundedIcon fontSize="large" />
              </span>
              <Typography component="p" className={styles.confirmationEyebrow}>
                Payment confirmed
              </Typography>
              <Typography component="h2" className={styles.confirmationTitle}>
                Thank you for your order.
              </Typography>
              <Typography className={styles.confirmationCopy}>
                {meta?.email ? (
                  <>
                    A receipt and order confirmation have been sent to{' '}
                    <strong>{meta.email}</strong>.
                  </>
                ) : (
                  <>
                    Your payment was successful. Your Stripe receipt is the
                    durable confirmation for this order.
                  </>
                )}
              </Typography>
              {meta?.orderId ? (
                <span className={styles.orderReference}>
                  Order <strong>{meta.orderId}</strong>
                </span>
              ) : null}
            </Box>

            <Box className={styles.confirmationDetails}>
              <Box className={styles.confirmationItems}>
                <Typography component="p" className={styles.panelEyebrow}>
                  What you packed
                </Typography>
                <Typography component="h2" className={styles.panelTitle}>
                  Order recap
                </Typography>

                {hasItems ? (
                  <Box sx={{ mt: 2 }}>
                    {meta.items.map((it) => {
                      const qty = Number(it.qty || 0);
                      const priceCents = Number(it.price || 0);
                      const lineTotalDollars = (priceCents * qty) / 100;

                      return (
                        <Box
                          key={
                            it.key ||
                            `${it.id}-${JSON.stringify(it.options || {})}`
                          }
                          className={styles.confirmationLine}
                        >
                          <Box>
                            <Typography className={styles.confirmationLineName}>
                              {it.name} × {qty}
                            </Typography>
                            {optionLabel(it.options) ? (
                              <Typography className={styles.miniOptions}>
                                {optionLabel(it.options)}
                              </Typography>
                            ) : null}
                          </Box>
                          <strong>{money(lineTotalDollars)}</strong>
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <Typography className={styles.summaryNote}>
                    We couldn&apos;t find the item details in this browser
                    session, but your payment was successful.
                  </Typography>
                )}
              </Box>

              <Box className={styles.confirmationTotal}>
                <Typography component="p" className={styles.panelEyebrow}>
                  Payment
                </Typography>
                <Box className={styles.summaryTotal}>
                  <span>Total paid</span>
                  <strong>{money(getOrderAmountDollars(meta))}</strong>
                </Box>
                {meta?.last4 ? (
                  <Typography className={styles.summaryNote}>
                    Paid with card ending in <strong>{meta.last4}</strong>.
                  </Typography>
                ) : null}
                <Box className={styles.confirmationActions}>
                  <Button
                    component={Link}
                    href="/store"
                    variant="contained"
                    endIcon={<ArrowForwardRoundedIcon />}
                    className={styles.primaryButton}
                  >
                    Back to store
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PrintOutlinedIcon />}
                    onClick={() => window.print()}
                    className={styles.secondaryButton}
                  >
                    Print receipt
                  </Button>
                </Box>
              </Box>
            </Box>

            <Box className={styles.missionNote}>
              <strong>Your purchase supports the signal.</strong> It helps keep
              long-form avalanche conversations independent and moving through
              the community.
            </Box>
          </Paper>
        </Container>
      </CheckoutPage>
    </>
  );
}
