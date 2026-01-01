const mongoose = require('mongoose');

const { Schema } = mongoose;

const CustomerSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 255,
    },
    extensionId: {
      type: Schema.Types.ObjectId,
      ref: 'Extension',
      required: false,
      index: true,
    },
    // Default product that can be pinned per-customer
    defaultProductId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: false,
      default: null,
    },
    defaultProductPermanent: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Customer', CustomerSchema);


