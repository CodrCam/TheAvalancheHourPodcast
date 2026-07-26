// /pages/store/cart.js
import * as React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  Container,
  Box,
  Paper,
  Typography,
  IconButton,
  Button
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingCartCheckoutIcon from '@mui/icons-material/ShoppingCartCheckout';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ShoppingBagOutlinedIcon from '@mui/icons-material/ShoppingBagOutlined';
import Navbar from '../../components/Navbar';
import {
  CheckoutHero,
  CheckoutPage,
  optionLabel,
} from '../../components/CheckoutFlow';
import styles from '../../styles/Checkout.module.css';

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

      <CheckoutPage>
        <CheckoutHero
          currentStep={1}
          title="Pack your field kit."
          description="Confirm the pieces you want, then we’ll collect the details needed to get them headed your way."
        />

        <Container maxWidth="lg" className={styles.content}>
          <Button
            component={Link}
            href="/store"
            startIcon={<ArrowBackIcon />}
            className={styles.backLink}
          >
            Keep browsing the current drop
          </Button>

          {items.length === 0 ? (
            <Paper elevation={0} className={styles.emptyPanel}>
              <Box>
                <span className={styles.emptyIcon}>
                  <ShoppingBagOutlinedIcon />
                </span>
                <Typography component="h2" className={styles.emptyTitle}>
                  Your field kit is empty.
                </Typography>
                <Typography className={styles.emptyCopy}>
                  Head back to the current drop and find something that carries
                  the conversation.
                </Typography>
                <Button
                  component={Link}
                  href="/store"
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  className={styles.primaryButton}
                >
                  Explore the shop
                </Button>
              </Box>
            </Paper>
          ) : (
            <Box className={styles.layout}>
              <Paper elevation={0} className={`${styles.panel} ${styles.mainColumn}`}>
                <Box className={styles.panelHeader}>
                  <Box>
                    <Typography component="p" className={styles.panelEyebrow}>
                      Selected goods
                    </Typography>
                    <Typography component="h2" className={styles.panelTitle}>
                      Your cart
                    </Typography>
                  </Box>
                  <span className={styles.panelCount}>
                    {items.reduce((sum, item) => sum + (item.qty || 0), 0)}{' '}
                    {items.reduce((sum, item) => sum + (item.qty || 0), 0) === 1
                      ? 'item'
                      : 'items'}
                  </span>
                </Box>

                <Box className={styles.cartItems}>
                  {items.map((it) => {
                    const available =
                      it.sku && Number.isFinite(stockBySku[it.sku])
                        ? stockBySku[it.sku]
                        : it.sku
                          ? it.qty || 1
                          : 100;
                    const atMax = it.qty >= available;

                    return (
                      <Box key={it.key} className={styles.cartLine}>
                        <Box className={styles.cartImageWrap}>
                          <Box
                            component="img"
                            src={it.image}
                            alt={it.name}
                            className={styles.cartImage}
                          />
                        </Box>

                        <Box>
                          <Typography component="h3" className={styles.cartName}>
                            {it.name}
                          </Typography>
                          {optionLabel(it.options) ? (
                            <Typography className={styles.cartOptions}>
                              {optionLabel(it.options)}
                            </Typography>
                          ) : null}
                          <Typography className={styles.unitPrice}>
                            {money(it.price)} each
                          </Typography>
                          {atMax && available < 100 ? (
                            <Typography className={styles.stockMessage}>
                              Maximum available quantity selected.
                            </Typography>
                          ) : null}
                        </Box>

                        <Box className={styles.cartLineActions}>
                          <Typography className={styles.lineTotal}>
                            {money((it.price || 0) * (it.qty || 0))}
                          </Typography>
                          <Box className={styles.quantityAndRemove}>
                            <Box className={styles.quantityControl}>
                              <IconButton
                                onClick={() =>
                                  updateQty(it.key, (it.qty || 1) - 1)
                                }
                                aria-label={`Decrease ${it.name} quantity`}
                                disabled={(it.qty || 1) <= 1}
                                className={styles.quantityButton}
                              >
                                <RemoveIcon fontSize="small" />
                              </IconButton>
                              <input
                                value={it.qty}
                                onChange={(event) =>
                                  updateQty(it.key, event.target.value)
                                }
                                type="number"
                                min={1}
                                max={available}
                                aria-label={`${it.name} quantity`}
                                className={styles.quantityInput}
                              />
                              <IconButton
                                onClick={() =>
                                  updateQty(it.key, (it.qty || 1) + 1)
                                }
                                aria-label={`Increase ${it.name} quantity`}
                                disabled={atMax}
                                className={styles.quantityButton}
                              >
                                <AddIcon fontSize="small" />
                              </IconButton>
                            </Box>
                            <IconButton
                              onClick={() => removeItem(it.key)}
                              aria-label={`Remove ${it.name}`}
                              className={styles.removeButton}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                      </Box>
                    );
                  })}
                </Box>
              </Paper>

              <Box className={styles.sideColumn}>
                <Paper elevation={0} className={styles.summaryCard}>
                  <Box className={styles.summaryTop}>
                    <Typography component="p" className={styles.summaryEyebrow}>
                      Order overview
                    </Typography>
                    <Typography component="h2" className={styles.summaryTitle}>
                      Ready for the next step?
                    </Typography>
                  </Box>
                  <Box className={styles.summaryBody}>
                    <Box className={styles.summaryRows}>
                      <Box className={styles.summaryRow}>
                        <span>Merch subtotal</span>
                        <strong>{money(subtotal)}</strong>
                      </Box>
                    </Box>
                    <Box className={styles.summaryTotal}>
                      <span>Subtotal</span>
                      <strong>{money(subtotal)}</strong>
                    </Box>
                    <Typography className={styles.summaryNote}>
                      Shipping is calculated before payment.
                    </Typography>
                    <Box
                      className={styles.summaryStatus}
                      role={inventoryMessage ? 'status' : undefined}
                    >
                      <span
                        className={`${styles.statusDot} ${
                          inventoryUnavailable ? styles.statusDotWarning : ''
                        }`}
                        aria-hidden="true"
                      />
                      <span>
                        {checkingInventory
                          ? 'Confirming current availability…'
                          : inventoryMessage ||
                            'Availability will be confirmed again before payment.'}
                      </span>
                    </Box>
                    <Button
                      fullWidth
                      variant="contained"
                      endIcon={<ShoppingCartCheckoutIcon />}
                      onClick={goCheckout}
                      disabled={checkingInventory || inventoryUnavailable}
                      className={styles.primaryButton}
                    >
                      Continue to shipping
                    </Button>
                    <Button
                      component={Link}
                      href="/store"
                      fullWidth
                      variant="outlined"
                      className={styles.secondaryButton}
                    >
                      Continue shopping
                    </Button>
                  </Box>
                </Paper>
              </Box>
            </Box>
          )}
        </Container>
      </CheckoutPage>
    </>
  );
}
