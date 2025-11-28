// /pages/store/[slug].js
import React from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  Container,
  Grid,
  Box,
  Typography,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Paper
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { products } from '../../src/data/products';
import Navbar from '../../components/Navbar';

const CART_KEY = 'ah_cart';

function money(cents) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  });
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
    // ignore
  }
}

// Unique key per product + variant combination
function lineKey(id, options = {}) {
  const parts = [id];
  const v = [];
  if (options.style) v.push(options.style);
  if (options.size) v.push(options.size);
  if (options.color) v.push(options.color);
  return v.length ? `${parts[0]}|${v.join('|')}` : parts[0];
}

// Colors allowed for the given style
function getColorsForStyle(product, style) {
  if (!product) return [];
  const base = Array.isArray(product.colors) ? product.colors : [];
  if (product.variants && style && product.variants[style]?.colors) {
    return product.variants[style].colors;
  }
  return base;
}

/** Compute unit price based on selected options (supports variant-level pricing). */
function getUnitPrice(product, options = {}) {
  if (!product) return 0;
  const base = product.price || 0;
  const style = options.style;

  // If the current style has its own price (e.g. Voile 20" vs 25")
  if (
    style &&
    product.variants &&
    product.variants[style] &&
    typeof product.variants[style].price === 'number'
  ) {
    return product.variants[style].price;
  }

  // Fallback: normal products just use the product price
  return base;
}

// Best image for current style/color selection
function getVariantImage(product, { style, color }) {
  if (!product) return null;

  // 1) Strict: style-scoped imageByColor
  if (style && product.variants?.[style]?.imageByColor?.[color]) {
    return product.variants[style].imageByColor[color];
  }

  // 2) Generic color mapping
  if (product.imageMap?.[color]) return product.imageMap[color];

  // 3) Filename heuristic
  const imgs = Array.isArray(product.images) ? product.images : [];
  if (color) {
    const token = String(color).toLowerCase();
    const hit = imgs.find((src) => String(src).toLowerCase().includes(token));
    if (hit) return hit;
  }

  // 4) Fallbacks
  return imgs[0] || product.image || null;
}

