// pages/store/index.js
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  Container,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  CardActionArea,
  Typography,
  Button,
  Box,
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';

import { products } from '../../src/data/products';
import Navbar from '../../components/Navbar';
import VariantPickerDialog from '../../components/VariantPickerDialog';
import {
  getAllCatalogSkuEntries,
  getProductSkus,
} from '../../lib/productCatalog';

function money(cents) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

function readStockQuantity(record) {
  if (!record || record.hidden) return 0;
  return Math.max(0, Number(record.quantity) || 0);
}

function getVariantPriceRange(product) {
  // Collect any explicit variant prices (e.g. product.variants[style].price)
  const prices = [];

  if (product && product.variants && typeof product.variants === 'object') {
    for (const v of Object.values(product.variants)) {
      if (v && typeof v.price === 'number' && Number.isFinite(v.price)) {
        prices.push(v.price);
      }
    }
  }

  if (!prices.length) return null;

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return { min, max };
}

function priceLabel(product) {
  const range = getVariantPriceRange(product);

  // If a product has variant prices (like AH hats), show a range.
  if (range) {
    if (range.min === range.max) return money(range.min);
    return `${money(range.min)}–${money(range.max)}`;
  }

  // Otherwise, show the product price as usual.
  return money(product.price);
}

const PRODUCT_ORDER = {
  'avalanche-hour-hats': 0, // AH hats
  'recaps-caps': 1,         // ReCaps hats (corduroy + trucker)
  'recaps-beanies': 2,      // ReCaps beanies + poms
};

function compareByFeaturedOrder(a, b) {
  const oa = PRODUCT_ORDER[a.id] ?? 999;
  const ob = PRODUCT_ORDER[b.id] ?? 999;

  if (oa !== ob) return oa - ob;

  // Stable-ish fallback ordering so the rest doesn't shuffle around randomly.
  return String(a.name).localeCompare(String(b.name));
}

export default function StoreIndexPage() {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [activeProduct, setActiveProduct] = React.useState(null);
  const [stockMap, setStockMap] = React.useState({});
  const [stockLoaded, setStockLoaded] = React.useState(false);
  const [stockError, setStockError] = React.useState(false);

  const openVariantPicker = (product) => {
    setActiveProduct(product);
    setDialogOpen(true);
  };

  const closeVariantPicker = () => {
    setDialogOpen(false);
    setActiveProduct(null);
  };

  const activeProducts = React.useMemo(() => {
    return products
      .filter((p) => p.active)
      .slice()
      .sort(compareByFeaturedOrder);
  }, []);

  React.useEffect(() => {
    let ignore = false;
    const skus = getAllCatalogSkuEntries().map((entry) => entry.sku);
    setStockError(false);

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
  }, []);

  const getProductAvailableQuantity = React.useCallback((product) => {
    return getProductSkus(product).reduce(
      (sum, sku) => sum + readStockQuantity(stockMap[sku]),
      0
    );
  }, [stockMap]);

  const availableProducts = React.useMemo(() => {
    if (!stockLoaded || stockError) return [];
    return activeProducts.filter((product) => {
      return getProductAvailableQuantity(product) > 0;
    });
  }, [activeProducts, getProductAvailableQuantity, stockError, stockLoaded]);

  function renderStoreContent() {
    if (stockError) {
      return (
        <Box sx={{ py: 4 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            Store inventory is temporarily unavailable.
          </Typography>
          <Typography color="text.secondary">
            Please check back shortly.
          </Typography>
        </Box>
      );
    }

    if (!stockLoaded) {
      return (
        <Box sx={{ py: 4 }}>
          <Typography color="text.secondary">Checking inventory...</Typography>
        </Box>
      );
    }

    if (!availableProducts.length) {
      return (
        <Box sx={{ py: 4 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            No store products are currently available.
          </Typography>
          <Typography color="text.secondary">
            Please check back later.
          </Typography>
        </Box>
      );
    }

    return (
      <Grid container spacing={3}>
        {availableProducts.map((p) => (
          <Grid key={p.id} item xs={12} sm={6} md={4}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <CardActionArea
                component={Link}
                href={`/store/${p.slug}`}
                sx={{ flexGrow: 1 }}
              >
                <CardMedia
                  component="img"
                  image={p.image}
                  alt={p.name}
                  sx={{ aspectRatio: '1 / 1', objectFit: 'cover' }}
                />
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 0.5 }}>
                    {p.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {priceLabel(p)}
                  </Typography>
                </CardContent>
              </CardActionArea>

              <CardActions sx={{ px: 2, pb: 2 }}>
                <Button variant="contained" onClick={() => openVariantPicker(p)}>
                  Quick add
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  return (
    <>
      <Head>
        <title>Store — The Avalanche Hour</title>
        <meta
          name="description"
          content="Official merch from The Avalanche Hour Podcast."
        />
      </Head>

      <Navbar />

      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ flexGrow: 1 }}>
            Store
          </Typography>

          <Button
            component={Link}
            href="/store/cart"
            variant="outlined"
            startIcon={<ShoppingCartIcon />}
          >
            Cart
          </Button>
        </Box>

        {renderStoreContent()}
      </Container>

      <VariantPickerDialog
        open={dialogOpen}
        onClose={closeVariantPicker}
        product={activeProduct}
        onAdded={() => {}}
      />
    </>
  );
}
