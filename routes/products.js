const express = require('express');
const mongoose = require('mongoose');
const Product = require('../models/Product');

const router = express.Router();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// GET /api/products - get all products
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ name: 1 });
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// POST /api/products - create new product
router.post('/', async (req, res) => {
  try {
    const { name, cost } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Product name is required' });
    }

    if (cost === undefined || cost === null || isNaN(cost) || cost < 0) {
      return res.status(400).json({ error: 'Valid cost is required' });
    }

    const product = new Product({ name: name.trim(), cost: Number(cost) });
    const saved = await product.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to create product', details: err.message });
  }
});

// PUT /api/products/:id - update product
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, cost } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }

    if (name !== undefined && (!name || !name.trim())) {
      return res.status(400).json({ error: 'Product name cannot be empty' });
    }

    if (cost !== undefined && (isNaN(cost) || cost < 0)) {
      return res.status(400).json({ error: 'Valid cost is required' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (cost !== undefined) updateData.cost = Number(cost);

    const updated = await Product.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to update product', details: err.message });
  }
});

// DELETE /api/products/:id - delete product
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid product id' });
    }

    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to delete product', details: err.message });
  }
});

module.exports = router;

