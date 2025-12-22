require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

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
const extensionRoutes = require('./routes/extensions');
const customerRoutes = require('./routes/customers');
const milkEntryRoutes = require('./routes/milkEntries');

app.use('/api/extensions', extensionRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/milk-entries', milkEntryRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Connect DB & start server
mongoose
  .connect(MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => {
    console.log('Connected to MongoDB Atlas');
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
