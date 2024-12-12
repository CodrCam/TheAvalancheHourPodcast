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
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu'; // Hamburger menu icon
import { styled } from '@mui/material/styles';

const Logo = styled('img')({
  height: '40px',
  marginRight: '16px',
});

export default function Navbar() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const toggleDrawer = (open) => () => {
    setIsDrawerOpen(open);
  };

  const menuItems = [
    { text: 'Home', link: '/' },
    { text: 'Episodes', link: '/episodes' },
    { text: 'About', link: '/about' },
    { text: 'Resources', link: '/resources' },
    { text: 'Contact', link: '/contact' },
    { text: 'Donate', link: 'https://www.paypal.com/donate?hosted_button_id=4UMMRC9CCBQ3A' },
  ];

  return (
    <AppBar position="sticky">
      <Toolbar>
        {/* Logo */}
        <Logo src="/images/logo.png" alt="The Avalanche Hour Logo" />
        <Typography variant="h6" sx={{ flexGrow: 1, fontFamily: 'Amatic SC, sans-serif' }}>
          The Avalanche Hour Podcast
        </Typography>

        {/* Desktop Menu */}
        <Box sx={{ display: { xs: 'none', md: 'flex' } }}>
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
        <Box sx={{ width: 250 }}>
          <List>
            {menuItems.map((item) => (
              <ListItem
                button
                key={item.text}
                component="a"
                href={item.link}
                onClick={toggleDrawer(false)}
                target={item.text === 'Donate' ? '_blank' : undefined}
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