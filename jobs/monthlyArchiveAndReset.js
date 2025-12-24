const MilkEntry = require('../models/MilkEntry');
const MilkEntryArchive = require('../models/MilkEntryArchive');

async function archiveAndReset() {
  const now = new Date();

  const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfPreviousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const previousMonthKey = `${startOfPreviousMonth.getFullYear()}-${String(
    startOfPreviousMonth.getMonth() + 1
  ).padStart(2, '0')}`;

  const entries = await MilkEntry.find({
    date: { $gte: startOfPreviousMonth, $lt: startOfCurrentMonth },
  });

  if (!entries.length) {
    console.log('No entries to archive');
    return;
  }

  const archiveData = entries.map(e => ({
    ...e.toObject(),
    archivedMonth: previousMonthKey,
  }));

  await MilkEntryArchive.insertMany(archiveData);
  await MilkEntry.deleteMany({
    date: { $gte: startOfPreviousMonth, $lt: startOfCurrentMonth },
  });

  console.log(`Archived & reset data for ${previousMonthKey}`);
}

module.exports = archiveAndReset;
