const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/secureshare';
  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // 10 seconds for initial connection
      socketTimeoutMS: 45000,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Don't crash the server - retry in background so the HTTP server stays up
    // and Render's health-check can succeed
    setTimeout(connectDB, 5000);
  }
};

module.exports = connectDB;