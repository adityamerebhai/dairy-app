const express = require('express');
const MilkPrice = require('../models/MilkPrice');

const router = express.Router();

// GET /api/milk-prices - get current milk prices
router.get('/', async (req, res) => {
  try {
    const prices = await MilkPrice.getCurrentPrices();
    res.json(prices);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch milk prices' });
  }
});

// PUT /api/milk-prices - update milk prices (creates if doesn't exist)
router.put('/', async (req, res) => {
  try {
    const { cowPrice, buffaloPrice } = req.body;

    if (cowPrice === undefined || cowPrice === null || isNaN(cowPrice) || cowPrice < 0) {
      return res.status(400).json({ error: 'Valid cow price is required' });
    }

    if (buffaloPrice === undefined || buffaloPrice === null || isNaN(buffaloPrice) || buffaloPrice < 0) {
      return res.status(400).json({ error: 'Valid buffalo price is required' });
    }

    // Get or create price document
    let prices = await MilkPrice.findOne();
    if (!prices) {
      prices = new MilkPrice({ cowPrice: Number(cowPrice), buffaloPrice: Number(buffaloPrice) });
    } else {
      prices.cowPrice = Number(cowPrice);
      prices.buffaloPrice = Number(buffaloPrice);
    }

    const saved = await prices.save();
    res.json(saved);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to update milk prices', details: err.message });
  }
});

module.exports = router;

