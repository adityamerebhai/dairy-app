const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const MilkEntry = require('../models/MilkEntry');

// Normalize a date to midnight local time
function normalizeDateToMidnight(dateInput) {
  const d = new Date(dateInput);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Carry forward last known cow & buffalo values to today's entry for customers
 * - copies cow & buffalo only
 * - if today's entry exists and has non-zero cow or buffalo, it's left as-is
 * - if today's entry exists but both are zero, it will be updated
 * - idempotent: safe to run multiple times per day
 * @param {Object} options
 * @param {String} options.timezone - currently unused; left for future timezone handling
 * @returns {Object} summary of results
 */
async function dailyCarryForward({ timezone } = {}) {
  const now = new Date();
  const today = normalizeDateToMidnight(now);
  const todayStart = today; // midnight today

  const summary = {
    processed: 0,
    carried: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Fetch all customers
    const customers = await Customer.find({}).lean().exec();

    // For each customer, check today's entry and most recent before today
    for (const c of customers) {
      summary.processed += 1;
      try {
        // Find today's entry (if any)
        const todayEntry = await MilkEntry.findOne({
          customerId: c._id,
          date: todayStart,
        }).exec();

        // If today's entry exists and has non-zero cow or buffalo, skip
        if (todayEntry && ((todayEntry.cow || 0) !== 0 || (todayEntry.buffalo || 0) !== 0)) {
          summary.skipped += 1;
          continue;
        }

        // Find most recent entry strictly before today
        const prev = await MilkEntry.findOne({
          customerId: c._id,
          date: { $lt: todayStart },
        })
          .sort({ date: -1 })
          .lean()
          .exec();

        if (!prev) {
          // nothing to carry
          summary.skipped += 1;
          continue;
        }

        const cow = prev.cow || 0;
        const buffalo = prev.buffalo || 0;

        // If today's entry exists but both are zero, update it. Otherwise create new.
        if (todayEntry) {
          // only update when both zero currently
          const update = {};
          if ((todayEntry.cow || 0) === 0 && cow !== 0) update.cow = cow;
          if ((todayEntry.buffalo || 0) === 0 && buffalo !== 0) update.buffalo = buffalo;

          if (Object.keys(update).length > 0) {
            await MilkEntry.findByIdAndUpdate(todayEntry._id, update, { new: true }).exec();
            summary.updated += 1;
            summary.carried += 1;
          } else {
            summary.skipped += 1;
          }
        } else {
          // Create a new entry for today. Products intentionally not carried forward
          const newEntry = new MilkEntry({
            customerId: c._id,
            date: todayStart,
            cow,
            buffalo,
            products: [],
          });
          await newEntry.save();
          summary.carried += 1;
        }
      } catch (err) {
        console.error('Error processing customer for carry-forward', c._id, err);
        summary.errors += 1;
      }
    }

    return summary;
  } catch (err) {
    console.error('dailyCarryForward failed:', err);
    throw err;
  }
}

module.exports = dailyCarryForward;
