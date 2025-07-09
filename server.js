require('dotenv').config();

const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express(); // ← THIS was missing
const PORT = 3000;

const apiKey = process.env.GOOGLE_API_KEY; // Replace with your actual API key
const placeId = 'ChIJLf5g-o3lwokRqaRfyFWdrRI';

app.use(express.static('public')); // Serve static files from /public folder

app.get('/api/reviews', async (req, res) => {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,reviews&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log("🧪 Google API response:");
    console.dir(data, { depth: null });

    if (!data.result || !Array.isArray(data.result.reviews)) {
      return res.status(500).json({
        error: 'No valid reviews returned from Google',
        raw: data,
      });
    }

    res.json(data.result.reviews);
  } catch (err) {
    console.error("❌ Server error while fetching reviews:", err);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
