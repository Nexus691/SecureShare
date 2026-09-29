const express = require('express');
const Notification = require('../models/Notification');
const User = require('../models/User');
const jwt = require('jsonwebtoken');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

const authMiddleware = async (req, res, next) => {
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

router.use(authMiddleware);

// GET /api/notifications
// Returns notifications for the logged-in user
router.get('/', async (req, res) => {
  try {
    const { unreadOnly, limit = 50 } = req.query;
    const query = { userId: req.user._id };
    if (unreadOnly === 'true') {
      query.read = false;
    }
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    res.json({ notifications });
  } catch (err) {
    console.error('GET /notifications error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/notifications/unread-count
// Returns count of unread notifications
router.get('/unread-count', async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user._id, read: false });
    res.json({ count });
  } catch (err) {
    console.error('GET /notifications/unread-count error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notifications/:id/read
// Mark a notification as read
router.post('/:id/read', async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { read: true },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ notification });
  } catch (err) {
    console.error('POST /notifications/:id/read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/notifications/read-all
// Mark all notifications as read
router.post('/read-all', async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, read: false },
      { read: true }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /notifications/read-all error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/notifications/:id
// Delete a notification
router.delete('/:id', async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /notifications/:id error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper function to create a notification (used by other routes)
async function createNotification({ userId, type, title, message, data = {} }) {
  try {
    const notification = new Notification({ userId, type, title, message, data });
    await notification.save();
    return notification;
  } catch (err) {
    console.error('createNotification error:', err);
    return null;
  }
}

module.exports = { router, createNotification };