// pages/_document.js
import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          {/* DNS Prefetching for external resources */}
          <link rel="dns-prefetch" href="//fonts.googleapis.com" />
          <link rel="dns-prefetch" href="//fonts.gstatic.com" />
          <link rel="dns-prefetch" href="//api.spotify.com" />
          <link rel="dns-prefetch" href="//i.scdn.co" />
          
          {/* Preconnect to critical domains */}
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
          
          {/* Font loading with font-display swap for better performance */}
          <link
            href="https://fonts.googleapis.com/css2?family=Amatic+SC:wght@700&display=swap"
            rel="stylesheet"
          />
          
          {/* Preload critical fonts */}
          <link
            rel="preload"
            href="https://fonts.gstatic.com/s/amaticsc/v24/TUZyzwprpvBS1izr_vOMscDJuFEAcTEzJRo.woff2"
            as="font"
            type="font/woff2"
            crossOrigin="anonymous"
          />
          
          {/* Favicon and app icons */}
          <link rel="icon" href="/favicon.ico" />
          <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />
          <meta name="msapplication-TileColor" content="#1976d2" />
          <meta name="theme-color" content="#1976d2" />
          
          {/* Global site metadata */}
          <meta name="format-detection" content="telephone=no" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="Avalanche Hour" />
          
          {/* RSS Feed */}
          <link
            rel="alternate"
            type="application/rss+xml"
            title="The Avalanche Hour Podcast RSS Feed"
            href="/api/rss.xml"
          />
          
          {/* Podcast directories */}
          <link
            rel="alternate"
            type="application/json"
            title="The Avalanche Hour Podcast JSON Feed"
            href="/api/feed.json"
          />
          
          {/* Critical CSS inlining hint */}
          <style jsx global>{`
            /* Critical CSS for above-the-fold content */
            * {
              box-sizing: border-box;
            }
            
            body {
              margin: 0;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            
            /* Prevent layout shift during font loading */
            .amatic-loading {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            /* Reduce initial render blocking */
            img {
              max-width: 100%;
              height: auto;
            }
          `}</style>
          
          {/* Structured Data for Organization */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "The Avalanche Hour Podcast",
                "url": "https://www.theavalanchehour.com",
                "logo": "https://www.theavalanchehour.com/images/logo.png",
                "description": "Creating a stronger community through sharing stories, knowledge, and news amongst people who have a curious fascination with avalanches.",
                "sameAs": [
                  "https://open.spotify.com/show/your-show-id",
                  "https://podcasts.apple.com/podcast/your-podcast-id",
                  // Add other social media and podcast platform URLs
                ],
                "contactPoint": {
                  "@type": "ContactPoint",
                  "contactType": "Customer Service",
                  "email": "theavalanchehourpodcast@gmail.com"
                }
              })
            }}
          />
          
          {/* Performance monitoring (optional) */}
          {process.env.NODE_ENV === 'production' && (
            <>
              {/* Google Analytics or other analytics */}
              {/* Add your analytics code here */}
            </>
          )}
        </Head>
        <body>
          {/* No-JS fallback message */}
          <noscript>
            <div style={{
              padding: '20px',
              backgroundColor: '#f44336',
              color: 'white',
              textAlign: 'center'
            }}>
              JavaScript is required to use this website. Please enable JavaScript in your browser.
            </div>
          </noscript>
          
          <Main />
          <NextScript />
          
          {/* Service Worker registration for offline support */}
          {process.env.NODE_ENV === 'production' && (
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  if ('serviceWorker' in navigator) {
                    window.addEventListener('load', function() {
                      navigator.serviceWorker.register('/sw.js')
                        .then(function(registration) {
                          console.log('SW registered: ', registration);
                        })
                        .catch(function(registrationError) {
                          console.log('SW registration failed: ', registrationError);
                        });
                    });
                  }
                `
              }}
            />
          )}
        </body>
      </Html>
    );
  }
}

export default MyDocument;