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

module.exports = router;
