const mongoose = require('mongoose');

async function connectDB() {
  if (process.env.STORAGE_MODE === 'local-json') {
    console.log('Using local JSON data store for development');
    return;
  }

  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is not set');
  }

  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
}

module.exports = connectDB;
