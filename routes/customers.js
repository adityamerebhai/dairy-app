const express = require('express');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');

const router = express.Router();

// Utility: validate ObjectId
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// GET /api/customers - list all customers (optionally filter by extensionId via query)
router.get('/', async (req, res) => {
  try {
    const { extensionId } = req.query;

    const filter = {};
    if (extensionId) {
      if (!isValidObjectId(extensionId)) {
        return res.status(400).json({ error: 'Invalid extensionId' });
      }
      filter.extensionId = extensionId;
    }

    const customers = await Customer.find(filter)
      .populate('extensionId')
      .sort({ createdAt: -1 });

    res.json(customers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// POST /api/customers/extension/:extensionId - add customer under a specific extension
router.post('/extension/:extensionId', async (req, res) => {
  try {
    const { extensionId } = req.params;
    const { name, phone, address } = req.body;

    if (!isValidObjectId(extensionId)) {
      return res.status(400).json({ error: 'Invalid extensionId' });
    }

    const customer = new Customer({
      name,
      phone,
      address,
      extensionId,
    });

    const saved = await customer.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to create customer', details: err.message });
  }
});

// GET /api/customers/extension/:extensionId - get customers by extensionId
router.get('/extension/:extensionId', async (req, res) => {
  try {
    const { extensionId } = req.params;

    if (!isValidObjectId(extensionId)) {
      return res.status(400).json({ error: 'Invalid extensionId' });
    }

    const customers = await Customer.find({ extensionId })
      .populate('extensionId')
      .sort({ createdAt: -1 });

    res.json(customers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch customers for extension' });
  }
});

// GET /api/customers/:id - get single customer by id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid customer id' });
    }

    const customer = await Customer.findById(id).populate('extensionId');

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(customer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch customer' });
  }
});

// PUT /api/customers/:id - edit customer details
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, address, extensionId } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid customer id' });
    }

    if (extensionId && !isValidObjectId(extensionId)) {
      return res.status(400).json({ error: 'Invalid extensionId' });
    }

    const updated = await Customer.findByIdAndUpdate(
      id,
      { name, phone, address, extensionId },
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to update customer', details: err.message });
  }
});

// DELETE /api/customers/:id - delete customer
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid customer id' });
    }

    const deleted = await Customer.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to delete customer', details: err.message });
  }
});

const mongoose = require('mongoose');

const Customer = require('../models/Customer');
const Extension = require('../models/Extension');
const MilkEntry = require('../models/MilkEntry');
const MilkEntryArchive = require('../models/MilkEntryArchive');
const DeletedCustomer = require('../models/DeletedCustomer');

// DELETE customer (archive + remove)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid customer id' });
    }

    const customer = await Customer.findById(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const extension = await Extension.findById(customer.extensionId);

    // Save to deletedcustomers collection
    await DeletedCustomer.create({
      originalCustomerId: customer._id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      extensionId: customer.extensionId,
      extensionName: extension?.name || 'Unknown',
      deletedAt: new Date(),
    });

    // Remove all related data
    await MilkEntry.deleteMany({ customerId: customer._id });
    await MilkEntryArchive.deleteMany({ customerId: customer._id });
    await Customer.findByIdAndDelete(customer._id);

    res.json({ success: true });
  } catch (err) {
    console.error('Delete customer error:', err);
    res.status(500).json({ error: 'Delete failed' });
  }
});

module.exports = router;
