const express = require('express');
const Extension = require('../models/Extension');

const router = express.Router();

// GET /api/extensions - list all extensions
router.get('/', async (req, res) => {
  try {
    const extensions = await Extension.find().sort({ createdAt: -1 });
    res.json(extensions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch extensions' });
  }
});

// POST /api/extensions - create new extension
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    const extension = new Extension({ name });
    const saved = await extension.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to create extension', details: err.message });
  }
});

// PUT /api/extensions/:id - update extension
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const updated = await Extension.findByIdAndUpdate(
      id,
      { name },
      { new: true, runValidators: true }
    );
    if (!updated) {
      return res.status(404).json({ error: 'Extension not found' });
    }
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to update extension', details: err.message });
  }
});

// DELETE /api/extensions/:id - delete extension
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Extension.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Extension not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to delete extension', details: err.message });
  }
});

module.exports = router;


