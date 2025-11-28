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
  Divider,
  Grid,
} from '@mui/material';
import Navbar from '../../components/Navbar';

// Treat the argument as **dollars**, not cents
const money = (amount = 0) =>
  Number(amount || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });

export default function ThankYouPage() {
  const [meta, setMeta] = React.useState(null);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = sessionStorage.getItem('ah_last_order');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      setMeta(parsed);
    } catch {
      // ignore parse errors
    }
  }, []);

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

      <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 3 },
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 2,
          }}
        >
          <Typography variant="h4" sx={{ mb: 1 }}>
            Thank you for your order
          </Typography>

          {meta?.orderId ? (
            <Typography sx={{ color: 'text.secondary', mb: 2 }}>
              Order ID: <strong>{meta.orderId}</strong>
            </Typography>
          ) : null}

          {meta?.email ? (
            <Typography sx={{ color: 'text.secondary', mb: 2 }}>
              A receipt has been sent to <strong>{meta.email}</strong>.
            </Typography>
          ) : null}

          <Divider sx={{ my: 2 }} />

          {/* Payment summary */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
              Total paid
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {/* meta.amount is already dollars */}
              {money(meta?.amount ?? 0)}
            </Typography>
          </Box>

          {meta?.last4 ? (
            <Typography sx={{ color: 'text.secondary', mb: 2 }}>
              Paid with card ending in <strong>{meta.last4}</strong>.
            </Typography>
          ) : null}

          <Divider sx={{ my: 2 }} />

          {/* Order recap */}
          <Typography variant="h6" sx={{ mb: 1 }}>
            Order recap
          </Typography>

          {hasItems ? (
            <Box sx={{ display: 'grid', gap: 1.5, mb: 2 }}>
              {meta.items.map((it) => {
                const qty = Number(it.qty || 0);
                const priceCents = Number(it.price || 0);
                const lineTotalDollars = (priceCents * qty) / 100;

                return (
                  <Grid
                    container
                    key={
                      it.key ||
                      `${it.id}-${JSON.stringify(it.options || {})}`
                    }
                    alignItems="center"
                  >
                    <Grid item xs={8}>
                      <Typography
                        variant="body1"
                        sx={{ fontWeight: 600 }}
                      >
                        {it.name}
                      </Typography>
                      <Typography
                        sx={{ color: 'text.secondary', fontSize: 13 }}
                      >
                        {it?.options?.style ? (
                          <span>Style: {it.options.style}</span>
                        ) : null}
                        {it?.options?.color ? (
                          <span>{' • '}Color: {it.options.color}</span>
                        ) : null}
                        {it?.options?.size ? (
                          <span>{' • '}Size: {it.options.size}</span>
                        ) : null}
                        <span>{' • '}Qty: {qty}</span>
                      </Typography>
                    </Grid>
                    <Grid
                      item
                      xs={4}
                      sx={{ textAlign: 'right', fontWeight: 600 }}
                    >
                      {money(lineTotalDollars)}
                    </Grid>
                  </Grid>
                );
              })}
            </Box>
          ) : (
            <Typography sx={{ color: 'text.secondary', mb: 2 }}>
              We couldn&apos;t find the order details in this browser session,
              but your payment was successful.
            </Typography>
          )}

          <Divider sx={{ my: 2 }} />

          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              justifyContent: 'space-between',
            }}
          >
            <Link href="/store" legacyBehavior>
              <Button variant="outlined">Back to store</Button>
            </Link>
            <Button
              variant="text"
              onClick={() => window.print()}
              sx={{ ml: { xs: 0, md: 'auto' } }}
            >
              Print receipt
            </Button>
          </Box>
        </Paper>
      </Container>
    </>
  );
}