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

function money(cents) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
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

  const openVariantPicker = (product) => {
    setActiveProduct(product);
    setDialogOpen(true);
  };

  const closeVariantPicker = () => {
    setDialogOpen(false);
    setActiveProduct(null);
  };

  const visibleProducts = React.useMemo(() => {
    return products
      .filter((p) => p.active)
      .slice()
      .sort(compareByFeaturedOrder);
  }, []);

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

          <Link href="/store/cart" passHref legacyBehavior>
            <Button variant="outlined" startIcon={<ShoppingCartIcon />}>
              Cart
            </Button>
          </Link>
        </Box>

        <Grid container spacing={3}>
          {visibleProducts.map((p) => (
            <Grid key={p.id} item xs={12} sm={6} md={4}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <Link href={`/store/${p.slug}`} passHref legacyBehavior>
                  <CardActionArea sx={{ flexGrow: 1 }}>
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
                </Link>

                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button variant="contained" onClick={() => openVariantPicker(p)}>
                    Quick add
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
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