const mongoose = require('mongoose');

const { Schema } = mongoose;

const MilkEntrySchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      index: true,
    },
    cow: {
      type: Number,
      default: 0,
      min: 0,
    },
    buffalo: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Ensure a customer has at most one entry per date
MilkEntrySchema.index({ customerId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('MilkEntry', MilkEntrySchema);


