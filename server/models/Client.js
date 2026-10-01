const mongoose = require('mongoose');

if (process.env.STORAGE_MODE === 'local-json') {
  module.exports = require('./localJsonStore').createModel('Client');
} else {
const clientSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
    },
    phone: String,
    address: String,
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Client', clientSchema);
}
