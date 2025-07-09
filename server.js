require('dotenv').config();
const fs = require('fs');

const express = require('express');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

console.log("🔎 .env file exists?", fs.existsSync('.env'));
console.log("🔐 GOOGLE_API_KEY =", process.env.GOOGLE_API_KEY);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files (if you add CSS, images, etc. later)
app.use(express.static('public'));

// API route to fetch reviews
app.get('/api/reviews', async (req, res) => {
  const placeId = 'ChIJLf5g-o3lwokRqaRfyFWdrRI'; // Replace with your pizzeria's real Place ID
  const apiKey = process.env.GOOGLE_API_KEY;

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,reviews&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    console.log("➡️ Google API URL:", url);
    console.log("📥 Full Google API response:");
    console.log(JSON.stringify(data, null, 2));

    if (data.status === 'OK') {
      res.json(data.result.reviews);
    } else {
      console.error('Google API error:', data.status);
      res.status(400).json({ error: data.status, message: data.error_message });
    }
  } catch (err) {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Server error', details: err.message});
  }
});

// Serve the HTML with embedded script
app.get('/', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>Pizza Reviews</title>
        <style>
          body { font-family: sans-serif; padding: 20px; }
          .review { margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px; }
        </style>
      </head>
      <body>
        <h2>Google Reviews</h2>
        <div id="google-reviews">Loading reviews...</div>

        <script>
          fetch('/api/reviews')
            .then(res => res.json())
            .then(reviews => {
              const container = document.getElementById('reviews');
              container.innerHTML = '';

              if (!reviews || !reviews.length) {
                container.innerHTML = '<p>No reviews found.</p>';
                return;
              }

              reviews.forEach(review => {
                const div = document.createElement('div');
                div.className = 'review';
                div.innerHTML = "
                  <strong>${review.author_name}</strong> - ⭐️ ${review.rating}<br>
                  <em>${review.relative_time_description}</em>
                  <p>${review.text}</p>
                ";
                container.appendChild(div);
              });
            })
            .catch(err => {
              console.error('Failed to fetch reviews:', err);
              document.getElementById('reviews').innerHTML = '<p>Error loading reviews.</p>';
            });
        </script>
      </body>
    </html>
  `);
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
