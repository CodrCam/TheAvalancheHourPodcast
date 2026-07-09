// components/SEO.js
import Head from 'next/head';
import {
  ORGANIZATION_ID,
  PODCAST_ID,
  SITE_DESCRIPTION,
  SITE_IMAGE_PATH,
  SITE_IMAGE_URL,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_URL,
  WEBSITE_ID,
  absoluteUrl,
} from '../lib/siteMetadata';

export default function SEO({
  title = SITE_NAME,
  description = SITE_DESCRIPTION,
  keywords = SITE_KEYWORDS.join(', '),
  image = SITE_IMAGE_PATH,
  url = SITE_URL,
  type = 'website',
  publishedTime,
  modifiedTime,
  author = 'The Avalanche Hour Team',
  podcast = false,
  episode = null
}) {
  const fullTitle = title.includes('The Avalanche Hour') ? title : `${title} | ${SITE_NAME}`;
  const canonicalUrl = absoluteUrl(url);
  const imageUrl = image.startsWith('http') ? image : absoluteUrl(image);

  return (
    <Head>
      {/* Primary Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="title" content={fullTitle} />
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <meta name="robots" content="index, follow" />
      <meta name="language" content="English" />
      <meta name="theme-color" content="#1976d2" />
      <meta name="application-name" content={SITE_NAME} />
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={`${SITE_NAME} logo`} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="en_US" />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={canonicalUrl} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={imageUrl} />
      <meta property="twitter:image:alt" content={`${SITE_NAME} logo`} />
      <meta name="twitter:creator" content="@theavalanchehour" />
      
      {/* Article specific tags */}
      {publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      {type === 'article' && <meta property="article:author" content={author} />}
      
      {/* Podcast specific structured data */}
      {podcast && episode && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "PodcastEpisode",
              "url": canonicalUrl,
              "name": episode.name,
              "description": episode.description,
              "datePublished": episode.release_date,
              "duration": episode.duration_ms ? `PT${Math.floor(episode.duration_ms / 1000)}S` : undefined,
              "partOfSeries": {
                "@type": "PodcastSeries",
                "@id": PODCAST_ID,
                "name": SITE_NAME,
                "url": SITE_URL
              },
              "associatedMedia": {
                "@type": "MediaObject",
                "contentUrl": episode.external_urls?.spotify,
                "encodingFormat": "audio/mpeg"
              }
            })
          }}
        />
      )}
      
      {/* Website structured data */}
      {!podcast && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "@id": WEBSITE_ID,
              "name": SITE_NAME,
              "alternateName": "The Avalanche Hour",
              "url": SITE_URL,
              "description": SITE_DESCRIPTION,
              "inLanguage": "en-US",
              "image": SITE_IMAGE_URL,
              "publisher": {
                "@type": "Organization",
                "@id": ORGANIZATION_ID,
                "name": SITE_NAME
              },
              "keywords": SITE_KEYWORDS.join(', '),
              "potentialAction": {
                "@type": "SearchAction",
                "target": `${SITE_URL}/episodes?search={search_term_string}`,
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      )}
    </Head>
  );
}
