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
import Navbar from '../../components/Navbar';
import {
  getProductSkuEntries,
  getProductSkus,
  getSelectableColors,
  getSelectableSizes,
  getSelectableStyles,
  getSkuForOptions,
  getUnitPrice,
  getVariantImage,
} from '../../lib/productCatalog';
import {
  getProductInventorySummary,
} from '../../lib/productCatalogPresentation.mjs';
import {
  getProductMediaForSku,
  getProductTaxonomy,
} from '../../lib/productCatalogStructure.mjs';
import { ecommerceEvent } from '../../lib/gtag';
import styles from '../../styles/Storefront.module.css';

const CART_KEY = 'ah_cart';
const LOW_STOCK_THRESHOLD = 5;

function money(cents) {
  return (cents / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  });
}

function getStockMessage({ stockError, stockLoaded, isHidden, isSoldOut, quantity }) {
  if (stockError) return 'Inventory unavailable';
  if (!stockLoaded) return 'Checking inventory...';
  if (isHidden) return 'Not currently listed';
  if (isSoldOut) return 'Sold out';
  return quantity > 0 && quantity < LOW_STOCK_THRESHOLD ? 'Low stock' : 'In stock';
}

function readStockQuantity(record) {
  if (!record || record.hidden) return 0;
  return Math.max(0, Number(record.quantity) || 0);
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

export default function ProductSlugPage({
  initialProduct = null,
  catalogSource = 'unknown',
}) {
  const router = useRouter();
  const product = initialProduct;

  // Variant state (initialized once product is known)
  const [style, setStyle] = React.useState('');
  const [size, setSize] = React.useState('');
  const [color, setColor] = React.useState('');
  const [qty, setQty] = React.useState(1);
  const [stockMap, setStockMap] = React.useState({});
  const [stockLoaded, setStockLoaded] = React.useState(false);
  const [stockError, setStockError] = React.useState(false);
  const stockKnown = stockLoaded && !stockError;
  const productEntries = React.useMemo(
    () => getProductSkuEntries(product),
    [product]
  );
  const productSkus = React.useMemo(
    () => getProductSkus(product),
    [product]
  );
  const selectableEntries = React.useMemo(() => {
    if (!stockKnown) return productEntries;
    return productEntries.filter(
      (entry) => stockMap[entry.sku]?.hidden !== true
    );
  }, [productEntries, stockKnown, stockMap]);
  const purchasableEntries = React.useMemo(() => {
    if (!stockKnown) return productEntries;
    return selectableEntries.filter(
      (entry) => readStockQuantity(stockMap[entry.sku]) > 0
    );
  }, [productEntries, selectableEntries, stockKnown, stockMap]);
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

  // Gallery state
  const [selectedImage, setSelectedImage] = React.useState(null);
  const viewedProductRef = React.useRef('');

  // Initialize defaults when product changes
  React.useEffect(() => {
    if (!product) return;

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
    setQty(1);
    setSelectedImage(null);
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!product) return;

    let ignore = false;
    const skus = productSkus;
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
  }, [product, productSkus]);

  React.useEffect(() => {
    if (!product || !stockKnown) return;

    const currentOptions = {};
    if (product.styles?.length && style) currentOptions.style = style;
    if (product.sizes?.length && size) currentOptions.size = size;
    if (selectableColors.length && color) currentOptions.color = color;

    const currentSku = getSkuForOptions(product, currentOptions);
    const currentRecord = currentSku ? stockMap[currentSku] : null;
    const currentIsListed =
      Boolean(currentSku) && currentRecord?.hidden !== true;
    if (
      currentIsListed &&
      (readStockQuantity(currentRecord) > 0 || !purchasableEntries.length)
    ) {
      return;
    }

    const firstAvailable =
      purchasableEntries[0] || selectableEntries[0];

    if (!firstAvailable) {
      router.replace('/store');
      return;
    }

    setStyle(firstAvailable.options.style || '');
    setSize(firstAvailable.options.size || '');
    setColor(firstAvailable.options.color || '');
    setQty(1);
    setSelectedImage(null);
  }, [
    color,
    product,
    purchasableEntries,
    router,
    selectableColors.length,
    selectableEntries,
    size,
    stockKnown,
    stockMap,
    style,
  ]);

  React.useEffect(() => {
    if (!product || viewedProductRef.current === product.id) return;
    if (product.styles?.length && !style) return;
    if (product.sizes?.length && !size) return;

    const colorOptions = getSelectableColors(
      product,
      getProductSkuEntries(product),
      style
    );
    if (colorOptions.length && !color) return;

    const trackingOptions = {};
    if (product.styles?.length && style) trackingOptions.style = style;
    if (product.sizes?.length && size) trackingOptions.size = size;
    if (color) trackingOptions.color = color;

    viewedProductRef.current = product.id;
    ecommerceEvent('view_item', {
      items: [
        {
          id: product.id,
          sku: getSkuForOptions(product, trackingOptions),
          name: product.name,
          price: getUnitPrice(product, trackingOptions),
          qty: 1,
          options: trackingOptions,
        },
      ],
    });
  }, [color, product, size, style]);

  if (!product) {
    // Could render a spinner or 404 here instead of null if you want
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
  const inventorySummary = getProductInventorySummary(
    productSkus,
    stockMap
  );
  const productIsStandby = stockKnown && inventorySummary.isStandby;
  const isHidden = stockKnown && selectedRecord?.hidden === true;
  const isSoldOut = stockKnown && !isHidden && selectedStock <= 0;
  const isUnavailable = !stockKnown || isHidden || isSoldOut;

  const computedVariantImage = getVariantImage(product, options);
  const allImages = getProductMediaForSku(product, selectedSku);
  const selectedImageIsRelevant =
    selectedImage && allImages.includes(selectedImage);
  const heroImage =
    (selectedImageIsRelevant ? selectedImage : null) ||
    computedVariantImage ||
    allImages[0] ||
    product.image;
  const taxonomy = getProductTaxonomy(product);
  const showColorSelector =
    selectableColors.length > 1 ||
    selectableColors.some((candidate) => candidate !== style);

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
    setQty(1);
    setSelectedImage(null);
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
    setQty(1);
    setSelectedImage(null);
  };

  const handleSizeChange = (nextSize) => {
    if (!nextSize) return;
    setSize(nextSize);
    setQty(1);
    setSelectedImage(null);
  };

  function addToCart(goCheckout = false) {
    const items = readCart();
    const key = lineKey(product.id, options);
    const maxQty = stockKnown ? Math.max(1, selectedStock) : 99;
    const nextQty = Math.max(
      1,
      Math.min(maxQty, parseInt(qty, 10) || 1)
    );

    const existing = items.find((i) => i.key === key);
    const imageForCart = heroImage;

    if (isUnavailable) return;

    if (existing) {
      existing.qty = Math.min(existing.qty + nextQty, maxQty);
      existing.sku = selectedSku;
    } else {
      items.push({
        key,
        sku: selectedSku,
        id: product.id,
        name: product.name,
        price: unitPrice,        // <<-- USE VARIANT PRICE HERE
        options,
        image: imageForCart,
        qty: nextQty
      });
    }

    writeCart(items);
    ecommerceEvent('add_to_cart', {
      items: [
        {
          id: product.id,
          sku: selectedSku,
          name: product.name,
          price: unitPrice,
          qty: nextQty,
          options,
        },
      ],
    });
    if (goCheckout) router.push('/store/checkout');
  }

  if (productIsStandby) {
    return (
      <>
        <Head>
          <title>Store — The Avalanche Hour</title>
        </Head>
        <Navbar />
        <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
          <Typography variant="h5" sx={{ mb: 1 }}>
            This product is not currently available.
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            Returning to the live store selection.
          </Typography>
          <Button component={Link} href="/store" variant="contained">
            Back to store
          </Button>
        </Container>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{`${product.name} — The Avalanche Hour`}</title>
        <meta name="description" content={product.description} />
      </Head>

      <Navbar />

      <Box
        component="main"
        className={styles.detailPage}
        data-catalog-source={catalogSource}
      >
        <Box className={styles.detailUtility}>
          <Container maxWidth="lg" className={styles.detailUtilityInner}>
            <Button
              component={Link}
              href="/store"
              startIcon={<ArrowBackIcon />}
              className={styles.detailBack}
            >
              Current drop
            </Button>
            <span className={styles.detailUtilityLabel}>
              {taxonomy.category} / {taxonomy.collection}
            </span>
            <Button
              component={Link}
              href="/store/cart"
              startIcon={<ShoppingCartIcon />}
              className={styles.detailCart}
            >
              Cart
            </Button>
          </Container>
        </Box>

        <Container maxWidth="lg" className={styles.detailContainer}>
          <Grid container spacing={{ xs: 4, md: 7 }} className={styles.detailGrid}>
          {/* Gallery */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              className={styles.galleryPanel}
            >
              <Box
                component="img"
                src={heroImage}
                alt={product.name}
                className={styles.detailHeroImage}
              />
              <Box className={styles.thumbnailRail}>
                {allImages.map((src) => (
                  <Box
                    key={src}
                    component="img"
                    src={src}
                    alt={product.name}
                    onClick={() => setSelectedImage(src)}
                    className={`${styles.thumbnail} ${
                      heroImage === src ? styles.thumbnailActive : ''
                    }`}
                  />
                ))}
              </Box>
            </Paper>
          </Grid>

          {/* Details */}
          <Grid item xs={12} md={6} className={styles.detailInfoColumn}>
            <Typography component="p" className={styles.detailEyebrow}>
              {taxonomy.category} / {taxonomy.collection}
            </Typography>
            <Typography component="h1" className={styles.detailTitle}>
              {product.name}
            </Typography>
            <Typography className={styles.detailPrice}>
              {money(unitPrice)}
            </Typography>
            <Typography
              component="p"
              className={`${styles.detailStock} ${
                isUnavailable ? styles.detailStockUnavailable : ''
              }`}
            >
              <span className={styles.statusDot} aria-hidden="true" />
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
              component="div"
              className={styles.detailDescription}
            >
              {product.description}
            </Typography>
            <Box className={styles.supportNote}>
              <span>What this supports</span>
              Independent conversations about avalanches, snow, decisions, and
              the people doing the work.
            </Box>

            {/* Style */}
            {selectableStyles.length ? (
              <Box className={styles.optionBlock}>
                <Typography
                  component="p"
                  className={styles.optionLabel}
                >
                  {product.optionLabels?.style || 'Style'}
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={style}
                  onChange={(_, v) => handleStyleChange(v)}
                  className={styles.optionGroup}
                >
                  {selectableStyles.map((st) => (
                    <ToggleButton
                      key={st}
                      value={st}
                      disabled={!stockKnown}
                      className={styles.visualOption}
                    >
                      <img
                        src={
                          getVariantImage(product, {
                            style: st,
                            color:
                              getSelectableColors(
                                product,
                                selectableEntries,
                                st
                              )[0] || '',
                          }) || product.image
                        }
                        alt=""
                      />
                      <span>{st}</span>
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            ) : null}

            {/* Color */}
            {showColorSelector ? (
              <Box className={styles.optionBlock}>
                <Typography
                  component="p"
                  className={styles.optionLabel}
                >
                  {product.optionLabels?.color || 'Color'}
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={color}
                  onChange={(_, v) => {
                    handleColorChange(v);
                  }}
                  className={styles.optionGroup}
                >
                  {selectableColors.map((c) => (
                    <ToggleButton
                      key={c}
                      value={c}
                      disabled={!stockKnown}
                      className={styles.visualOption}
                    >
                      <img
                        src={
                          getVariantImage(product, {
                            color: c,
                            style,
                            size,
                          }) || product.image
                        }
                        alt=""
                      />
                      <span>{c}</span>
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            ) : null}

            {/* Size */}
            {selectableSizes.length ? (
              <Box className={styles.optionBlock}>
                <Typography
                  component="p"
                  className={styles.optionLabel}
                >
                  {product.optionLabels?.size || 'Size'}
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={size}
                  onChange={(_, v) => handleSizeChange(v)}
                  className={styles.optionGroup}
                >
                  {selectableSizes.map((s) => (
                    <ToggleButton key={s} value={s} disabled={!stockKnown}>
                      {s}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Box>
            ) : null}

            {/* Quantity */}
            <Box className={styles.quantityRow}>
              <Typography component="p" className={styles.optionLabel}>
                Quantity
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                disabled={isUnavailable}
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
                disabled={isUnavailable}
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
                onClick={() =>
                  setQty((q) =>
                    Math.min(stockKnown ? selectedStock : 99, q + 1)
                  )
                }
                disabled={isUnavailable}
              >
                +
              </Button>
            </Box>

            {/* Actions */}
            <Box className={styles.detailActions}>
              <Button
                variant="contained"
                size="large"
                onClick={() => addToCart(true)}
                disabled={isUnavailable}
              >
                {stockError
                  ? 'Unavailable'
                  : !stockKnown
                    ? 'Checking...'
                    : isHidden
                    ? 'Not listed'
                    : isSoldOut
                      ? 'Sold out'
                      : 'Buy now'}
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => addToCart(false)}
                disabled={isUnavailable}
              >
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
            </Box>

          </Grid>
          </Grid>
        </Container>
      </Box>
    </>
  );
}

export async function getStaticPaths() {
  const { loadStorefrontCatalog } = await import(
    '../../lib/storefrontCatalog.mjs'
  );
  const result = await loadStorefrontCatalog();

  return {
    paths: result.products.map((product) => ({
      params: { slug: product.slug },
    })),
    fallback: 'blocking',
  };
}

export async function getStaticProps({ params }) {
  const {
    loadStorefrontProduct,
    STOREFRONT_CATALOG_REVALIDATE_SECONDS,
  } = await import('../../lib/storefrontCatalog.mjs');
  const result = await loadStorefrontProduct(params?.slug);

  if (!result.product) {
    return {
      notFound: true,
      revalidate: STOREFRONT_CATALOG_REVALIDATE_SECONDS,
    };
  }

  return {
    props: {
      initialProduct: result.product,
      catalogSource: result.source,
    },
    revalidate: STOREFRONT_CATALOG_REVALIDATE_SECONDS,
  };
}
