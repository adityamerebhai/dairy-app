const express = require('express');
const Item = require('../models/Item');

const router = express.Router();

// GET /api/items - list all items
router.get('/', async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// POST /api/items - create new item
router.post('/', async (req, res) => {
  try {
    const { title, amount, type, notes } = req.body;
    const item = new Item({ title, amount, type, notes });
    const saved = await item.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to create item', details: err.message });
  }
});

// PUT /api/items/:id - update item
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, amount, type, notes } = req.body;
    const updated = await Item.findByIdAndUpdate(
      id,
      { title, amount, type, notes },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to update item', details: err.message });
  }
});

// DELETE /api/items/:id - delete item
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Item.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to delete item', details: err.message });
  }
});

module.exports = router;


