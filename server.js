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

// Routes
app.use('/api/extensions', require('./routes/extensions'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/milk-entries', require('./routes/milkEntries'));
app.use('/api/items', require('./routes/items'));
app.use('/api/products', require('./routes/products'));
app.use('/api/milk-prices', require('./routes/milkPrices'));
app.use('/test', require('./routes/test')); // test route

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

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
