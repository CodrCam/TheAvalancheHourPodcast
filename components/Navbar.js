// components/Navbar.js
import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Box,
  Menu,
  MenuItem,
  ListItemIcon
} from '@mui/material';
import { 
  Menu as MenuIcon, 
  ExpandMore, 
  PlayArrow, 
  TrendingUp, 
  History,
  Email,
  Mic,
  Home
} from '@mui/icons-material';
import { styled } from '@mui/material/styles';
import { useRouter } from 'next/router';
import Link from 'next/link';

const Logo = styled('img')({
  height: '40px',
  marginRight: '16px',
});

const HomeLink = styled(Link)({
  display: 'flex',
  alignItems: 'center',
  textDecoration: 'none',
  color: 'inherit',
  flexGrow: 1,
  '&:hover': {
    opacity: 0.8,
  },
});

export default function Navbar() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [episodeMenuAnchor, setEpisodeMenuAnchor] = useState(null);
  const [contactMenuAnchor, setContactMenuAnchor] = useState(null);
  const router = useRouter();

  const toggleDrawer = (open) => () => {
    setIsDrawerOpen(open);
  };

  const handleEpisodeMenuOpen = (event) => {
    setEpisodeMenuAnchor(event.currentTarget);
  };

  const handleEpisodeMenuClose = () => {
    setEpisodeMenuAnchor(null);
  };

  const handleContactMenuOpen = (event) => {
    setContactMenuAnchor(event.currentTarget);
  };

  const handleContactMenuClose = () => {
    setContactMenuAnchor(null);
  };

  const handleMenuItemClick = (path) => {
    handleEpisodeMenuClose();
    handleContactMenuClose();
    router.push(path);
  };

  const menuItems = [
    { text: 'About', link: '/about' },
    { text: 'Resources', link: '/resources' },
    { text: 'Donate', link: 'https://www.paypal.com/donate?hosted_button_id=4UMMRC9CCBQ3A' },
  ];

  const episodeMenuItems = [
    { 
      text: 'All Episodes', 
      link: '/episodes', 
      icon: <PlayArrow />,
      description: 'Browse all episodes'
    },
    { 
      text: 'Current Season', 
      link: '/episodes/current', 
      icon: <TrendingUp />,
      description: 'Latest episodes'
    },
    { 
      text: 'Past Seasons', 
      link: '/episodes/archive', 
      icon: <History />,
      description: 'Complete archive'
    },
  ];

  const contactMenuItems = [
    { 
      text: 'Contact Us', 
      link: '/contact', 
      icon: <Email />,
      description: 'General inquiries & feedback'
    },
    { 
      text: 'Be a Guest', 
      link: '/be-a-guest', 
      icon: <Mic />,
      description: 'Apply to be on the show'
    },
  ];

  return (
    <AppBar position="sticky">
      <Toolbar>
        {/* Clickable Logo and Title */}
        <HomeLink href="/">
          <Logo src="/images/logo.png" alt="The Avalanche Hour Logo" />
          <Typography variant="h4" sx={{ fontFamily: 'Amatic SC, sans-serif' }}>
            The Avalanche Hour Podcast
          </Typography>
        </HomeLink>

        {/* Desktop Menu */}
        <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
          
          {/* Episodes Dropdown */}
          <Button
            color="inherit"
            onClick={handleEpisodeMenuOpen}
            endIcon={<ExpandMore />}
            sx={{ textTransform: 'none' }}
          >
            Episodes
          </Button>
          
          <Menu
            anchorEl={episodeMenuAnchor}
            open={Boolean(episodeMenuAnchor)}
            onClose={handleEpisodeMenuClose}
            PaperProps={{
              sx: { mt: 1, minWidth: 250 }
            }}
          >
            {episodeMenuItems.map((item) => (
              <MenuItem 
                key={item.text}
                onClick={() => handleMenuItemClick(item.link)}
                sx={{ py: 1.5 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {item.text}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Menu>

          {/* Contact Dropdown */}
          <Button
            color="inherit"
            onClick={handleContactMenuOpen}
            endIcon={<ExpandMore />}
            sx={{ textTransform: 'none' }}
          >
            Contact
          </Button>
          
          <Menu
            anchorEl={contactMenuAnchor}
            open={Boolean(contactMenuAnchor)}
            onClose={handleContactMenuClose}
            PaperProps={{
              sx: { mt: 1, minWidth: 250 }
            }}
          >
            {contactMenuItems.map((item) => (
              <MenuItem 
                key={item.text}
                onClick={() => handleMenuItemClick(item.link)}
                sx={{ py: 1.5 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {item.text}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {item.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Menu>

          {/* Other Menu Items */}
          {menuItems.map((item) => (
            <Button
              key={item.text}
              color="inherit"
              href={item.link}
              target={item.text === 'Donate' ? '_blank' : undefined}
            >
              {item.text}
            </Button>
          ))}
        </Box>

        {/* Hamburger Menu for Mobile */}
        <IconButton
          color="inherit"
          edge="start"
          sx={{ display: { xs: 'flex', md: 'none' } }}
          onClick={toggleDrawer(true)}
        >
          <MenuIcon />
        </IconButton>
      </Toolbar>

      {/* Drawer for Mobile Menu */}
      <Drawer anchor="right" open={isDrawerOpen} onClose={toggleDrawer(false)}>
        <Box sx={{ width: 280, pt: 2 }}>
          <List>
            {/* Home Link in Mobile */}
            <ListItem
              button
              component="a"
              href="/"
              onClick={toggleDrawer(false)}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Home />
              </ListItemIcon>
              <ListItemText primary="Home" />
            </ListItem>
            
            {/* Episodes Section in Mobile */}
            <ListItem sx={{ backgroundColor: 'grey.50', mt: 1 }}>
              <ListItemText 
                primary="Episodes" 
                primaryTypographyProps={{ 
                  variant: 'subtitle2', 
                  fontWeight: 600,
                  color: 'primary.main' 
                }} 
              />
            </ListItem>
            
            {episodeMenuItems.map((item) => (
              <ListItem
                button
                key={item.text}
                component="a"
                href={item.link}
                onClick={toggleDrawer(false)}
                sx={{ pl: 3 }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  secondary={item.description}
                />
              </ListItem>
            ))}

            {/* Contact Section in Mobile */}
            <ListItem sx={{ backgroundColor: 'grey.50', mt: 1 }}>
              <ListItemText 
                primary="Contact" 
                primaryTypographyProps={{ 
                  variant: 'subtitle2', 
                  fontWeight: 600,
                  color: 'primary.main' 
                }} 
              />
            </ListItem>
            
            {contactMenuItems.map((item) => (
              <ListItem
                button
                key={item.text}
                component="a"
                href={item.link}
                onClick={toggleDrawer(false)}
                sx={{ pl: 3 }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text}
                  secondary={item.description}
                />
              </ListItem>
            ))}

            {/* Other Menu Items */}
            {menuItems.map((item) => (
              <ListItem
                button
                key={item.text}
                component="a"
                href={item.link}
                onClick={toggleDrawer(false)}
                target={item.text === 'Donate' ? '_blank' : undefined}
                sx={{ mt: 1 }}
              >
                <ListItemText primary={item.text} />
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </AppBar>
  );
}