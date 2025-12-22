const mongoose = require('mongoose');

const { Schema } = mongoose;

const ExtensionSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 120,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Extension', ExtensionSchema);


