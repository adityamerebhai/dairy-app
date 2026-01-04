// routes/test.js
const express = require('express');
const router = express.Router();
const archiveAndReset = require('../jobs/monthlyArchiveAndReset');

router.get('/run-monthly-reset', async (req, res) => {
  try {
    await archiveAndReset();
    res.send('Monthly archive & reset executed successfully');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Manual trigger for daily carry-forward (for testing)
router.get('/run-daily-carry', async (req, res) => {
  try {
    // Optional safety: only allow in non-production or when explicitly enabled
    if (process.env.NODE_ENV === 'production' && process.env.ENABLE_DAILY_CARRY_MANUAL !== 'true') {
      return res.status(403).send('Manual run not allowed in production');
    }

    const dailyCarryForward = require('../jobs/dailyCarryForward');
    const summary = await dailyCarryForward();
    res.json({ success: true, summary });
  } catch (err) {
    console.error('Manual daily carry failed:', err);
    res.status(500).send(err.message);
  }
});

module.exports = router;
