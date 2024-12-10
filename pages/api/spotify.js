import fetch from 'node-fetch';

const client_id = process.env.SPOTIFY_CLIENT_ID; // Spotify Client ID
const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Spotify Client Secret
const podcast_show_id = '1BNdDDvI4drM0vRIn5kKlU'; // Spotify podcast show ID

async function getAccessToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${client_id}:${client_secret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  if (!data.access_token) {
    throw new Error('Failed to fetch Spotify access token.');
  }
  return data.access_token;
}

export default async function handler(req, res) {
  try {
    const accessToken = await getAccessToken();

    const fetchEpisodes = async (url) => {
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(`Error fetching episodes: ${response.statusText}. Details: ${errorDetails}`);
      }

      return response.json();
    };

    let episodes = [];
    let url = `https://api.spotify.com/v1/shows/${podcast_show_id}/episodes`;

    do {
      const data = await fetchEpisodes(url);
      episodes = episodes.concat(data.items);
      url = data.next;

      // Add delay to prevent rate-limiting
      if (url) await new Promise((resolve) => setTimeout(resolve, 500));
    } while (url);

    res.status(200).json(episodes);
  } catch (error) {
    console.error('Error fetching Spotify data:', error.message);
    res.status(500).json({ error: error.message || 'Failed to fetch episodes from Spotify.' });
  }
}