import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box } from '@mui/material';
import { styled } from '@mui/material/styles';

const Logo = styled('img')({
  height: '40px',
  marginRight: '16px',
});

export default function Navbar() {
  return (
    <AppBar position="sticky">
      <Toolbar>
        {/* Logo on the top-left */}
        <Logo src="/images/logo.png" alt="The Avalanche Hour Logo" />
        <Typography
          variant="h4"
          sx={{
            flexGrow: 1,
            fontFamily: "'Amatic SC', sans-serif", // Add font style inline
            fontWeight: 700,
          }}
        >
          The Avalanche Hour Podcast
        </Typography>
        <Button color="inherit" href="/">
          Home
        </Button>
        <Button color="inherit" href="/episodes">
          Episodes
        </Button>
        <Button color="inherit" href="/about">
          About
        </Button>
        <Button color="inherit" href="/resources">
          Resources
        </Button>
        <Button color="inherit" href="/contact">
          Contact
        </Button>
        <Button
          color="inherit"
          href="https://www.paypal.com/donate?hosted_button_id=4UMMRC9CCBQ3A"
          target="_blank"
          rel="noopener noreferrer"
        >
          Donate
        </Button>
      </Toolbar>
    </AppBar>
  );
}