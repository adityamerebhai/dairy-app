const express = require('express');
const mongoose = require('mongoose');
const Extension = require('../models/Extension');
const Customer = require('../models/Customer');
const MilkEntry = require('../models/MilkEntry');
const MilkEntryArchive = require('../models/MilkEntryArchive');

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

// DELETE /api/extensions/:id - delete extension and related data
router.delete('/:id', async (req, res) => {
  const session = await mongoose.startSession().catch(() => null);
  if (session) session.startTransaction();
  try {
    const { id } = req.params;

    const ext = await Extension.findById(id).session(session);
    if (!ext) {
      if (session) {
        await session.abortTransaction().catch(() => {});
        session.endSession();
      }
      return res.status(404).json({ error: 'Extension not found' });
    }

    // Find customers in this extension
    const customers = await Customer.find({ extensionId: id }).session(session).select('_id');
    const customerIds = customers.map((c) => c._id);

    // Delete milk entries tied to this extension OR those customers
    await MilkEntry.deleteMany({ $or: [{ extensionId: id }, { customerId: { $in: customerIds } }] }).session(session);
    // Also remove archived milk entries (monthly archives)
    await MilkEntryArchive.deleteMany({ $or: [{ extensionId: id }, { customerId: { $in: customerIds } }] }).session(session);

    // Delete customers in this extension
    await Customer.deleteMany({ extensionId: id }).session(session);

    // Finally delete extension
    await Extension.findByIdAndDelete(id).session(session);

    if (session) {
      await session.commitTransaction().catch(() => {});
      session.endSession();
    }

    res.json({ success: true });
  } catch (err) {
    if (session) {
      await session.abortTransaction().catch(() => {});
      session.endSession();
    }
    console.error(err);
    res.status(400).json({ error: 'Failed to delete extension', details: err.message });
  }
});

module.exports = router;


