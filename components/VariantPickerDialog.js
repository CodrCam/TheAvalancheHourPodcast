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
import {
  getProductSkuEntries,
  getProductSkus,
  getSelectableColors,
  getSelectableSizes,
  getSelectableStyles,
  getSkuForOptions,
  getUnitPrice,
  getVariantImage,
} from '../lib/productCatalog';

const CART_KEY = 'ah_cart';
const LOW_STOCK_THRESHOLD = 5;

function readStockQuantity(record) {
  if (!record || record.hidden) return 0;
  return Math.max(0, Number(record.quantity) || 0);
}

function money(cents) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function getStockMessage({ stockError, stockLoaded, isHidden, isSoldOut, quantity }) {
  if (stockError) return 'Inventory unavailable';
  if (!stockLoaded) return 'Checking inventory...';
  if (isHidden) return 'Not currently listed';
  if (isSoldOut) return 'Sold out';
  return quantity > 0 && quantity < LOW_STOCK_THRESHOLD ? 'Low stock' : 'In stock';
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

export default function VariantPickerDialog({
  open,
  onClose,
  product,
  onAdded,
}) {
  const [style, setStyle] = React.useState('');
  const [size, setSize] = React.useState('');
  const [color, setColor] = React.useState('');
  const [stockMap, setStockMap] = React.useState({});
  const [stockLoaded, setStockLoaded] = React.useState(false);
  const [stockError, setStockError] = React.useState(false);
  const stockKnown = stockLoaded && !stockError;
  const productEntries = React.useMemo(
    () => getProductSkuEntries(product),
    [product]
  );
  const selectableEntries = React.useMemo(() => {
    if (!stockKnown) return productEntries;
    return productEntries.filter(
      (entry) => readStockQuantity(stockMap[entry.sku]) > 0
    );
  }, [productEntries, stockKnown, stockMap]);
  const selectableStyles = React.useMemo(
    () => getSelectableStyles(product, selectableEntries),
    [product, selectableEntries]
  );
  const selectableColors = React.useMemo(
    () => getSelectableColors(product, selectableEntries, style),
    [product, selectableEntries, style]
  );
  const selectableSizes = React.useMemo(
    () => getSelectableSizes(product, selectableEntries, { color, style }),
    [color, product, selectableEntries, style]
  );

  // When product changes or dialog opens, reset defaults
  React.useEffect(() => {
    if (!product || !open) return;

    const entries = getProductSkuEntries(product);
    const firstStyle = getSelectableStyles(product, entries)[0] || '';
    const firstColor = getSelectableColors(product, entries, firstStyle)[0] || '';
    const firstSize =
      getSelectableSizes(product, entries, {
        color: firstColor,
        style: firstStyle,
      })[0] || '';

    setStyle(firstStyle);
    setSize(firstSize);
    setColor(firstColor);
  }, [product, open]);

  React.useEffect(() => {
    if (!product || !open) return;

    let ignore = false;
    const skus = getProductSkus(product);
    setStockLoaded(false);
    setStockError(false);

    if (!skus.length) {
      setStockMap({});
      setStockLoaded(true);
      return;
    }

    async function loadStock() {
      try {
        const query = skus.map(encodeURIComponent).join(',');
        const res = await fetch(`/api/stock?sku=${query}`);
        const data = await res.json();
        if (!res.ok || data.ok === false) {
          throw new Error(data.error || 'Inventory lookup failed');
        }
        if (ignore) return;

        const next = {};
        for (const row of data.data || []) {
          const sku = row.sku || row.sku_key;
          next[sku] = {
            hidden: row.hidden === true,
            quantity: Math.max(0, Number(row.quantity) || 0),
          };
        }
        setStockMap(next);
      } catch {
        if (!ignore) {
          setStockMap({});
          setStockError(true);
        }
      } finally {
        if (!ignore) setStockLoaded(true);
      }
    }

    loadStock();

    return () => {
      ignore = true;
    };
  }, [product, open]);

  React.useEffect(() => {
    if (!product || !open || !stockKnown) return;

    const currentOptions = {};
    if (product.styles?.length && style) currentOptions.style = style;
    if (product.sizes?.length && size) currentOptions.size = size;
    if (selectableColors.length && color) currentOptions.color = color;

    const currentSku = getSkuForOptions(product, currentOptions);
    if (currentSku && readStockQuantity(stockMap[currentSku]) > 0) return;

    const firstAvailable = selectableEntries[0];

    if (!firstAvailable) return;

    setStyle(firstAvailable.options.style || '');
    setSize(firstAvailable.options.size || '');
    setColor(firstAvailable.options.color || '');
  }, [
    color,
    open,
    product,
    selectableColors.length,
    selectableEntries,
    size,
    stockKnown,
    stockMap,
    style,
  ]);

  if (!product) {
    return null;
  }

  const options = {};
  if (product.styles?.length && style) options.style = style;
  if (product.sizes?.length && size) options.size = size;
  if (selectableColors.length && color) options.color = color;

  const unitPrice = getUnitPrice(product, options);
  const selectedSku = getSkuForOptions(product, options);
  const selectedRecord = selectedSku ? stockMap[selectedSku] : null;
  const selectedStock = readStockQuantity(selectedRecord);
  const isHidden = stockKnown && selectedRecord?.hidden === true;
  const isSoldOut = stockKnown && !isHidden && selectedStock <= 0;
  const isUnavailable = !stockKnown || isHidden || isSoldOut;
  const heroImage =
    getVariantImage(product, { style: options.style, color: options.color }) ||
    product.image;

  const handleStyleChange = (nextStyle) => {
    if (!nextStyle) return;
    const nextColors = getSelectableColors(product, selectableEntries, nextStyle);
    const nextColor = nextColors[0] || '';
    const nextSizes = getSelectableSizes(product, selectableEntries, {
      color: nextColor,
      style: nextStyle,
    });
    setStyle(nextStyle);
    setColor(nextColor);
    setSize(nextSizes[0] || '');
  };

  const handleColorChange = (nextColor) => {
    if (!nextColor) return;
    const nextSizes = getSelectableSizes(product, selectableEntries, {
      color: nextColor,
      style,
    });
    setColor(nextColor);
    if (nextSizes.length && !nextSizes.includes(size)) {
      setSize(nextSizes[0]);
    }
  };

  const handleSizeChange = (nextSize) => {
    if (!nextSize) return;
    setSize(nextSize);
  };

  const handleAdd = () => {
    const items = readCart();
    const key = lineKey(product.id, options);
    const existing = items.find((i) => i.key === key);

    if (isUnavailable) return;

    if (existing) {
      const maxQty = stockKnown ? selectedStock : 99;
      existing.qty = Math.min((existing.qty || 1) + 1, maxQty);
      existing.price = unitPrice; // keep price in sync with variant
      existing.sku = selectedSku;
    } else {
      items.push({
        key,
        sku: selectedSku,
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
        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
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
              sx={{
                color: isUnavailable ? 'error.main' : 'success.main',
                fontWeight: 700,
                mb: 0.5,
              }}
            >
              {stockError
                ? 'Inventory unavailable'
                : stockLoaded
                  ? isHidden
                    ? 'Not currently listed'
                    : isSoldOut
                      ? 'Sold out'
                      : getStockMessage({
                          stockError,
                          stockLoaded,
                          isHidden,
                          isSoldOut,
                          quantity: selectedStock,
                        })
                  : 'Checking inventory...'}
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
        {selectableStyles.length ? (
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
              onChange={(_, v) => handleStyleChange(v)}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}
            >
              {selectableStyles.map((st) => (
                <ToggleButton key={st} value={st} disabled={!stockKnown}>
                  {st}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        ) : null}

        {/* Color */}
        {selectableColors.length ? (
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
              onChange={(_, v) => handleColorChange(v)}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}
            >
              {selectableColors.map((c) => (
                <ToggleButton key={c} value={c} disabled={!stockKnown}>
                  {c}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        ) : null}

        {/* Size */}
        {selectableSizes.length ? (
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
              onChange={(_, v) => handleSizeChange(v)}
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}
            >
              {selectableSizes.map((s) => (
                <ToggleButton key={s} value={s} disabled={!stockKnown}>
                  {s}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        ) : null}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleAdd} disabled={isUnavailable}>
          {stockError
            ? 'Unavailable'
            : !stockKnown
              ? 'Checking...'
              : isHidden
              ? 'Not listed'
              : isSoldOut
                ? 'Sold out'
                : 'Add to cart'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
