const express = require('express');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const MilkEntry = require('../models/MilkEntry');
const Product = require('../models/Product');

const router = express.Router();

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

// Helper to normalize dates to midnight for consistent uniqueness
function normalizeDate(dateInput) {
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// GET /api/milk-entries - list all milk entries (optionally filter by customerId)
router.get('/', async (req, res) => {
  try {
    const { customerId } = req.query;
    const filter = {};

    if (customerId) {
      if (!isValidObjectId(customerId)) {
        return res.status(400).json({ error: 'Invalid customerId' });
      }
      filter.customerId = customerId;
    }

    const entries = await MilkEntry.find(filter)
      .populate('customerId')
      .sort({ date: -1, createdAt: -1 });
    res.json(entries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch milk entries' });
  }
});

// POST /api/milk-entries/customer/:customerId - add milk entry for a customer (date, cow, buffalo, products)
// Uses upsert to update existing entry or create new one
router.post('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;
    const { date, cow, buffalo, productId } = req.body;

    if (!isValidObjectId(customerId)) {
      return res.status(400).json({ error: 'Invalid customerId' });
    }

    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    // Prepare products array
    let products = [];
    if (productId && isValidObjectId(productId) && String(productId).trim() !== '') {
      const product = await Product.findById(productId);
      if (product) {
        products = [
          {
            productId: product._id,
            productName: product.name,
            cost: product.cost || 0,
          },
        ];
        console.log('Saving product with milk entry:', { productId: product._id, productName: product.name, cost: product.cost });
      } else {
        console.log('Product not found for productId:', productId);
      }
    } else {
      console.log('No productId provided or invalid, products array will be empty');
    }

    // Check if entry already exists
    const existingEntry = await MilkEntry.findOne({
      customerId,
      date: normalizedDate,
    });

    // Use findOneAndUpdate with upsert to create or update
    const entry = await MilkEntry.findOneAndUpdate(
      { customerId, date: normalizedDate },
      { customerId, date: normalizedDate, cow, buffalo, products },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    // Return 201 for create, 200 for update
    const statusCode = existingEntry ? 200 : 201;
    res.status(statusCode).json(entry);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to save milk entry', details: err.message });
  }
});

// PUT /api/milk-entries/customer/:customerId/date/:date - edit milk entry for a specific date
router.put('/customer/:customerId/date/:date', async (req, res) => {
  try {
    const { customerId, date } = req.params;
    const { cow, buffalo, productId } = req.body;

    if (!isValidObjectId(customerId)) {
      return res.status(400).json({ error: 'Invalid customerId' });
    }

    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    // Prepare products array
    let products = [];
    if (productId && isValidObjectId(productId) && String(productId).trim() !== '') {
      const product = await Product.findById(productId);
      if (product) {
        products = [
          {
            productId: product._id,
            productName: product.name,
            cost: product.cost || 0,
          },
        ];
        console.log('Updating product with milk entry:', { productId: product._id, productName: product.name, cost: product.cost });
      } else {
        console.log('Product not found for productId:', productId);
      }
    } else {
      console.log('No productId provided or invalid, products array will be empty');
    }

    const entry = await MilkEntry.findOneAndUpdate(
      { customerId, date: normalizedDate },
      { cow, buffalo, products },
      { new: true }
    );

    if (!entry) {
      return res.status(404).json({ error: 'Milk entry not found for this date' });
    }

    res.json(entry);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to update milk entry', details: err.message });
  }
});

// GET /api/milk-entries/customer/:customerId - get all milk entries of a customer sorted by date
router.get('/customer/:customerId', async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!isValidObjectId(customerId)) {
      return res.status(400).json({ error: 'Invalid customerId' });
    }

    // Fetch ALL entries for this customer - no date filtering
    const entries = await MilkEntry.find({ customerId })
      .sort({ date: 1 })
      .lean()
      .exec();

    console.log(`Fetched ${entries.length} milk entries for customer ${customerId}`);
    
    res.json(entries);
  } catch (err) {
    console.error('Error fetching milk entries:', err);
    res.status(500).json({ error: 'Failed to fetch milk entries for customer' });
  }
});

// GET /api/milk-entries/customer/:customerId/excel - export entries to Excel
router.get('/customer/:customerId/excel', async (req, res) => {
  try {
    const { customerId } = req.params;

    if (!isValidObjectId(customerId)) {
      return res.status(400).json({ error: 'Invalid customerId' });
    }

    const entries = await MilkEntry.find({ customerId })
      .populate('customerId')
      .sort({ date: 1 })
      .lean()
      .exec();

    const rows = entries.map((e) => ({
      Date: e.date ? new Date(e.date).toLocaleDateString() : '',
      'Cow (L)': e.cow ?? 0,
      'Buffalo (L)': e.buffalo ?? 0,
      'Total (L)': (e.cow || 0) + (e.buffalo || 0),
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Milk Entries');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    const customerName = entries[0]?.customerId?.name || 'customer';
    const safeName = customerName.replace(/[^a-z0-9]+/gi, '-').toLowerCase();

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="milk-entries-${safeName}.xlsx"`
    );

    return res.send(buffer);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Failed to export milk entries to Excel' });
  }
});

// DELETE /api/milk-entries/:id - delete milk entry by id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid milk entry id' });
    }

    const deleted = await MilkEntry.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Milk entry not found' });
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Failed to delete milk entry', details: err.message });
  }
});

module.exports = router;

