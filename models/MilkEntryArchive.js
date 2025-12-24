const mongoose = require('mongoose');
const { Schema } = mongoose;

const MilkEntryArchiveSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true,
    },

    extensionId: {
      type: Schema.Types.ObjectId,
      ref: 'Extension',
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
    },

    buffalo: {
      type: Number,
      default: 0,
    },

    products: [
      {
        productId: {
          type: Schema.Types.ObjectId,
          ref: 'Product',
        },
        productName: String,
        cost: Number,
      },
    ],

    archivedMonth: {
      type: String, // "2025-01"
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model(
  'MilkEntryArchive',
  MilkEntryArchiveSchema
);


module.exports = mongoose.model('MilkEntryArchive', MilkEntryArchiveSchema);

  