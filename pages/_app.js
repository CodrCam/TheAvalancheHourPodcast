// pages/_app.js

import * as React from 'react';
import Head from 'next/head';
import Script from 'next/script';
import { useRouter } from 'next/router';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from '../src/theme';
import VoicemailWidget from '../components/VoicemailWidget';
import {
  GA_MEASUREMENT_ID,
  isGoogleAnalyticsEnabled,
  pageview,
} from '../lib/gtag';

import '../styles/globals.css'; // Import the global CSS file

export default function MyApp({ Component, pageProps }) {
  const router = useRouter();
  const isAdminRoute = router.pathname.startsWith('/admin');
  const showVoicemailWidget = !isAdminRoute;
  const lastTrackedPathRef = React.useRef('');

  React.useEffect(() => {
    if (!isGoogleAnalyticsEnabled || isAdminRoute) return;

    const trackPageview = (url) => {
      if (url.startsWith('/admin') || lastTrackedPathRef.current === url) return;
      lastTrackedPathRef.current = url;
      pageview(url);
    };

    trackPageview(router.asPath);

    router.events.on('routeChangeComplete', trackPageview);

    return () => {
      router.events.off('routeChangeComplete', trackPageview);
    };
  }, [isAdminRoute, router.asPath, router.events]);

  return (
    <React.Fragment>
      <Head>
        <title>The Avalanche Hour Podcast</title>
        <meta name="viewport" content="initial-scale=1, width=device-width" />
      </Head>
      {isGoogleAnalyticsEnabled && !isAdminRoute ? (
        <>
          <Script
            strategy="afterInteractive"
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          />
          <Script id="google-analytics" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){window.dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_MEASUREMENT_ID}', { send_page_view: false });
            `}
          </Script>
        </>
      ) : null}
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Component {...pageProps} />
        {showVoicemailWidget ? <VoicemailWidget /> : null}
      </ThemeProvider>
    </React.Fragment>
  );
}
