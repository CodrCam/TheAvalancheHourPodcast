# The Avalanche Hour Podcast Website

Welcome to the official repository for **The Avalanche Hour Podcast Website**. This project is designed to provide an engaging platform for sharing episodes, organizing them into seasons, and offering a seamless user experience with dynamic search and Spotify API integration.

---

## 🌟 Features

- **Episodes Page**: Browse all podcast episodes with details like description, release date, and guest information.
- **Season Organization**: Automatically groups episodes into seasons based on release date.
- **Global Search**: Search episodes across all seasons by title or description.
- **Spotify Integration**: Dynamically fetches podcast episodes using the Spotify API.
- **Responsive Design**: Optimized for viewing on desktops, tablets, and mobile devices.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js](https://nextjs.org/)
- **UI Library**: [Material-UI (MUI)](https://mui.com/)
- **API Integration**: [Spotify Web API](https://developer.spotify.com/documentation/web-api/)
- **Language**: JavaScript
- **Hosting**: [https://www.theavalanchehour.com](https://www.theavalanchehour.com)

---

## 🚀 Installation

### Prerequisites

- Node.js installed ([Download](https://nodejs.org/))
- Git installed ([Download](https://git-scm.com/))

### Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/CodrCam/the-avalanche-hour.git
   cd the-avalanche-hour

	2.	Install dependencies:

npm install


	3.	Add your .env.local file with the following variables:

SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret


	4.	Start the development server:

npm run dev


	5.	Open the application in your browser at http://localhost:3000.

📚 Usage

Spotify Integration

The app dynamically fetches podcast episodes using the Spotify API. Make sure to set up your Spotify Developer Account and configure the SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in the .env.local file.

Search and Seasons

	•	Use the season dropdown menu to filter episodes by season.
	•	Enter keywords in the search bar to find episodes across all seasons.

🛡️ Deployment

This project is hosted on Vercel.

	1.	Deploy the repository to Vercel:
	•	Connect the GitHub repository to your Vercel account.
	•	Add your .env variables in the Vercel dashboard.
	2.	The site will be available at your Vercel-provided URL (e.g., https://the-avalanche-hour.vercel.app).

👥 Contributors

	•	CodrCam - Lead Developer (GitHub)
	•	Special thanks to Spotify and Material-UI for their tools and documentation.

📝 License

This project is licensed under the MIT License. See the LICENSE file for details.

🌐 Live Demo

Check out the live version of the website: The Avalanche Hour Podcast.

🛠️ Future Enhancements

	•	Add user accounts for saving favorite episodes.
	•	Implement advanced analytics for tracking user engagement.
	•	Enhance SEO for better discoverability of episodes.