export default function ProductSlugPage() {
  const router = useRouter();
  const { slug } = router.query;

  const product = React.useMemo(
    () => products.find((p) => p.slug === slug),
    [slug]
  );

  // Variant state (initialized once product is known)
  const [style, setStyle] = React.useState('');
  const [size, setSize] = React.useState('');
  const [color, setColor] = React.useState('');
  const [qty, setQty] = React.useState(1);

  // Gallery state
  const [selectedImage, setSelectedImage] = React.useState(null);

  // Initialize defaults when product changes
  React.useEffect(() => {
    if (!product) return;

    const firstStyle = product.styles?.[0] || '';
    const allowed = getColorsForStyle(product, firstStyle);
    const firstColor =
      (allowed && allowed[0]) ||
      (Array.isArray(product.colors) ? product.colors[0] : '') ||
      '';

    setStyle(firstStyle);
    setSize(product.sizes?.[0] || '');
    setColor(firstColor);
    setQty(1);
    setSelectedImage(null);
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep color valid whenever style changes
  React.useEffect(() => {
    if (!product) return;
    const allowed = getColorsForStyle(product, style);
    if (allowed?.length && !allowed.includes(color)) {
      setColor(allowed[0]);
    }
    setSelectedImage(null);
  }, [style, product]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!product) {
    // Could render a spinner or 404 here instead of null if you want
    return null;
  }

  const allowedColors = getColorsForStyle(product, style);

  const options = {};
  if (product.styles?.length && style) options.style = style;
  if (product.sizes?.length && size) options.size = size;
  if (allowedColors?.length && color) options.color = color;

  const unitPrice = getUnitPrice(product, options);

  const computedVariantImage = getVariantImage(product, options);
  const heroImage = selectedImage || computedVariantImage || product.image;

  function addToCart(goCheckout = false) {
    const items = readCart();
    const key = lineKey(product.id, options);
    const nextQty = Math.max(1, parseInt(qty, 10) || 1);

    const existing = items.find((i) => i.key === key);
    const imageForCart = heroImage;

    if (existing) {
      existing.qty = Math.min(existing.qty + nextQty, 99);
    } else {
      items.push({
        key,
        id: product.id,
        name: product.name,
        price: unitPrice,        // <<-- USE VARIANT PRICE HERE
        options,
        image: imageForCart,
        qty: nextQty
      });
    }

    writeCart(items);
    if (goCheckout) router.push('/store/checkout');
  }

  const allImages =
    Array.isArray(product.images) && product.images.length
      ? product.images
      : [product.image];

  return (
    <>
      <Head>
        <title>{product.name} — The Avalanche Hour</title>
        <meta name="description" content={product.description} />
      </Head>

      <Navbar />

      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <IconButton
            aria-label="Back to store"
            onClick={() => router.push('/store')}
            size="small"
          >
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }} />
          <Link href="/store/checkout" passHref legacyBehavior>
            <Button
              startIcon={<ShoppingCartIcon />}
              variant="outlined"
              size="small"
            >
              Cart
            </Button>
          </Link>
        </Box>

        <Grid container spacing={3}>
          {/* Gallery */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                p: 2,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2
              }}
            >
              <Box
                component="img"
                src={heroImage}
                alt={product.name}
                sx={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: 2,
                  display: 'block'
                }}
              />
              <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                {allImages.map((src) => (
                  <Box
                    key={src}
                    component="img"
                    src={src}
                    alt={product.name}
                    onClick={() => setSelectedImage(src)}
                    sx={{
                      width: 96,
                      height: 96,
                      objectFit: 'cover',
                      borderRadius: 1,
                      border: '2px solid',
                      borderColor:
                        heroImage === src ? 'primary.main' : 'divider',
                      cursor: 'pointer'
                    }}
                  />
                ))}
              </Box>
            </Paper>
          </Grid>

          {/* Details */}
          <Grid item xs={12} md={6}>
            <Typography variant="h4" sx={{ mb: 1 }}>
              {product.name}
            </Typography>
            <Typography variant="h6" sx={{ mb: 2 }}>
              {money(unitPrice)}   {/* <<-- SHOW VARIANT PRICE */}
            </Typography>
            <Typography sx={{ color: 'text.secondary', mb: 3 }}>
              {product.description}
            </Typography>

            {/* Style */}
            {product.styles?.length ? (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="overline"
                  sx={{ letterSpacing: 1, color: 'text.secondary' }}
                >
                  Style
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={style}
                  onChange={(_, v) => v && setStyle(v)}
                  sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}
                >
                  {product.styles.map((st) => (
                    <ToggleButton key={st} value={st}>
                      {st}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            ) : null}

            {/* Color */}
            {allowedColors?.length ? (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="overline"
                  sx={{ letterSpacing: 1, color: 'text.secondary' }}
                >
                  Color
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={color}
                  onChange={(_, v) => {
                    if (!v) return;
                    setColor(v);
                    const img = getVariantImage(product, {
                      style,
                      color: v
                    });
                    setSelectedImage(img || null);
                  }}
                  sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}
                >
                  {allowedColors.map((c) => (
                    <ToggleButton key={c} value={c}>
                      {c}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            ) : null}

            {/* Size */}
            {product.sizes?.length ? (
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="overline"
                  sx={{ letterSpacing: 1, color: 'text.secondary' }}
                >
                  Size
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={size}
                  onChange={(_, v) => v && setSize(v)}
                  sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}
                >
                  {product.sizes.map((s) => (
                    <ToggleButton key={s} value={s}>
                      {s}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            ) : null}

            {/* Quantity */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 2 }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
              >
                −
              </Button>
              <Box
                component="input"
                value={qty}
                onChange={(e) =>
                  setQty(
                    Math.max(
                      1,
                      Math.min(99, parseInt(e.target.value, 10) || 1)
                    )
                  )
                }
                type="number"
                min={1}
                max={99}
                style={{
                  width: 60,
                  textAlign: 'center',
                  padding: '8px 6px',
                  borderRadius: 8,
                  border: '1px solid #ccc'
                }}
              />
              <Button
                variant="outlined"
                size="small"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
              >
                +
              </Button>
            </Box>

            {/* Actions */}
            <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => addToCart(true)}
              >
                Buy now
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => addToCart(false)}
              >
                Add to cart
              </Button>
            </Box>

            <Box sx={{ mt: 3 }}>
              <Link href="/store" passHref legacyBehavior>
                <Button startIcon={<ArrowBackIcon />} size="small">
                  Back to store
                </Button>
              </Link>
            </Box>
          </Grid>
        </Grid>
      </Container>
    </>
  );
}