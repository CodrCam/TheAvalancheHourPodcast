// /pages/store/cart.js
import * as React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Container,
  Box,
  Grid,
  Paper,
  Typography,
  IconButton,
  Button,
  Divider
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import Navbar from '../../components/Navbar';

const CART_KEY = 'ah_cart';

function money(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

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
    // ignore if events are blocked
  }
}

export default function CartPage() {
  const router = useRouter();
  const [items, setItems] = React.useState([]);
  const [inventoryMessage, setInventoryMessage] = React.useState('');
  const [inventoryUnavailable, setInventoryUnavailable] = React.useState(false);
  const [stockBySku, setStockBySku] = React.useState({});
  const [checkingInventory, setCheckingInventory] = React.useState(false);

  React.useEffect(() => {
    setItems(readCart());
  }, []);

  React.useEffect(() => {
    if (!items.length) {
      setInventoryMessage('');
      setInventoryUnavailable(false);
      setStockBySku({});
      return;
    }

    let ignore = false;

    async function validateCart() {
      const skus = [...new Set(items.map((item) => item.sku).filter(Boolean))];
      if (!skus.length) return;

      setCheckingInventory(true);
      setInventoryUnavailable(false);
      try {
        const query = skus.map(encodeURIComponent).join(',');
        const res = await fetch(`/api/stock?sku=${query}`);
        const data = await res.json();
        if (ignore) return;

        if (!res.ok || data.ok === false) {
          setInventoryMessage('Inventory could not be checked. Please try again shortly.');
          setInventoryUnavailable(true);
          return;
        }

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
          writeCart(nextItems);
          setItems(nextItems);
          setInventoryMessage('Your cart was adjusted to the currently available stock.');
        } else {
          setInventoryMessage('');
        }
      } catch {
        if (!ignore) {
          setInventoryMessage('Inventory could not be checked. Please try again shortly.');
          setInventoryUnavailable(true);
        }
      } finally {
        if (!ignore) setCheckingInventory(false);
      }
    }

    validateCart();

    return () => {
      ignore = true;
    };
  }, [items]);

  const updateQty = (key, next) => {
    setItems((prev) => {
      const copy = prev.map((i) => ({ ...i }));
      const it = copy.find((i) => i.key === key);
      if (!it) return prev;
      const available =
        it.sku && Number.isFinite(stockBySku[it.sku])
          ? stockBySku[it.sku]
          : it.sku
            ? it.qty || 1
          : 100;
      it.qty = Math.max(1, Math.min(available, parseInt(next, 10) || 1));
      writeCart(copy);
      return copy;
    });
  };

  const removeItem = (key) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.key !== key);
      writeCart(next);
      return next;
    });
  };

  const subtotal = items.reduce((sum, it) => sum + (it.price || 0) * (it.qty || 0), 0);

  const goCheckout = () => {
    if (checkingInventory || inventoryUnavailable) return;
    router.push('/store/checkout');
  };

  return (
    <>
      <Head>
        <title>Cart — The Avalanche Hour</title>
        <meta name="description" content="Your shopping cart" />
      </Head>

      <Navbar />

      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Button
            component={Link}
            href="/store"
            size="small"
            startIcon={<ArrowBackIcon />}
          >
            Back to store
          </Button>
        </Box>

        <Typography variant="h4" sx={{ mb: 3 }}>
          Your Cart
        </Typography>

        {items.length === 0 ? (
          <Paper
            elevation={0}
            sx={{ p: 3, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
          >
            <Typography variant="h6" sx={{ mb: 1 }}>
              Your cart is empty
            </Typography>
            <Typography sx={{ color: 'text.secondary', mb: 2 }}>
              Add some merch and come back!
            </Typography>
            <Button component={Link} href="/store" variant="contained">
              Browse store
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={3}>
            {/* Left: line items */}
            <Grid item xs={12} md={8}>
              <Paper
                elevation={0}
                sx={{ p: { xs: 1, sm: 2 }, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}
              >
                {items.map((it, idx) => {
                  const available =
                    it.sku && Number.isFinite(stockBySku[it.sku])
                      ? stockBySku[it.sku]
                      : it.sku
                        ? it.qty || 1
                      : 100;
                  const atMax = it.qty >= available;
                  return (
                  <Box key={it.key} sx={{ py: 2 }}>
                    <Grid container spacing={2} alignItems="center">
                      <Grid item xs={3} sm={2}>
                        <Box
                          component="img"
                          src={it.image}
                          alt={it.name}
                          sx={{
                            width: '100%',
                            height: 'auto',
                            display: 'block',
                            borderRadius: 1,
                            border: '1px solid',
                            borderColor: 'divider'
                          }}
                        />
                      </Grid>

                      <Grid item xs={9} sm={6}>
                        {/* Outer Typography becomes a div to avoid <p> nesting */}
                        <Typography variant="body1" component="div" sx={{ fontWeight: 600 }}>
                          {it.name}
                        </Typography>

                        {/* Variant labels in a separate block */}
                        <Typography component="div" sx={{ color: 'text.secondary', fontSize: 14, mt: 0.5 }}>
                          {it?.options?.style ? <span>Style: {it.options.style}</span> : null}
                          {it?.options?.color ? <span>{' • '}Color: {it.options.color}</span> : null}
                          {it?.options?.size ? <span>{' • '}Size: {it.options.size}</span> : null}
                        </Typography>

                        {/* Price each */}
                        <Typography component="div" sx={{ fontSize: 14, mt: 0.5 }}>
                          {money(it.price)} each
                        </Typography>
                        {atMax && available < 100 ? (
                          <Typography component="div" sx={{ color: 'text.secondary', fontSize: 14, mt: 0.5 }}>
                            Maximum available quantity selected.
                          </Typography>
                        ) : null}
                      </Grid>

                      {/* Qty controls */}
                      <Grid item xs={12} sm={4}>
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: { xs: 'space-between', sm: 'flex-end' },
                            gap: 1
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton
                              size="small"
                              onClick={() => updateQty(it.key, (it.qty || 1) - 1)}
                              aria-label="Decrease quantity"
                              disabled={(it.qty || 1) <= 1}
                            >
                              <RemoveIcon fontSize="small" />
                            </IconButton>

                            <Box
                              component="input"
                              value={it.qty}
                              onChange={(e) => updateQty(it.key, e.target.value)}
                              type="number"
                              min={1}
                              max={available}
                              style={{
                                width: 56,
                                textAlign: 'center',
                                padding: '8px 6px',
                                borderRadius: 8,
                                border: '1px solid #ccc'
                              }}
                            />

                            <IconButton
                              size="small"
                              onClick={() => updateQty(it.key, (it.qty || 1) + 1)}
                              aria-label="Increase quantity"
                              disabled={atMax}
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Box>

                          {/* Line total */}
                          <Typography component="div" sx={{ fontWeight: 600, minWidth: 90, textAlign: 'right' }}>
                            {money((it.price || 0) * (it.qty || 0))}
                          </Typography>

                          <IconButton
                            color="error"
                            onClick={() => removeItem(it.key)}
                            aria-label={`Remove ${it.name}`}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </Grid>
                    </Grid>

                    {idx < items.length - 1 ? <Divider sx={{ mt: 2 }} /> : null}
                  </Box>
                );
                })}
              </Paper>
            </Grid>

            {/* Right: summary */}
            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, position: 'sticky', top: 88 }}
              >
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Order Summary
                </Typography>

                {/* Avoid <p> nesting by using component="div" */}
                <Typography component="div" sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <span>Subtotal</span>
                  <strong>{money(subtotal)}</strong>
                </Typography>

                <Typography component="div" sx={{ color: 'text.secondary', fontSize: 14, mb: 2 }}>
                  Shipping and taxes calculated at checkout.
                </Typography>
                {checkingInventory ? (
                  <Typography component="div" sx={{ color: 'text.secondary', fontSize: 14, mb: 1 }}>
                    Checking inventory...
                  </Typography>
                ) : null}
                {inventoryMessage ? (
                  <Typography component="div" sx={{ color: inventoryUnavailable ? 'error.main' : 'text.secondary', fontSize: 14, mb: 1 }}>
                    {inventoryMessage}
                  </Typography>
                ) : null}

                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<ShoppingCartCheckoutIcon />}
                  onClick={goCheckout}
                  disabled={checkingInventory || inventoryUnavailable}
                >
                  Checkout
                </Button>

                <Button
                  component={Link}
                  href="/store"
                  fullWidth
                  sx={{ mt: 1 }}
                  variant="outlined"
                >
                  Continue shopping
                </Button>
              </Paper>
            </Grid>
          </Grid>
        )}
      </Container>
    </>
  );
}
