// pages/store/index.js
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  Container, Grid, Card, CardMedia, CardContent, CardActions,
  CardActionArea, Typography, Button, Box
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { products } from '../../src/data/products';
import Navbar from '../../components/Navbar';
import VariantPickerDialog from '../../components/VariantPickerDialog';

function money(cents) {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
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

  return (
    <>
      <Head>
        <title>Store — The Avalanche Hour</title>
        <meta name="description" content="Official merch from The Avalanche Hour Podcast." />
      </Head>

      <Navbar />

      <Container maxWidth="lg" sx={{ py: { xs: 2, md: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" sx={{ flexGrow: 1 }}>
            Store
          </Typography>
          <Link href="/store/cart" passHref legacyBehavior>
            <Button variant="outlined" startIcon={<ShoppingCartIcon />}>Cart</Button>
          </Link>
        </Box>

        <Grid container spacing={3}>
          {products.filter(p => p.active).map((p) => (
            <Grid key={p.id} item xs={12} sm={6} md={4}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Whole card clickable → product page */}
                <Link href={`/store/${p.slug}`} passHref legacyBehavior>
                  <CardActionArea sx={{ flexGrow: 1 }}>
                    <CardMedia
                      component="img"
                      image={p.image}
                      alt={p.name}
                      sx={{ aspectRatio: '1 / 1', objectFit: 'cover' }}
                    />
                    <CardContent>
                      <Typography variant="h6" sx={{ mb: 0.5 }}>{p.name}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {money(p.price)}
                      </Typography>
                    </CardContent>
                  </CardActionArea>
                </Link>

                <CardActions sx={{ px: 2, pb: 2 }}>
                  <Button
                    variant="contained"
                    onClick={() => openVariantPicker(p)}
                  >
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