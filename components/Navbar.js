// components/Navbar.js
import React, { useState, useEffect } from 'react';
import {
  AppBar, Toolbar, Typography, Button, IconButton, Drawer, List, ListItem, ListItemText,
  Box, Menu, MenuItem, ListItemIcon, Badge, Popover, Divider
} from '@mui/material';
import {
  Menu as MenuIcon, ExpandMore, PlayArrow, TrendingUp, History, Email, Mic, Home,
  ShoppingCart, Storefront
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { products } from '../src/data/products';

const CART_KEY = 'ah_cart';

const Logo = styled('img')({ height: '40px', marginRight: '16px' });
const HomeLink = styled(Link)({
  display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit', flexGrow: 1,
  '&:hover': { opacity: 0.8 },
});

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
    return p
      ? {
          ...p,
          key: cartLineKey(item),
          options: options || {},
          price: item.price || p.price,
          qty,
          sku: item.sku,
          available: getAvailableForItem(item),
        }
      : null;
  }).filter(Boolean);

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
    { text: 'Donate', link: 'https://www.paypal.com/donate?hosted_button_id=4UMMRC9CCBQ3A' },
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
    <AppBar position="sticky">
      <Toolbar>
        <HomeLink href="/">
          <Logo src="/images/logo.png" alt="The Avalanche Hour Logo" />
          <Typography variant="h4" sx={{ fontFamily: 'Amatic SC, sans-serif' }}>
            The Avalanche Hour Podcast
          </Typography>
        </HomeLink>

        {/* Desktop */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
          <Button color="inherit" onClick={handleEpisodeMenuOpen} endIcon={<ExpandMore />} sx={{ textTransform: 'none' }}>Episodes</Button>
          <Menu anchorEl={episodeMenuAnchor} open={Boolean(episodeMenuAnchor)} onClose={handleEpisodeMenuClose} PaperProps={{ sx: { mt: 1, minWidth: 250 } }}>
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

          <Button color="inherit" onClick={handleContactMenuOpen} endIcon={<ExpandMore />} sx={{ textTransform: 'none' }}>Contact</Button>
          <Menu anchorEl={contactMenuAnchor} open={Boolean(contactMenuAnchor)} onClose={handleContactMenuClose} PaperProps={{ sx: { mt: 1, minWidth: 250 } }}>
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
            <Button key={item.text} color="inherit" href={item.link} target={item.text === 'Donate' ? '_blank' : undefined} sx={{ textTransform: 'none' }}>
              {item.text}
            </Button>
          ))}

          {/* Quick cart popover (variant-aware) */}
          <IconButton color="inherit" aria-label="Cart" onClick={(e) => setCartAnchor(e.currentTarget)}>
            <Badge badgeContent={totalItems} color="primary"><ShoppingCart /></Badge>
          </IconButton>
          <Popover
            open={cartOpen}
            anchorEl={cartAnchor}
            onClose={() => setCartAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            PaperProps={{ sx: { width: 360, p: 1 } }}
          >
            <Typography sx={{ px: 1.5, py: 1, fontWeight: 700 }}>Cart</Typography>
            <Divider />
            {display.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>Your cart is empty.</Typography>
            ) : (
              <List dense>
                {display.map((i) => {
                  const optionLabel = [
                    i.options?.color ? i.options.color : null,
                    i.options?.size ? i.options.size : null
                  ].filter(Boolean).join(' · ');
                  return (
                    <ListItem key={i.key} sx={{ alignItems: 'flex-start' }}>
                      <ListItemText
                        disableTypography
                        primary={
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                            <Typography sx={{ fontWeight: 600, mr: 1 }}>
                              {i.name}
                              {optionLabel ? (
                                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: .5 }}>
                                  {' '}{optionLabel}
                                </Typography>
                              ) : null}
                            </Typography>
                            <Typography>${(i.price / 100).toFixed(2)}</Typography>
                          </Box>
                        }
                        secondary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Button size="small" variant="outlined" onClick={() => dec(i.key)}>-</Button>
                            <Typography variant="body2">Qty: {i.qty}</Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              onClick={() => inc(i.key)}
                              disabled={i.qty >= i.available}
                            >
                              +
                            </Button>
                          </Box>
                        }
                      />
                    </ListItem>
                  );
                })}
              </List>
            )}
            <Box sx={{ display: 'flex', gap: 1, p: 1 }}>
              <Button component={Link} href="/store/cart" fullWidth variant="outlined" onClick={() => setCartAnchor(null)}>View Cart</Button>
              <Button component={Link} href="/store/checkout" fullWidth variant="contained" onClick={() => setCartAnchor(null)}>Checkout</Button>
            </Box>
          </Popover>
        </Box>

        {/* Mobile drawer */}
        <IconButton color="inherit" edge="start" sx={{ display: { xs: 'flex', md: 'none' } }} onClick={toggleDrawer(true)}>
          <MenuIcon />
        </IconButton>
      </Toolbar>

      {/* Drawer for mobile */}
      <Drawer anchor="right" open={isDrawerOpen} onClose={toggleDrawer(false)}>
        <Box sx={{ width: 280, pt: 2 }}>
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
              <ListItem button key={item.text} component="a" href={item.link} onClick={toggleDrawer(false)} target={item.text === 'Donate' ? '_blank' : undefined} sx={{ mt: 1 }}>
                <ListItemText primary={item.text} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </AppBar>
  );
}
