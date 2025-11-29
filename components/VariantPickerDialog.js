// components/VariantPickerDialog.js
import * as React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const CART_KEY = 'ah_cart';

function money(cents) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
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
    // ignore if events are blocked
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

  // 3) Fallbacks
  const imgs = Array.isArray(product.images) ? product.images : [];
  return imgs[0] || product.image || null;
}

export default function VariantPickerDialog({
  open,
  onClose,
  product,
  onAdded,
}) {
  const [style, setStyle] = React.useState('');
  const [size, setSize] = React.useState('');
  const [color, setColor] = React.useState('');

  // When product changes or dialog opens, reset defaults
  React.useEffect(() => {
    if (!product || !open) return;

    const firstStyle = product.styles?.[0] || '';
    const allowed = getColorsForStyle(product, firstStyle);
    const firstColor =
      (allowed && allowed[0]) ||
      (Array.isArray(product.colors) ? product.colors[0] : '') ||
      '';

    setStyle(firstStyle);
    setSize(product.sizes?.[0] || '');
    setColor(firstColor);
  }, [product, open]);

  if (!product) {
    return null;
  }

  const allowedColors = getColorsForStyle(product, style);

  const options = {};
  if (product.styles?.length && style) options.style = style;
  if (product.sizes?.length && size) options.size = size;
  if (allowedColors?.length && color) options.color = color;

  const unitPrice = getUnitPrice(product, options);
  const heroImage =
    getVariantImage(product, { style: options.style, color: options.color }) ||
    product.image;

  const handleAdd = () => {
    const items = readCart();
    const key = lineKey(product.id, options);
    const existing = items.find((i) => i.key === key);

    if (existing) {
      existing.qty = Math.min((existing.qty || 1) + 1, 99);
      existing.price = unitPrice; // keep price in sync with variant
    } else {
      items.push({
        key,
        id: product.id,
        name: product.name,
        price: unitPrice, // IMPORTANT: variant-aware price
        options,
        image: heroImage,
        qty: 1,
      });
    }

    writeCart(items);
    if (onAdded) onAdded();
    if (onClose) onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          {product.name}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start' }}>
          <Box
            component="img"
            src={heroImage}
            alt={product.name}
            sx={{
              width: 120,
              height: 120,
              objectFit: 'cover',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              flexShrink: 0,
            }}
          />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="subtitle1" sx={{ mb: 0.5 }}>
              {money(unitPrice)}
            </Typography>
            <Typography
              variant="body2"
              sx={{ color: 'text.secondary' }}
              noWrap
            >
              {product.description}
            </Typography>
          </Box>
        </Box>

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
              onChange={(_, v) => v && setColor(v)}
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
          <Box sx={{ mb: 1 }}>
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
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd}>
          Add to cart
        </Button>
      </DialogActions>
    </Dialog>
  );
}