// components/SEO.js
import Head from 'next/head';

export default function SEO({
  title = 'The Avalanche Hour Podcast',
  description = 'Creating a stronger community through sharing stories, knowledge, and news amongst people who have a curious fascination with avalanches.',
  keywords = 'avalanche, podcast, snow science, backcountry safety, avalanche forecasting, winter sports, mountaineering',
  image = '/images/og-image.jpg', // You'll need to create this
  url = 'https://www.theavalanchehour.com',
  type = 'website',
  publishedTime,
  modifiedTime,
  author = 'The Avalanche Hour Team',
  podcast = false,
  episode = null
}) {
  const fullTitle = title.includes('The Avalanche Hour') ? title : `${title} | The Avalanche Hour Podcast`;
  const canonicalUrl = url.startsWith('http') ? url : `https://www.theavalanchehour.com${url}`;

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
      
      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image.startsWith('http') ? image : `https://www.theavalanchehour.com${image}`} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="The Avalanche Hour Podcast" />
      <meta property="og:locale" content="en_US" />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={canonicalUrl} />
      <meta property="twitter:title" content={fullTitle} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image.startsWith('http') ? image : `https://www.theavalanchehour.com${image}`} />
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
                "name": "The Avalanche Hour Podcast",
                "url": "https://www.theavalanchehour.com"
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
              "name": "The Avalanche Hour Podcast",
              "url": "https://www.theavalanchehour.com",
              "description": "Creating a stronger community through sharing stories, knowledge, and news amongst people who have a curious fascination with avalanches.",
              "publisher": {
                "@type": "Organization",
                "name": "The Avalanche Hour Podcast"
              },
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://www.theavalanchehour.com/episodes?search={search_term_string}",
                "query-input": "required name=search_term_string"
              }
            })
          }}
        />
      )}
    </Head>
  );
}