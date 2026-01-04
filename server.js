require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.warn('Warning: MONGO_URI is not set.');
}

app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Serve top-level images folder so <img src="/images/..."> works when images are stored outside `public`
app.use('/images', express.static(path.join(__dirname, 'images')));

// Routes (wrapped with a helper so missing route files won't crash the server)
function safeUseRoute(routePath, modulePath) {
  try {
    const mod = require(modulePath);
    app.use(routePath, mod);
  } catch (err) {
    // Print a helpful warning so deploy logs show which route did not load
    console.warn(`Route not loaded: ${modulePath} -> ${err && err.message ? err.message : err}`);
  }
}

safeUseRoute('/api/extensions', './routes/extensions');
safeUseRoute('/api/customers', './routes/customers');
safeUseRoute('/api/milk-entries', './routes/milkEntries');
safeUseRoute('/api/items', './routes/items');
safeUseRoute('/api/products', './routes/products');
safeUseRoute('/api/milk-prices', './routes/milkPrices');
// Optional test route (kept for manual triggers)
safeUseRoute('/test', './routes/test');

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Connect DB & start server
mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => {
    console.log('Connected to MongoDB Atlas');

    // ✅ Start cron ONLY after DB connects
    const archiveAndReset = require('./jobs/monthlyArchiveAndReset');

    cron.schedule('5 0 1 * *', async () => {
      console.log('Running monthly archive & reset...');
      await archiveAndReset();
    });

    // Daily carry-forward job: copies last known cow & buffalo to today's entry for customers
    // If you want to disable this behavior, set DISABLE_DAILY_CARRY=true in your env
    if (!process.env.DISABLE_DAILY_CARRY) {
      try {
        const dailyCarryForward = require('./jobs/dailyCarryForward');
        const carryCron = process.env.DAILY_CARRY_CRON || '0 0 * * *'; // default: midnight server time
        cron.schedule(carryCron, async () => {
          console.log('Running daily carry-forward job...');
          try {
            const summary = await dailyCarryForward({ timezone: process.env.TZ });
            console.log('Daily carry-forward summary:', summary);
          } catch (err) {
            console.error('Daily carry-forward job failed:', err && err.message ? err.message : err);
          }
        });
      } catch (err) {
        console.warn('Daily carry-forward job not loaded:', err && err.message ? err.message : err);
      }
    } else {
      console.log('Daily carry-forward job is disabled via DISABLE_DAILY_CARRY=true');
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
