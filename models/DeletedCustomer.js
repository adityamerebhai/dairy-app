const mongoose = require('mongoose');
const { Schema } = mongoose;

const DeletedCustomerSchema = new Schema(
  {
    customerId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    name: String,
    phone: String,
    address: String,

    extensionId: {
      type: Schema.Types.ObjectId,
      ref: 'Extension'
    },
    extensionName: String,

    deletedAt: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('DeletedCustomer', DeletedCustomerSchema);
