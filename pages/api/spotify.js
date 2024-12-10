// pages/api/spotify.js

const client_id = process.env.SPOTIFY_CLIENT_ID; // Spotify Client ID to .env.local
const client_secret = process.env.SPOTIFY_CLIENT_SECRET; // Spotify Client Secret to .env.local
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
        throw new Error(`Error fetching episodes: ${response.statusText}`);
      }

      const data = await response.json();
      return data;
    };

    let episodes = [];
    let url = `https://api.spotify.com/v1/shows/${podcast_show_id}/episodes`;
    do {
      const data = await fetchEpisodes(url);
      episodes = episodes.concat(data.items);
      url = data.next; // `next` contains the URL for the next page of results
    } while (url);

    res.status(200).json(episodes); // Return all episodes
  } catch (error) {
    console.error('Error fetching Spotify data:', error);
    res.status(500).json({ error: 'Failed to fetch episodes from Spotify' });
  }
}