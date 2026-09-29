const express = require('express');
const TransferHistory = require('../models/TransferHistory');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Optional auth middleware - doesn't block if not logged in, but sets req.user if they are
const optionalAuth = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return next();
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (user) {
      req.user = user;
    }
    next();
  } catch (err) {
    next(); // Ignore invalid tokens for optional auth
  }
};

// Strict auth middleware for fetching history
const requireAuth = async (req, res, next) => {
  const token = req.cookies.token;
  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/history
// Returns transfer history for the logged-in user
router.get('/', requireAuth, async (req, res) => {
  try {
    const history = await TransferHistory.find({
      $or: [{ senderId: req.user._id }, { receiverId: req.user._id }]
    })
      .populate('senderId', 'displayName email')
      .populate('receiverId', 'displayName email')
      .sort({ createdAt: -1 })
      .limit(50); // Limit to last 50 for now

    res.json({ history });
  } catch (err) {
    console.error('GET /history error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/history
// Logs a transfer. Can be called by sender or receiver.
router.post('/', optionalAuth, async (req, res) => {
  try {
    const { roomCode, fileName, fileSize, fileType, senderId, receiverId, status } = req.body;
    
    // We only create one record per room code. We should check if one already exists to avoid duplicates
    // since both sender and receiver might call this endpoint.
    let history = await TransferHistory.findOne({ roomCode });
    
    if (history) {
      // Update existing record with any new info (like receiverId if sender logged it first)
      let updated = false;
      if (senderId && !history.senderId) { history.senderId = senderId; updated = true; }
      if (receiverId && !history.receiverId) { history.receiverId = receiverId; updated = true; }
      if (status === 'completed' && history.status !== 'completed') { history.status = status; updated = true; }
      
      if (updated) await history.save();
      return res.json({ history });
    }
    
    history = new TransferHistory({
      roomCode,
      fileName,
      fileSize,
      fileType,
      senderId: senderId || null,
      receiverId: receiverId || null,
      status: status || 'completed'
    });
    
    await history.save();
    res.json({ history });
  } catch (err) {
    console.error('POST /history error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
