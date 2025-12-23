const mongoose = require('mongoose');

const { Schema } = mongoose;

const MilkPriceSchema = new Schema(
  {
    cowPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    buffaloPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one price document exists
MilkPriceSchema.statics.getCurrentPrices = async function () {
  let prices = await this.findOne();
  if (!prices) {
    prices = new this({ cowPrice: 0, buffaloPrice: 0 });
    await prices.save();
  }
  return prices;
};

module.exports = mongoose.model('MilkPrice', MilkPriceSchema);

