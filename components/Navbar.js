// components/Navbar.js
import React, { useState, useEffect } from 'react';
import {
  AppBar, Toolbar, Typography, Button, IconButton, Drawer, List, ListItem, ListItemText,
  Box, Menu, MenuItem, ListItemIcon, Badge, Popover, Tooltip
} from '@mui/material';
import {
  Menu as MenuIcon, ExpandMore, PlayArrow, TrendingUp, History, Email, Mic, Home,
  ShoppingCart, Storefront, Instagram, AddRounded, RemoveRounded, CloseRounded,
  ArrowForwardRounded
} from '@mui/icons-material';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { products } from '../src/data/products';
import { SOCIAL_LINKS, SUPPORT_LINKS } from '../lib/siteLinks';
import styles from '../styles/Navbar.module.css';

const CART_KEY = 'ah_cart';

// ---- cart helpers (variant-aware) ----
const keyOf = (id, options = {}) => JSON.stringify({ id, ...options });
function loadCart() { try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; } }
function saveCart(c) { localStorage.setItem(CART_KEY, JSON.stringify(c)); try { window.dispatchEvent(new Event('ah_cart_updated')); } catch {} }
function cartLineKey(item = {}) {
  return item.key || keyOf(item.id, item.options || {});
}

export default function Navbar() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [episodeMenuAnchor, setEpisodeMenuAnchor] = useState(null);
  const [contactMenuAnchor, setContactMenuAnchor] = useState(null);

  // Cart state for badge & popover
  const [cart, setCart] = useState([]);
  const [stockBySku, setStockBySku] = useState({});
  const [cartAnchor, setCartAnchor] = useState(null);
  const cartOpen = Boolean(cartAnchor);

  const router = useRouter();
  const routeIsActive = (path) =>
    path === '/' ? router.pathname === '/' : router.pathname.startsWith(path);
  const episodeRouteActive = routeIsActive('/episodes');
  const contactRouteActive =
    routeIsActive('/contact') || routeIsActive('/be-a-guest');

  useEffect(() => {
    const load = () => setCart(loadCart());
    load();
    const onStorage = (e) => { if (e.key === CART_KEY) load(); };
    const onCartEvent = () => load();
    window.addEventListener('storage', onStorage);
    window.addEventListener('ah_cart_updated', onCartEvent);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ah_cart_updated', onCartEvent);
    };
  }, []);

  useEffect(() => {
    const skus = [...new Set(cart.map((item) => item.sku).filter(Boolean))];
    if (!skus.length) {
      setStockBySku({});
      return;
    }

    let ignore = false;

    async function loadStock() {
      try {
        const query = skus.map(encodeURIComponent).join(',');
        const res = await fetch(`/api/stock?sku=${query}`);
        const data = await res.json();
        if (ignore || !res.ok || data.ok === false) return;

        const nextStock = Object.fromEntries(skus.map((sku) => [sku, 0]));
        for (const row of data.data || []) {
          const sku = row.sku || row.sku_key;
          nextStock[sku] = row.hidden ? 0 : Math.max(0, Number(row.quantity) || 0);
        }

        setStockBySku(nextStock);

        let adjusted = false;
        const nextCart = cart
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
          setCart(nextCart);
          saveCart(nextCart);
        }
      } catch {
        // Keep the current cart usable if the live stock check is temporarily unavailable.
      }
    }

    loadStock();

    return () => {
      ignore = true;
    };
  }, [cart]);

  const getAvailableForItem = (item = {}) => {
    if (item.sku && Number.isFinite(stockBySku[item.sku])) return stockBySku[item.sku];
    if (item.sku) return item.qty || 1;
    return 100;
  };

  const totalItems = cart.reduce((s, i) => s + (i.qty || 0), 0);

  // Build display lines with product + options
  const display = cart.map((item) => {
    const { id, options, qty } = item;
    const p = products.find(x => x.id === id);
    return {
      ...(p || {}),
      id,
      name: item.name || p?.name || id,
      image: item.image || p?.image || '',
      key: cartLineKey(item),
      options: options || {},
      price: typeof item.price === 'number' && Number.isFinite(item.price)
        ? item.price
        : p?.price || 0,
      qty,
      sku: item.sku,
      available: getAvailableForItem(item),
    };
  });
  const cartSubtotal = display.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  // Variant-aware +/- handlers
  const inc = (lineKey) => {
    const next = cart.map(i =>
      cartLineKey(i) === lineKey
        ? { ...i, qty: Math.min((i.qty || 1) + 1, getAvailableForItem(i)) }
        : i
    );
    setCart(next); saveCart(next);
  };
  const dec = (lineKey) => {
    const next = cart
      .map(i => cartLineKey(i) === lineKey ? { ...i, qty: (i.qty || 1) - 1 } : i)
      .filter(i => i.qty > 0);
    setCart(next); saveCart(next);
  };

  const toggleDrawer = (open) => () => setIsDrawerOpen(open);
  const handleEpisodeMenuOpen = (e) => setEpisodeMenuAnchor(e.currentTarget);
  const handleEpisodeMenuClose = () => setEpisodeMenuAnchor(null);
  const handleContactMenuOpen = (e) => setContactMenuAnchor(e.currentTarget);
  const handleContactMenuClose = () => setContactMenuAnchor(null);
  const handleMenuItemClick = (path) => { handleEpisodeMenuClose(); handleContactMenuClose(); router.push(path); };

  const menuItems = [
    { text: 'About', link: '/about' },
    { text: 'Resources', link: '/resources' },
    { text: 'Support', link: '/support' },
    { text: 'Store', link: '/store' },
    { text: 'Donate', link: SUPPORT_LINKS.paypalDonate },
  ];
  const episodeMenuItems = [
    { text: 'All Episodes', link: '/episodes', icon: <PlayArrow />, description: 'Browse all episodes' },
    { text: 'Current Season', link: '/episodes/current', icon: <TrendingUp />, description: 'Latest episodes' },
    { text: 'Past Seasons', link: '/episodes/archive', icon: <History />, description: 'Complete archive' },
  ];
  const contactMenuItems = [
    { text: 'Contact Us', link: '/contact', icon: <Email />, description: 'General inquiries & feedback' },
    { text: 'Be a Guest', link: '/be-a-guest', icon: <Mic />, description: 'Apply to be on the show' },
  ];

  return (
    <AppBar position="sticky" className={styles.navbar}>
      <Toolbar className={styles.navToolbar}>
        <Link href="/" className={styles.brand}>
          <img
            src="/images/avalanche-hour-podcast-logo-white.png"
            alt="The Avalanche Hour Logo"
            className={styles.brandLogo}
          />
        </Link>

        {/* Desktop */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
          <Button
            color="inherit"
            onClick={handleEpisodeMenuOpen}
            endIcon={<ExpandMore />}
            className={`${styles.navLink} ${
              episodeRouteActive ? styles.navLinkActive : ''
            }`}
          >
            Episodes
          </Button>
          <Menu
            anchorEl={episodeMenuAnchor}
            open={Boolean(episodeMenuAnchor)}
            onClose={handleEpisodeMenuClose}
            PaperProps={{ className: styles.navMenu }}
          >
            {episodeMenuItems.map((item) => (
              <MenuItem key={item.text} onClick={() => handleMenuItemClick(item.link)} sx={{ py: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>{item.text}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Menu>

          <Button
            color="inherit"
            onClick={handleContactMenuOpen}
            endIcon={<ExpandMore />}
            className={`${styles.navLink} ${
              contactRouteActive ? styles.navLinkActive : ''
            }`}
          >
            Contact
          </Button>
          <Menu
            anchorEl={contactMenuAnchor}
            open={Boolean(contactMenuAnchor)}
            onClose={handleContactMenuClose}
            PaperProps={{ className: styles.navMenu }}
          >
            {contactMenuItems.map((item) => (
              <MenuItem key={item.text} onClick={() => handleMenuItemClick(item.link)} sx={{ py: 1.5 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>{item.text}</Typography>
                  <Typography variant="caption" color="text.secondary">{item.description}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Menu>

          {menuItems.map((item) => (
            <Button
              key={item.text}
              color="inherit"
              href={item.link}
              target={item.text === 'Donate' ? '_blank' : undefined}
              rel={item.text === 'Donate' ? 'noopener noreferrer' : undefined}
              aria-label={
                item.text === 'Donate'
                  ? 'Donate (opens in a new tab)'
                  : undefined
              }
              className={`${styles.navLink} ${
                item.text !== 'Donate' && routeIsActive(item.link)
                  ? styles.navLinkActive
                  : ''
              } ${item.text === 'Donate' ? styles.donateLink : ''}`}
            >
              {item.text}
            </Button>
          ))}

          <Tooltip title="Follow The Avalanche Hour on Instagram">
            <IconButton
              color="inherit"
              aria-label="Follow The Avalanche Hour on Instagram"
              component="a"
              href={SOCIAL_LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.navIcon}
            >
              <Instagram />
            </IconButton>
          </Tooltip>

          {/* Quick cart popover (variant-aware) */}
          <IconButton
            color="inherit"
            aria-label="Cart"
            onClick={(e) => setCartAnchor(e.currentTarget)}
            className={styles.navIcon}
          >
            <Badge badgeContent={totalItems} className={styles.cartBadge}>
              <ShoppingCart />
            </Badge>
          </IconButton>
          <Popover
            open={cartOpen}
            anchorEl={cartAnchor}
            onClose={() => setCartAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{ className: styles.cartPopover }}
          >
            <Box className={styles.cartHeader}>
              <Box>
                <Typography component="p" className={styles.cartEyebrow}>
                  Current field kit
                </Typography>
                <Box className={styles.cartTitleRow}>
                  <Typography component="h2" className={styles.cartTitle}>
                    Your cart
                  </Typography>
                  <span className={styles.cartCount}>
                    {totalItems} {totalItems === 1 ? 'item' : 'items'}
                  </span>
                </Box>
              </Box>
              <IconButton
                aria-label="Close cart"
                onClick={() => setCartAnchor(null)}
                className={styles.cartClose}
              >
                <CloseRounded />
              </IconButton>
            </Box>

            {display.length === 0 ? (
              <Box className={styles.cartEmpty}>
                <ShoppingCart className={styles.emptyCartIcon} />
                <Typography component="h3">Nothing packed yet.</Typography>
                <Typography>
                  Pick something from the current drop and it will show up here.
                </Typography>
                <Button
                  component={Link}
                  href="/store"
                  endIcon={<ArrowForwardRounded />}
                  onClick={() => setCartAnchor(null)}
                  className={styles.emptyCartButton}
                >
                  Explore the shop
                </Button>
              </Box>
            ) : (
              <Box className={styles.cartItems}>
                {display.map((i) => {
                  const optionLabel = [
                    i.options?.color ? i.options.color : null,
                    i.options?.size ? i.options.size : null
                  ].filter(Boolean).join(' · ');
                  return (
                    <Box key={i.key} className={styles.cartLine}>
                      <Box className={styles.cartImageWrap}>
                        {i.image ? (
                          <Box
                            component="img"
                            src={i.image}
                            alt=""
                            className={styles.cartImage}
                          />
                        ) : (
                          <ShoppingCart className={styles.cartImageFallback} />
                        )}
                      </Box>
                      <Box className={styles.cartLineBody}>
                        <Box className={styles.cartLineTop}>
                          <Box>
                            <Typography component="h3" className={styles.cartName}>
                              {i.name}
                            </Typography>
                            {optionLabel ? (
                              <Typography className={styles.cartOptions}>
                                {optionLabel}
                              </Typography>
                            ) : null}
                          </Box>
                          <Typography className={styles.cartLinePrice}>
                            ${((i.price * i.qty) / 100).toFixed(2)}
                          </Typography>
                        </Box>
                        <Box className={styles.quantityRow}>
                          <span className={styles.quantityLabel}>Quantity</span>
                          <Box className={styles.quantityControl}>
                            <IconButton
                              aria-label={`Remove one ${i.name}`}
                              onClick={() => dec(i.key)}
                              className={styles.quantityButton}
                            >
                              <RemoveRounded fontSize="small" />
                            </IconButton>
                            <span className={styles.quantityValue}>{i.qty}</span>
                            <IconButton
                              aria-label={`Add one ${i.name}`}
                              onClick={() => inc(i.key)}
                              disabled={i.qty >= i.available}
                              className={styles.quantityButton}
                            >
                              <AddRounded fontSize="small" />
                            </IconButton>
                          </Box>
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}

            {display.length > 0 ? (
              <Box className={styles.cartFooter}>
                <Box className={styles.subtotalRow}>
                  <Box>
                    <Typography className={styles.subtotalLabel}>
                      Subtotal
                    </Typography>
                    <Typography className={styles.supportNote}>
                      Shipping calculated at checkout
                    </Typography>
                  </Box>
                  <Typography className={styles.subtotal}>
                    ${(cartSubtotal / 100).toFixed(2)}
                  </Typography>
                </Box>
                <Box className={styles.cartActions}>
                  <Button
                    component={Link}
                    href="/store/cart"
                    fullWidth
                    variant="outlined"
                    onClick={() => setCartAnchor(null)}
                    className={styles.viewCart}
                  >
                    Review cart
                  </Button>
                  <Button
                    component={Link}
                    href="/store/checkout"
                    fullWidth
                    variant="contained"
                    endIcon={<ArrowForwardRounded />}
                    onClick={() => setCartAnchor(null)}
                    className={styles.checkout}
                  >
                    Checkout
                  </Button>
                </Box>
              </Box>
            ) : null}
          </Popover>
        </Box>

        {/* Mobile drawer */}
        <IconButton
          color="inherit"
          edge="end"
          className={styles.mobileMenuButton}
          sx={{ display: { xs: 'flex', md: 'none' } }}
          onClick={toggleDrawer(true)}
          aria-label="Open navigation"
        >
          <MenuIcon />
        </IconButton>
      </Toolbar>

      {/* Drawer for mobile */}
      <Drawer
        anchor="right"
        open={isDrawerOpen}
        onClose={toggleDrawer(false)}
        PaperProps={{ className: styles.drawerPaper }}
      >
        <Box className={styles.drawerHeader}>
          <Typography component="p">The Avalanche Hour</Typography>
          <Typography component="span">Field navigation</Typography>
        </Box>
        <Box sx={{ width: 300, pt: 1 }}>
          <List>
            <ListItem button component="a" href="/" onClick={toggleDrawer(false)}>
              <ListItemIcon sx={{ minWidth: 36 }}><Home /></ListItemIcon>
              <ListItemText primary="Home" />
            </ListItem>

            <ListItem sx={{ backgroundColor: 'grey.50', mt: 1 }}>
              <ListItemText primary="Episodes" primaryTypographyProps={{ variant: 'subtitle2', fontWeight: 600, color: 'primary.main' }} />
            </ListItem>
            {[
              { text: 'All Episodes', link: '/episodes', icon: <PlayArrow /> },
              { text: 'Current Season', link: '/episodes/current', icon: <TrendingUp /> },
              { text: 'Past Seasons', link: '/episodes/archive', icon: <History /> },
            ].map((item) => (
              <ListItem button key={item.text} component="a" href={item.link} onClick={toggleDrawer(false)} sx={{ pl: 3 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}

            <ListItem sx={{ backgroundColor: 'grey.50', mt: 1 }}>
              <ListItemText primary="Contact" primaryTypographyProps={{ variant: 'subtitle2', fontWeight: 600, color: 'primary.main' }} />
            </ListItem>
            {[
              { text: 'Contact Us', link: '/contact', icon: <Email /> },
              { text: 'Be a Guest', link: '/be-a-guest', icon: <Mic /> },
            ].map((item) => (
              <ListItem button key={item.text} component="a" href={item.link} onClick={toggleDrawer(false)} sx={{ pl: 3 }}>
                <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}

            <ListItem sx={{ backgroundColor: 'grey.50', mt: 1 }}>
              <ListItemText primary="Store" primaryTypographyProps={{ variant: 'subtitle2', fontWeight: 600, color: 'primary.main' }} />
            </ListItem>
            <ListItem button component="a" href="/store" onClick={toggleDrawer(false)} sx={{ pl: 3 }}>
              <ListItemIcon sx={{ minWidth: 36 }}><Storefront /></ListItemIcon>
              <ListItemText primary="Browse Products" />
            </ListItem>
            <ListItem button component="a" href="/store/cart" onClick={toggleDrawer(false)} sx={{ pl: 3 }}>
              <ListItemIcon sx={{ minWidth: 36 }}><ShoppingCart /></ListItemIcon>
              <ListItemText primary="Cart" />
            </ListItem>
            <ListItem button component="a" href="/store/checkout" onClick={toggleDrawer(false)} sx={{ pl: 3 }}>
              <ListItemIcon sx={{ minWidth: 36 }}><ShoppingCart /></ListItemIcon>
              <ListItemText primary="Checkout" />
            </ListItem>

            {menuItems.map((item) => (
              <ListItem
                button
                key={item.text}
                component="a"
                href={item.link}
                onClick={toggleDrawer(false)}
                target={item.text === 'Donate' ? '_blank' : undefined}
                rel={item.text === 'Donate' ? 'noopener noreferrer' : undefined}
                aria-label={
                  item.text === 'Donate'
                    ? 'Donate (opens in a new tab)'
                    : undefined
                }
                sx={{ mt: 1 }}
              >
                <ListItemText primary={item.text} />
              </ListItem>
            ))}

            <ListItem
              button
              component="a"
              href={SOCIAL_LINKS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              onClick={toggleDrawer(false)}
              sx={{ mt: 1 }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}><Instagram /></ListItemIcon>
              <ListItemText primary="Instagram" />
            </ListItem>
          </List>
        </Box>
      </Drawer>
    </AppBar>
  );
}
