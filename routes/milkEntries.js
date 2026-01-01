const express = require('express');
const mongoose = require('mongoose');
const XLSX = require('xlsx');
const archiver = require('archiver');
const MilkEntry = require('../models/MilkEntry');
const Product = require('../models/Product');
const MilkPrice = require('../models/MilkPrice');
const Customer = require('../models/Customer');
const Extension = require('../models/Extension');

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
    const { date, cow, buffalo, productId, productQuantity } = req.body;

    if (!isValidObjectId(customerId)) {
      return res.status(400).json({ error: 'Invalid customerId' });
    }

    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    // Prepare products array (supports quantity)
    let products = [];
    if (productId && isValidObjectId(productId) && String(productId).trim() !== '') {
      const product = await Product.findById(productId);
      const qty = Number(productQuantity) || 0;
      if (product) {
        const totalCost = (product.cost || 0) * qty;
        products = [
          {
            productId: product._id,
            productName: product.name,
            quantity: qty,
            cost: totalCost,
          },
        ];
        console.log('Saving product with milk entry:', { productId: product._id, productName: product.name, quantity: qty, cost: totalCost });
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
    const { cow, buffalo, productId, productQuantity } = req.body;

    if (!isValidObjectId(customerId)) {
      return res.status(400).json({ error: 'Invalid customerId' });
    }

    const normalizedDate = normalizeDate(date);
    if (!normalizedDate) {
      return res.status(400).json({ error: 'Invalid date' });
    }

    // Prepare products array (supports quantity)
    let products = [];
    if (productId && isValidObjectId(productId) && String(productId).trim() !== '') {
      const product = await Product.findById(productId);
      const qty = Number(productQuantity) || 0;
      if (product) {
        const totalCost = (product.cost || 0) * qty;
        products = [
          {
            productId: product._id,
            productName: product.name,
            quantity: qty,
            cost: totalCost,
          },
        ];
        console.log('Updating product with milk entry:', { productId: product._id, productName: product.name, quantity: qty, cost: totalCost });
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

    // Fetch milk prices
    const milkPrices = await MilkPrice.findOne();
    const cowPrice = milkPrices?.cowPrice || 0;
    const buffaloPrice = milkPrices?.buffaloPrice || 0;

    const entries = await MilkEntry.find({ customerId })
      .populate('customerId')
      .sort({ date: 1 })
      .lean()
      .exec();

    // Calculate totals
    let totalCow = 0;
    let totalBuffalo = 0;
    let totalCowAmount = 0;
    let totalBuffaloAmount = 0;
    let totalProductAmount = 0;

    const rows = entries.map((e) => {
      const cow = e.cow || 0;
      const buffalo = e.buffalo || 0;
      const cowAmount = cow * cowPrice;
      const buffaloAmount = buffalo * buffaloPrice;

      // Calculate product amount and names (include quantity)
      let productAmount = 0;
      let productNames = [];
      if (e.products && Array.isArray(e.products) && e.products.length > 0) {
        e.products.forEach((product) => {
          const cost = product.cost || 0;
          const qty = product.quantity || 0;
          productAmount += cost;
          if (product.productName) {
            productNames.push(`${product.productName} (${qty}kg, ₹${cost.toFixed(2)})`);
          }
        });
      }

      const rowTotal = cowAmount + buffaloAmount + productAmount;

      // Update totals
      totalCow += cow;
      totalBuffalo += buffalo;
      totalCowAmount += cowAmount;
      totalBuffaloAmount += buffaloAmount;
      totalProductAmount += productAmount;

      return {
        Date: e.date ? new Date(e.date).toLocaleDateString() : '',
        'Cow (L)': cow,
        'Buffalo (L)': buffalo,
        Products: productNames.length > 0 ? productNames.join(', ') : '—',
        'Cow Amount (₹)': cowAmount.toFixed(2),
        'Buffalo Amount (₹)': buffaloAmount.toFixed(2),
        'Product Amount (₹)': productAmount.toFixed(2),
        'Total Amount (₹)': rowTotal.toFixed(2),
      };
    });

    // Add totals row
    rows.push({
      Date: 'TOTAL',
      'Cow (L)': totalCow.toFixed(1),
      'Buffalo (L)': totalBuffalo.toFixed(1),
      Products: '—',
      'Cow Amount (₹)': totalCowAmount.toFixed(2),
      'Buffalo Amount (₹)': totalBuffaloAmount.toFixed(2),
      'Product Amount (₹)': totalProductAmount.toFixed(2),
      'Total Amount (₹)': (totalCowAmount + totalBuffaloAmount + totalProductAmount).toFixed(2),
    });

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

// GET /api/milk-entries/extension/:extensionId/download-all - download all customer invoices for an extension as zip
router.get('/extension/:extensionId/download-all', async (req, res) => {
  try {
    const { extensionId } = req.params;

    if (!isValidObjectId(extensionId)) {
      return res.status(400).json({ error: 'Invalid extensionId' });
    }

    // Get extension details
    const extension = await Extension.findById(extensionId);
    if (!extension) {
      return res.status(404).json({ error: 'Extension not found' });
    }

    // Get all customers for this extension
    const customers = await Customer.find({ extensionId }).lean().exec();

    if (customers.length === 0) {
      return res.status(404).json({ error: 'No customers found for this extension' });
    }

    // Get milk prices
    const milkPrices = await MilkPrice.findOne();
    const cowPrice = milkPrices?.cowPrice || 0;
    const buffaloPrice = milkPrices?.buffaloPrice || 0;

    // Set up zip archive
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="invoices-${extension.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.zip"`
    );

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    // Generate Excel file for each customer
    for (const customer of customers) {
      const entries = await MilkEntry.find({ customerId: customer._id })
        .sort({ date: 1 })
        .lean()
        .exec();

      if (entries.length === 0) {
        // Skip customers with no entries
        continue;
      }

      // Calculate totals
      let totalCow = 0;
      let totalBuffalo = 0;
      let totalCowAmount = 0;
      let totalBuffaloAmount = 0;
      let totalProductAmount = 0;

      const rows = entries.map((e) => {
        const cow = e.cow || 0;
        const buffalo = e.buffalo || 0;
        const cowAmount = cow * cowPrice;
        const buffaloAmount = buffalo * buffaloPrice;

        // Calculate product amount and names (include quantity)
        let productAmount = 0;
        let productNames = [];
        if (e.products && Array.isArray(e.products) && e.products.length > 0) {
          e.products.forEach((product) => {
            const cost = product.cost || 0;
            const qty = product.quantity || 0;
            productAmount += cost;
            if (product.productName) {
              productNames.push(`${product.productName} (${qty}kg, ₹${cost.toFixed(2)})`);
            }
          });
        }

        const rowTotal = cowAmount + buffaloAmount + productAmount;

        // Update totals
        totalCow += cow;
        totalBuffalo += buffalo;
        totalCowAmount += cowAmount;
        totalBuffaloAmount += buffaloAmount;
        totalProductAmount += productAmount;

        return {
          Date: e.date ? new Date(e.date).toLocaleDateString() : '',
          'Cow (L)': cow,
          'Buffalo (L)': buffalo,
          Products: productNames.length > 0 ? productNames.join(', ') : '—',
          'Cow Amount (₹)': cowAmount.toFixed(2),
          'Buffalo Amount (₹)': buffaloAmount.toFixed(2),
          'Product Amount (₹)': productAmount.toFixed(2),
          'Total Amount (₹)': rowTotal.toFixed(2),
        };
      });

      // Add totals row
      rows.push({
        Date: 'TOTAL',
        'Cow (L)': totalCow.toFixed(1),
        'Buffalo (L)': totalBuffalo.toFixed(1),
        Products: '—',
        'Cow Amount (₹)': totalCowAmount.toFixed(2),
        'Buffalo Amount (₹)': totalBuffaloAmount.toFixed(2),
        'Product Amount (₹)': totalProductAmount.toFixed(2),
        'Total Amount (₹)': (totalCowAmount + totalBuffaloAmount + totalProductAmount).toFixed(2),
      });

      // Create Excel workbook
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Invoice');

      // Convert to buffer
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Add to zip with customer name as filename
      const safeCustomerName = customer.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
      archive.append(buffer, { name: `${safeCustomerName}-invoice.xlsx` });
    }

    // Finalize the archive
    await archive.finalize();
  } catch (err) {
    console.error('Error generating invoices zip:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate invoices zip' });
    }
  }
});

// GET /api/milk-entries/stats/daily-sales - get daily sales statistics
router.get('/stats/daily-sales', async (req, res) => {
  try {
    // Get milk prices
    const milkPrices = await MilkPrice.findOne();
    const cowPrice = milkPrices?.cowPrice || 0;
    const buffaloPrice = milkPrices?.buffaloPrice || 0;

    // Get all milk entries
    const entries = await MilkEntry.find().lean().exec();

    // Group by date and calculate sales
    const dailySalesMap = new Map();

    entries.forEach((entry) => {
      const dateKey = entry.date ? new Date(entry.date).toISOString().split('T')[0] : null;
      if (!dateKey) return;

      const cow = entry.cow || 0;
      const buffalo = entry.buffalo || 0;
      const cowAmount = cow * cowPrice;
      const buffaloAmount = buffalo * buffaloPrice;

      // Calculate product amount
      let productAmount = 0;
      if (entry.products && Array.isArray(entry.products) && entry.products.length > 0) {
        entry.products.forEach((product) => {
          productAmount += product.cost || 0;
        });
      }

      const totalAmount = cowAmount + buffaloAmount + productAmount;

      if (dailySalesMap.has(dateKey)) {
        const existing = dailySalesMap.get(dateKey);
        existing.cowLiters += cow;
        existing.buffaloLiters += buffalo;
        existing.cowAmount += cowAmount;
        existing.buffaloAmount += buffaloAmount;
        existing.productAmount += productAmount;
        existing.totalAmount += totalAmount;
        existing.entryCount += 1;
      } else {
        dailySalesMap.set(dateKey, {
          date: dateKey,
          cowLiters: cow,
          buffaloLiters: buffalo,
          cowAmount: cowAmount,
          buffaloAmount: buffaloAmount,
          productAmount: productAmount,
          totalAmount: totalAmount,
          entryCount: 1,
        });
      }
    });

    // Convert map to array and sort by date (newest first)
    const dailySales = Array.from(dailySalesMap.values()).sort((a, b) => {
      return new Date(b.date) - new Date(a.date);
    });

    res.json(dailySales);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch daily sales statistics' });
  }
});

module.exports = router;

