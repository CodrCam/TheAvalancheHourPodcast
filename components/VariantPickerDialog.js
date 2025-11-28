// components/VariantPickerDialog.js
import React from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, Button, ToggleButton, ToggleButtonGroup, TextField, Divider
} from '@mui/material';

const CART_KEY = 'ah_cart';

function readCart() {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); }
  catch { return []; }
}
function writeCart(items) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

/** Cart line-id (visual identity only; stock uses skuKey on server). */
function lineKey(id, options = {}) {
  const v = [];
  if (options.style) v.push(options.style);
  if (options.size)  v.push(options.size);
  if (options.color) v.push(options.color);
  return v.length ? `${id}|${v.join('|')}` : id;
}

/** Colors allowed for a given style; for products with no styles, returns base colors. */
function getColorsForStyle(product, style) {
  if (!product) return [];
  const base = Array.isArray(product.colors) ? product.colors : [];
  const variants = product.variants && typeof product.variants === 'object' ? product.variants : null;

  // No styles defined → just return base list (great for straps).
  if (!variants || !Array.isArray(product.styles) || !product.styles.length) return base;

  // Styles exist but none selected → safest to use base.
  if (!style || !variants[style]) return base;

  const scoped = variants[style]?.colors;
  return Array.isArray(scoped) ? scoped : base;
}

/** Pick best image for current (style,color) selection. */
function getVariantImage(product, { style, color }) {
  if (!product) return '';
  // 1) Strict style-scoped mapping
  const imgByColor = product?.variants?.[style]?.imageByColor;
  if (imgByColor && color && imgByColor[color]) return imgByColor[color];

  // 2) Generic color map
  if (product?.imageMap && color && product.imageMap[color]) return product.imageMap[color];

  // 3) Filename heuristic
  const imgs = Array.isArray(product.images) ? product.images : [];
  if (color) {
    const token = String(color).toLowerCase();
    const hit = imgs.find(src => String(src).toLowerCase().includes(token));
    if (hit) return hit;
  }

  // 4) Fallbacks
  return imgs[0] || product.image || '';
}

export default function VariantPickerDialog({ open, onClose, product, onAdded }) {
  // Defensive flags
  const hasStyles = Array.isArray(product?.styles) && product.styles.length > 0;
  const hasSizes  = Array.isArray(product?.sizes)  && product.sizes.length  > 0;

  // Initial defaults (safe even for straps: no styles → colors come from base list)
  const initialStyle  = hasStyles ? product.styles[0] : '';
  const initialColors = getColorsForStyle(product, initialStyle);
  const initialColor  = initialColors[0] || (Array.isArray(product?.colors) ? product.colors[0] : '');

  const [style, setStyle] = React.useState(initialStyle);
  const [size,  setSize]  = React.useState(hasSizes ? product.sizes[0] : '');
  const [color, setColor] = React.useState(initialColor);
  const [qty,   setQty]   = React.useState(1);

  // Re-init on open or product swap
  React.useEffect(() => {
    if (!open || !product) return;
    const s = hasStyles ? product.styles[0] : '';
    const allowed = getColorsForStyle(product, s);
    setStyle(s);
    setSize(hasSizes ? product.sizes[0] : '');
    setColor(allowed[0] || (Array.isArray(product?.colors) ? product.colors[0] : ''));
    setQty(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  // Keep color valid when changing style
  React.useEffect(() => {
    if (!product) return;
    const allowed = getColorsForStyle(product, style);
    if (allowed.length && !allowed.includes(color)) {
      setColor(allowed[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  if (!product) return null;

  const allowedColors = getColorsForStyle(product, style);
  const options = {};
  if (hasStyles) options.style = style;
  if (hasSizes)  options.size  = size;
  if (allowedColors.length) options.color = color;

  const mainImage = getVariantImage(product, options);

  const add = () => {
    const items = readCart();
    const key = lineKey(product.id, options);
    const nextQty = Math.max(1, Math.min(99, parseInt(qty, 10) || 1));
    const existing = items.find(i => i.key === key);

    if (existing) {
      existing.qty = Math.min(99, existing.qty + nextQty);
    } else {
      items.push({
        key,
        id: product.id,
        name: product.name,
        price: product.price,
        options,
        image: mainImage,
        qty: nextQty
      });
    }
    writeCart(items);
    onAdded?.();
    onClose?.();
  };

  const priceLabel = typeof product.price === 'number'
    ? (product.price / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : '';

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 0.5 }}>
        {product.name}{priceLabel ? ` — ${priceLabel}` : ''}
      </DialogTitle>

      <DialogContent dividers>
        {/* Responsive image + blurb */}
        <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <Box
            component="img"
            src={mainImage}
            alt={product.name}
            sx={{
              width: { xs: '100%', sm: 180 },
              height: { xs: 'auto',  sm: 180 },
              objectFit: 'cover',
              borderRadius: 2,
              border: '1px solid',
              borderColor: 'divider',
              flexShrink: 0
            }}
          />
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.6, flex: 1 }}>
            {product.description}
          </Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Style (hats, etc.) */}
        {hasStyles ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>Style</Typography>
            <ToggleButtonGroup
              exclusive size="small" value={style}
              onChange={(_, v) => v && setStyle(v)}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}
            >
              {product.styles.map(st => (
                <ToggleButton key={st} value={st}>{st}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        ) : null}

        {/* Color (works for straps; filters by style when styles exist) */}
        {allowedColors.length ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>Color</Typography>
            <ToggleButtonGroup
              exclusive size="small" value={color}
              onChange={(_, v) => v && setColor(v)}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}
            >
              {allowedColors.map(c => (
                <ToggleButton key={c} value={c}>{c}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        ) : null}

        {/* Size (hoodie, etc.) */}
        {hasSizes ? (
          <Box sx={{ mb: 2 }}>
            <Typography variant="overline" sx={{ color: 'text.secondary' }}>Size</Typography>
            <ToggleButtonGroup
              exclusive size="small" value={size}
              onChange={(_, v) => v && setSize(v)}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}
            >
              {product.sizes.map(s => (
                <ToggleButton key={s} value={s}>{s}</ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        ) : null}

        {/* Quantity */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="overline" sx={{ color: 'text.secondary' }}>Quantity</Typography>
          <TextField
            type="number" size="small" value={qty}
            inputProps={{ min: 1, max: 99 }}
            onChange={e => setQty(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
            sx={{ width: 100 }}
          />
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} variant="text">Cancel</Button>
        <Button onClick={add} variant="contained">Add to cart</Button>
      </DialogActions>
    </Dialog>
  );
}