// pages/api/spotify.js - with performance monitoring

const client_id = process.env.SPOTIFY_CLIENT_ID;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
const podcast_show_id = '1BNdDDvI4drM0vRIn5kKlU';

// Simple in-memory cache
let cache = {
  data: null,
  timestamp: null,
  ttl: 30 * 60 * 1000 // 30 minutes
};

// Performance measurement helper for API routes
function measureAsync(name, asyncFn) {
  return async (...args) => {
    const start = performance.now();
    console.log(`🚀 Starting: ${name}`);
    
    try {
      const result = await asyncFn(...args);
      const duration = performance.now() - start;
      console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      console.error(`❌ ${name} failed: ${duration.toFixed(2)}ms`, error.message);
      throw error;
    }
  };
}

const getSpotifyToken = measureAsync('Spotify Token Fetch', async () => {
  console.log('🔑 Getting Spotify access token...');
  
  if (!client_id || !client_secret) {
    throw new Error('Missing Spotify credentials in environment variables');
  }

  const credentials = Buffer.from(`${client_id}:${client_secret}`).toString('base64');
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('❌ Spotify token error:', response.status, errorText);
    throw new Error(`Failed to get Spotify token: ${response.status}`);
  }

  const data = await response.json();
  console.log('✅ Got Spotify access token');
  return data.access_token;
});

const fetchSpotifyEpisodes = measureAsync('Spotify Episodes Fetch', async (token) => {
  console.log('📻 Fetching episodes from Spotify...');
  
  let allEpisodes = [];
  let url = `https://api.spotify.com/v1/shows/${podcast_show_id}/episodes?market=US&limit=50`;
  let pageCount = 0;
  const maxPages = 20; // Safety limit

  while (url && pageCount < maxPages) {
    pageCount++;
    const pageStart = performance.now();
    
    console.log(`📄 Fetching page ${pageCount}...`);

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Spotify episodes error:', response.status, errorText);
      throw new Error(`Failed to fetch episodes: ${response.status}`);
    }

    const data = await response.json();
    const episodes = data.items || [];
    
    allEpisodes = allEpisodes.concat(episodes);
    url = data.next; // Next page URL from Spotify
    
    const pageTime = performance.now() - pageStart;
    console.log(`✅ Page ${pageCount}: Got ${episodes.length} episodes in ${pageTime.toFixed(2)}ms (Total: ${allEpisodes.length})`);
    
    // Add small delay to be polite to Spotify's API
    if (url) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  console.log(`🎯 Total episodes fetched: ${allEpisodes.length}`);
  return allEpisodes;
});

function isValidCache() {
  return cache.data && 
         cache.timestamp && 
         (Date.now() - cache.timestamp) < cache.ttl;
}

export default async function handler(req, res) {
  const apiStart = performance.now();
  console.log('🚀 API /api/spotify called');

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Return cached data if still valid
    if (isValidCache()) {
      const cacheTime = performance.now() - apiStart;
      console.log(`💾 Returning cached data (${cacheTime.toFixed(2)}ms)`);
      return res.status(200).json(cache.data);
    }

    console.log('🔄 Cache expired or empty, fetching fresh data');

    // Get fresh data with performance monitoring
    const token = await getSpotifyToken();
    const episodes = await fetchSpotifyEpisodes(token);

    // Process and clean the episodes data
    const processingStart = performance.now();
    
    const cleanEpisodes = episodes
      .filter(episode => episode && episode.id)
      .map(episode => ({
        id: episode.id,
        name: episode.name || 'Untitled Episode',
        description: episode.description || '',
        release_date: episode.release_date,
        duration_ms: episode.duration_ms,
        external_urls: episode.external_urls || {},
        images: episode.images || [],
        explicit: episode.explicit || false,
        uri: episode.uri
      }))
      .sort((a, b) => new Date(b.release_date) - new Date(a.release_date));

    const processingTime = performance.now() - processingStart;
    console.log(`⚙️ Data processing: ${processingTime.toFixed(2)}ms`);

    // Update cache
    cache.data = cleanEpisodes;
    cache.timestamp = Date.now();

    const totalTime = performance.now() - apiStart;
    console.log(`✅ API completed in ${totalTime.toFixed(2)}ms - Returning ${cleanEpisodes.length} episodes`);

    // Set cache headers
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=3600');
    res.setHeader('X-Response-Time', `${totalTime.toFixed(2)}ms`);
    
    return res.status(200).json(cleanEpisodes);

  } catch (error) {
    const errorTime = performance.now() - apiStart;
    console.error(`💥 API Error after ${errorTime.toFixed(2)}ms:`, error.message);

    // If we have cached data, return it even if stale
    if (cache.data) {
      console.log('🩹 Returning stale cached data due to error');
      return res.status(200).json(cache.data);
    }

    // No cached data available, return error
    return res.status(500).json({
      error: 'Failed to fetch episodes',
      message: error.message,
      responseTime: `${errorTime.toFixed(2)}ms`,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}