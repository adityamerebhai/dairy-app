require("dotenv").config();
const mongoose = require("mongoose");
const XLSX = require("xlsx");
const path = require("path");

const Customer = require("../models/Customer");
const Extension = require("../models/Extension");
const MilkEntry = require("../models/MilkEntry");

async function importCustomersFromExcel() {
  const filePath = path.join(__dirname, "../imports/Daily_sale_Report-01.xlsx");
  const workbook = XLSX.readFile(filePath);

  const today = new Date().toISOString().split("T")[0];

  for (const sheetName of workbook.SheetNames) {
    console.log(`📄 Processing sheet: ${sheetName}`);

    const extension = await Extension.findOne({ name: sheetName });
    if (!extension) {
      console.log(`❌ Extension not found: ${sheetName}`);
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    for (const row of rows) {
      if (!row["PHONE NO"]) continue;

      let customer = await Customer.findOne({ phone: row["PHONE NO"] });

      if (!customer) {
        customer = await Customer.create({
          name: row["NAME"] || "Unnamed",
          phone: row["PHONE NO"],
          address: row["ADDRESS"] || "",
          extensionId: extension._id,
        });
      }

      const cow = Number(row["C"] || 0);
      const buffalo = Number(row["B"] || 0);
      if (cow === 0 && buffalo === 0) continue;

      const exists = await MilkEntry.findOne({
        customerId: customer._id,
        date: today,
      });

      if (!exists) {
        await MilkEntry.create({
          customerId: customer._id,
          date: today,
          cow,
          buffalo,
        });
      }
    }
  }

  console.log("✅ Excel import completed");
}

// 🚀 RUN SCRIPT
(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");

    await importCustomersFromExcel();

    console.log("🚀 Import finished");
    process.exit(0);
  } catch (err) {
    console.error("❌ Import failed:", err.message);
    process.exit(1);
  }
})();
