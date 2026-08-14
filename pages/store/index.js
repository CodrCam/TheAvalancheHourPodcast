// pages/store/index.js
import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import {
  Container,
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
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import TerrainRoundedIcon from '@mui/icons-material/TerrainRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';

import Navbar from '../../components/Navbar';
import VariantPickerDialog from '../../components/VariantPickerDialog';
import { getProductSkuEntries, getProductSkus } from '../../lib/productCatalog';
import {
  getProductStorefrontState,
  isProductVisibleOnStorefront,
} from '../../lib/productCatalogPresentation.mjs';
import {
  getProductTaxonomy,
} from '../../lib/productCatalogStructure.mjs';
import { getOptimizedPublicImage } from '../../lib/publicImage.mjs';
import styles from '../../styles/Storefront.module.css';

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

  if (Array.isArray(product?.skuEntries)) {
    for (const entry of product.skuEntries) {
      if (
        entry?.active !== false &&
        typeof entry?.price === 'number' &&
        Number.isFinite(entry.price)
      ) {
        prices.push(entry.price);
      }
    }
  }

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

const PRODUCT_LABELS = {
  'avalanche-hour-hats': 'Podcast headwear',
  'recaps-caps': 'Reclaimed-material headwear',
  'recaps-beanies': 'Cold-weather headwear',
  'voile-straps': 'Backcountry utility',
  hoodies: 'Season layer',
  'free-range-tote': 'Field carry',
  'avalanche-hour-sticker': 'Small signal',
};

const STARTING_ZONE_EBOOK = Object.freeze({
  title: 'The Starting Zone',
  subtitle: 'At the Interface of Avalanche Science and Practice',
  author: 'Karl Birkeland',
  price: '$49.99',
  image: '/images/store/books/the-starting-zone-ebook.jpg',
  url: 'https://www.thestartingzonebook.com/product-page/the-starting-zone-ebook-1',
});

function productLabel(product) {
  const taxonomy = getProductTaxonomy(product);
  const managedLabel = String(product.label || '').trim();
  const label =
    managedLabel && managedLabel !== 'Avalanche Hour field goods'
      ? managedLabel
      : PRODUCT_LABELS[product.id] || taxonomy.category;
  return `${taxonomy.collection} · ${label}`;
}

function compareByFeaturedOrder(a, b) {
  const aSortOrder = Number(a.sortOrder);
  const bSortOrder = Number(b.sortOrder);
  if (Number.isFinite(aSortOrder) && Number.isFinite(bSortOrder)) {
    if (aSortOrder !== bSortOrder) return aSortOrder - bSortOrder;
  }

  const oa = PRODUCT_ORDER[a.id] ?? 999;
  const ob = PRODUCT_ORDER[b.id] ?? 999;

  if (oa !== ob) return oa - ob;

  // Stable-ish fallback ordering so the rest doesn't shuffle around randomly.
  return String(a.name).localeCompare(String(b.name));
}

function CatalogStoryAnchor() {
  return (
    <Box component="figure" className={styles.catalogAnchor}>
      <Box
        component="img"
        src="/images/optimized/background/main-page1.webp"
        alt="An avalanche moving through a snow-covered mountain valley"
        loading="lazy"
        decoding="async"
        className={styles.anchorImage}
      />
      <div className={styles.anchorWash} aria-hidden="true" />
      <Box component="figcaption" className={styles.anchorCaption}>
        <Typography component="p" className={styles.anchorEyebrow}>
          The reason for the goods
        </Typography>
        <Typography component="h3" className={styles.anchorTitle}>
          Keep the conversation moving through the mountains.
        </Typography>
        <Typography className={styles.anchorBody}>
          Every piece helps fund independent stories, field knowledge, and the
          avalanche conversations people carry home.
        </Typography>
      </Box>
      <div className={styles.anchorSnowProfile} aria-hidden="true">
        <span>new snow</span>
        <span>wind slab</span>
        <span>persistent layer</span>
        <span>old snow</span>
      </div>
    </Box>
  );
}

function FeaturedReading() {
  return (
    <Box
      component="section"
      className={styles.featuredReading}
      aria-labelledby="starting-zone-ebook-title"
    >
      <Box
        component="a"
        href={STARTING_ZONE_EBOOK.url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.bookCoverLink}
        aria-label={`View ${STARTING_ZONE_EBOOK.title} by ${STARTING_ZONE_EBOOK.author} on The Starting Zone website (opens in a new tab)`}
      >
        <Box
          component="img"
          src={getOptimizedPublicImage(STARTING_ZONE_EBOOK.image)}
          alt={`Cover of ${STARTING_ZONE_EBOOK.title} by ${STARTING_ZONE_EBOOK.author}`}
          loading="lazy"
          decoding="async"
          className={styles.bookCover}
        />
        <span className={styles.bookReleaseBadge}>Independent release</span>
      </Box>

      <Box className={styles.bookFeatureCopy}>
        <Typography component="p" className={styles.bookEyebrow}>
          Featured field reading
        </Typography>
        <Typography
          component="h3"
          id="starting-zone-ebook-title"
          className={styles.bookTitle}
        >
          {STARTING_ZONE_EBOOK.title}
        </Typography>
        <Typography component="p" className={styles.bookSubtitle}>
          {STARTING_ZONE_EBOOK.subtitle}
        </Typography>
        <Typography component="p" className={styles.bookByline}>
          By {STARTING_ZONE_EBOOK.author}
        </Typography>
        <Typography component="p" className={styles.bookDescription}>
          An evolving, interactive e-book connecting current avalanche science
          with practical decision-making for avalanche professionals and
          experienced backcountry travelers.
        </Typography>

        <Box className={styles.bookMeta} aria-label="eBook details">
          <span>Digital eBook</span>
          <span>{STARTING_ZONE_EBOOK.price}</span>
          <span>Online access</span>
        </Box>

        <Box className={styles.bookFeatureAction}>
          <Button
            component="a"
            href={STARTING_ZONE_EBOOK.url}
            target="_blank"
            rel="noopener noreferrer"
            variant="contained"
            endIcon={<OpenInNewRoundedIcon />}
            className={styles.bookButton}
            aria-label="View and buy The Starting Zone eBook on thestartingzonebook.com (opens in a new tab)"
          >
            View and buy the eBook
          </Button>
          <Typography component="p" className={styles.bookExternalNote}>
            Opens thestartingzonebook.com. Purchase and access are handled by
            The Starting Zone.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function StoreIndexPage({
  initialProducts = [],
  catalogSource = 'unknown',
}) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [activeProduct, setActiveProduct] = React.useState(null);
  const [stockMap, setStockMap] = React.useState({});
  const [stockLoaded, setStockLoaded] = React.useState(false);
  const [stockError, setStockError] = React.useState(false);
  const catalogUnavailable = [
    'dynamodb-unavailable',
    'dynamodb-unconfigured',
  ].includes(catalogSource);

  const openVariantPicker = (product) => {
    setActiveProduct(product);
    setDialogOpen(true);
  };

  const closeVariantPicker = () => {
    setDialogOpen(false);
    setActiveProduct(null);
  };

  const activeProducts = React.useMemo(() => {
    return initialProducts
      .filter(isProductVisibleOnStorefront)
      .slice()
      .sort(compareByFeaturedOrder);
  }, [initialProducts]);

  React.useEffect(() => {
    let ignore = false;
    const skus = activeProducts.flatMap((product) =>
      getProductSkuEntries(product).map((entry) => entry.sku)
    );
    setStockError(false);

    if (!skus.length) {
      setStockMap({});
      setStockLoaded(true);
      return undefined;
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
  }, [activeProducts]);

  const getStorefrontState = React.useCallback(
    (product) =>
      getProductStorefrontState(
        product,
        getProductSkus(product),
        stockMap,
        { inventoryKnown: stockLoaded && !stockError }
      ),
    [stockError, stockLoaded, stockMap]
  );

  const storefrontProducts = React.useMemo(() => {
    if (!stockLoaded || stockError) return activeProducts;
    return activeProducts.filter((product) => {
      return !getStorefrontState(product).isStandby;
    });
  }, [activeProducts, getStorefrontState, stockError, stockLoaded]);
  function renderStoreContent() {
    if (!stockLoaded) {
      return (
        <Box className={styles.loadingPanel}>
          <span className={styles.statusDot} aria-hidden="true" />
          <Typography color="text.secondary">
            Checking live inventory…
          </Typography>
        </Box>
      );
    }

    if (!storefrontProducts.length) {
      return (
        <Box className={styles.emptyPanel}>
          <Typography variant="h6" sx={{ mb: 1 }}>
            {catalogUnavailable
              ? 'The store catalog is temporarily unavailable.'
              : 'No store products are currently available.'}
          </Typography>
          <Typography color="text.secondary">
            {catalogUnavailable
              ? 'Purchasing is paused so we do not show outdated merchandise. Please check back shortly.'
              : 'Please check back later.'}
          </Typography>
        </Box>
      );
    }

    return (
      <>
        {stockError ? (
          <Box
            role="status"
            className={styles.inventoryWarning}
          >
            <Typography variant="subtitle2">
              Live availability is temporarily unavailable.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              You can still browse the store, but purchasing is paused.
            </Typography>
          </Box>
        ) : null}

        <div className={styles.catalogStory}>
          {storefrontProducts.map((p, index) => {
            const state = getStorefrontState(p);
            const purchasingPaused = stockError || state.isSoldOut;
            const isOpeningPiece = index < 2;
            const positionClass =
              styles[`storyCard${index + 1}`] || styles.storyCardOverflow;

            return (
              <React.Fragment key={p.id}>
                {index === 2 ? <CatalogStoryAnchor /> : null}

                <Card
                  className={`${styles.productCard} ${styles.storyCard} ${positionClass}`}
                >
                  <CardActionArea
                    component={Link}
                    href={`/store/${p.slug}`}
                    className={styles.productLink}
                  >
                    <Box className={styles.productImageWrap}>
                      <CardMedia
                        component="img"
                        image={getOptimizedPublicImage(p.image)}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
                        className={styles.productImage}
                      />
                      <span className={styles.productNumber}>
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      {state.isSoldOut ? (
                        <span className={styles.soldOutFlag}>Sold out</span>
                      ) : null}
                    </Box>
                    <Box className={styles.productCopy}>
                      <CardContent className={styles.productContent}>
                        <Typography
                          component="p"
                          className={styles.productEyebrow}
                        >
                          {productLabel(p)}
                        </Typography>
                        <Typography variant="h6" sx={{ mb: 0.5 }}>
                          {p.name}
                        </Typography>
                        {isOpeningPiece ? (
                          <Typography
                            variant="body2"
                            className={styles.productDescription}
                          >
                            {p.description}
                          </Typography>
                        ) : null}
                        <Box className={styles.productPriceRow}>
                          <Typography className={styles.productPrice}>
                            {priceLabel(p)}
                          </Typography>
                          <span className={styles.viewCue}>
                            View piece
                            <ArrowForwardRoundedIcon fontSize="small" />
                          </span>
                        </Box>
                      </CardContent>
                    </Box>
                  </CardActionArea>

                  <CardActions className={styles.productActions}>
                    <Button
                      variant="contained"
                      onClick={() => openVariantPicker(p)}
                      disabled={purchasingPaused}
                      className={styles.quickAdd}
                    >
                      {state.isSoldOut
                        ? 'Restock pending'
                        : stockError
                          ? 'Purchasing paused'
                          : 'Choose options'}
                    </Button>
                  </CardActions>
                </Card>
              </React.Fragment>
            );
          })}

          {storefrontProducts.length < 3 ? <CatalogStoryAnchor /> : null}
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Store — The Avalanche Hour</title>
        <meta
          name="description"
          content="Official merch from The Avalanche Hour Podcast and featured avalanche field resources."
        />
      </Head>

      <Navbar />

      <Box
        component="main"
        className={styles.storefront}
        data-catalog-source={catalogSource}
      >
        <Box component="section" className={styles.hero}>
          <div className={styles.contourLines} aria-hidden="true" />
          <Container maxWidth="lg" className={styles.heroInner}>
            <Box className={styles.heroCopy}>
              <Typography component="p" className={styles.heroEyebrow}>
                Independent podcast · Community supported
              </Typography>
              <Typography component="h1" className={styles.heroTitle}>
                Support
                <span>the signal.</span>
              </Typography>
              <Typography className={styles.heroBody}>
                Wear the show. Back the conversations that make avalanche
                communities more informed, connected, and honest.
              </Typography>
              <Box className={styles.heroActions}>
                <Button
                  component="a"
                  href="#current-drop"
                  variant="contained"
                  endIcon={<ArrowForwardRoundedIcon />}
                  className={styles.heroPrimary}
                >
                  Shop the current drop
                </Button>
                <Button
                  component={Link}
                  href="/store/cart"
                  variant="outlined"
                  startIcon={<ShoppingCartIcon />}
                  className={styles.heroCart}
                >
                  Open cart
                </Button>
              </Box>
            </Box>

            <Box className={styles.heroVisual} aria-hidden="true">
              <Box
                component="img"
                src={getOptimizedPublicImage(
                  activeProducts[0]?.image ||
                  '/images/store/caps/Black_Camo.jpg'
                )}
                alt=""
                className={styles.heroImageMain}
              />
              <Box
                component="img"
                src={getOptimizedPublicImage(
                  activeProducts[5]?.image ||
                  '/images/store/tote/free-range-canvas.jpg'
                )}
                alt=""
                className={styles.heroImageInset}
              />
              <span className={styles.heroStamp}>
                Field goods
                <small>Season 11</small>
              </span>
            </Box>
          </Container>
        </Box>

        <Box className={styles.missionStrip}>
          <Container maxWidth="lg" className={styles.missionStripInner}>
            <Box className={styles.missionItem}>
              <GraphicEqRoundedIcon />
              <span>
                <strong>Independent voices</strong>
                Long-form conversations without the noise.
              </span>
            </Box>
            <Box className={styles.missionItem}>
              <TerrainRoundedIcon />
              <span>
                <strong>Avalanche awareness</strong>
                Stories, knowledge, and hard-earned field context.
              </span>
            </Box>
          </Container>
        </Box>

        <Box component="section" className={styles.catalogSection}>
          <Container maxWidth="lg">
            <Box className={styles.catalogHeading} id="current-drop">
              <Box>
                <Typography component="p" className={styles.sectionEyebrow}>
                  The current drop
                </Typography>
                <Typography component="h2" className={styles.sectionTitle}>
                  Gear that carries the conversation.
                </Typography>
              </Box>
              <Typography className={styles.sectionIntro}>
                Every purchase directly supports the show and the community
                around it. Availability is checked live before anything reaches
                your cart.
              </Typography>
            </Box>

            {renderStoreContent()}

            <FeaturedReading />
          </Container>
        </Box>

        <Box component="section" className={styles.whyMerch}>
          <Container maxWidth="lg" className={styles.whyMerchInner}>
            <Box className={styles.whyMerchCopy}>
              <Typography component="p" className={styles.sectionEyebrowLight}>
                Why merch?
              </Typography>
              <Typography component="h2" className={styles.whyMerchTitle}>
                Awareness moves person to person.
              </Typography>
              <Typography className={styles.whyMerchBody}>
                The shop helps keep an independent avalanche podcast in the
                field—and puts the conversation in lift lines, trailheads, snow
                pits, and guide rooms.
              </Typography>
              <Button
                component={Link}
                href="/episodes"
                variant="outlined"
                endIcon={<ArrowForwardRoundedIcon />}
                className={styles.listenButton}
              >
                Hear the latest conversations
              </Button>
            </Box>
            <Box className={styles.snowProfile} aria-hidden="true">
              <span>new snow</span>
              <span>wind slab</span>
              <span>persistent layer</span>
              <span>old snow</span>
            </Box>
          </Container>
        </Box>
      </Box>

      <VariantPickerDialog
        open={dialogOpen}
        onClose={closeVariantPicker}
        product={activeProduct}
        onAdded={() => {}}
      />
    </>
  );
}

export async function getStaticProps() {
  const {
    loadStorefrontCatalog,
    STOREFRONT_CATALOG_REVALIDATE_SECONDS,
  } = await import('../../lib/storefrontCatalog.mjs');
  const result = await loadStorefrontCatalog();

  return {
    props: {
      initialProducts: result.products,
      catalogSource: result.source,
    },
    revalidate: STOREFRONT_CATALOG_REVALIDATE_SECONDS,
  };
}
