// pages/_app.js

import * as React from 'react';
import Head from 'next/head';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '../src/theme';

import '../styles/globals.css'; // Import the global CSS file

export default function MyApp({ Component, pageProps }) {
  return (
    <React.Fragment>
      <Head>
        <title>The Avalanche Hour Podcast</title>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Component {...pageProps} />
      </ThemeProvider>
    </React.Fragment>
  );
}