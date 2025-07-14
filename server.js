require('dotenv').config();
const fs = require('fs');

const express = require('express');
const Stripe = require('stripe');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const PORT = process.env.PORT || 4242;

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const nodemailer = require('nodemailer');

const twilio = require('twilio');

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

let transporter;

(async () => {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
})();

// Serve static files (if you add CSS, images, etc. later)
app.use(express.static('public'));
app.use(express.json());
app.use('/webhook', express.raw({ type: 'application/json' }));

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

app.post('/webhook', (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;

    console.log('Payment succeeded, sending email and SMS...');

    transporter.sendMail({
      from: `"Pizza Preview" <${process.env.EMAIL_USER}>`,
      to: "amarona349@gmail.com",
      subject: "Order Confirmation",
      text: `New Order:
      - 1x Large Pepperoni Pizza
      - 2x Coke
      Pickup: 7:15 PM
      Paid: $18.25`,
      html: `<b>New Order: </b><p>
      - 1x Large Pepperoni Pizza
      - 2x Coke
      Pickup: 7:15 PM
      Paid: $18.25
      </p>`,
    }).catch(e => console.error('Email send error:', e));

    twilioClient.messages.create({
      body: `New Order:
      - 1x Large Pepperoni Pizza
      - 2x Coke
      Pickup: 7:15 PM
      Paid: $18.25`,
      from: process.env.TWILIO_PHONE_FROM,
      to: process.env.TWILIO_PHONE_TO,
    }).then(() => {
      console.log('SMS sent successfully!');
    }).catch(twilioErr => {
      console.error('Twilio error:', twilioErr);
    });
  } 

  res.json({ received: true });
});

// API route to fetch reviews
app.get('/api/reviews', async (req, res) => {
  const placeId = 'ChIJwSPRlqf6wokR_Uxs4NwgrmI'; // Replace with your pizzeria's real Place ID
  const apiKey = process.env.GOOGLE_API_KEY;

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,reviews&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

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
              const container = document.getElementById('google-reviews');
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

app.get('/success', (req, res) => {
  res.send('<h1>Payment successful!</h1><p>Thank you for your order!</p>');
});

app.get('/cancel', (req, res) => {
  res.send('<h1>Order canceled</h1><p>You canceled your order. Feel free to try again!</p>');
})

app.post('/create-checkout-session', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Italian Hero',
            },
            unit_amount: 695,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'BLT Sandwich',
            },
            unit_amount: 495,
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Macaroni Salad',
            },
            unit_amount: 495,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: 'https://pizza-preview.onrender.com/success.html',
      cancel_url: 'https://pizza-preview.onrender.com/index.html',
    });

    res.json({ id: session.id });
  } catch (err) {
    console.error('Stripe error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
