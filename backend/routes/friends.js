const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const FriendRequest = require('../models/FriendRequest');
const Friendship = require('../models/Friendship');
const jwt = require('jsonwebtoken');
const { createNotification } = require('./notifications');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

// Basic auth middleware mapped directly in this router for ease of access
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

// ─── Helper: normalize a friendship pair so user1 < user2 lexically ──────────
function normalizePair(a, b) {
  const aStr = a.toString();
  const bStr = b.toString();
  return aStr < bStr ? [a, b] : [b, a];
}

// ─── GET /api/friends ─────────────────────────────────────────────────────────
// Returns the authenticated user's accepted friend list with basic profile info
router.get('/', async (req, res) => {
  try {
    const userId = req.user._id;
    const friendships = await Friendship.find({
      $or: [{ user1: userId }, { user2: userId }],
      status: 'active',
    })
      .populate('user1', 'displayName email')
      .populate('user2', 'displayName email');

    const friends = friendships.map((f) => {
      const friend = f.user1._id.equals(userId) ? f.user2 : f.user1;
      return { id: friend._id, displayName: friend.displayName, email: friend.email };
    });

    res.json({ friends });
  } catch (err) {
    console.error('GET /friends error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── GET /api/friends/requests ───────────────────────────────────────────────
// Returns incoming pending requests
router.get('/requests', async (req, res) => {
  try {
    const incoming = await FriendRequest.find({
      to: req.user._id,
      status: 'pending',
    }).populate('from', 'displayName email');

    const outgoing = await FriendRequest.find({
      from: req.user._id,
      status: 'pending',
    }).populate('to', 'displayName email');

    res.json({
      incoming: incoming.map((r) => ({
        id: r._id,
        from: { id: r.from._id, displayName: r.from.displayName, email: r.from.email },
        createdAt: r.createdAt,
      })),
      outgoing: outgoing.map((r) => ({
        id: r._id,
        to: { id: r.to._id, displayName: r.to.displayName, email: r.to.email },
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    console.error('GET /friends/requests error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/friends/request ───────────────────────────────────────────────
// Send a friend request by email
router.post('/request', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Provide an email address' });
    }

    const currentUserId = req.user._id;
    const targetUser = await User.findOne({ email }).select('_id displayName email');

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (targetUser._id.equals(currentUserId)) {
      return res.status(400).json({ error: 'Cannot send friend request to yourself' });
    }

    // Check if already friends
    const [u1, u2] = normalizePair(currentUserId, targetUser._id);
    const existingFriendship = await Friendship.findOne({ user1: u1, user2: u2 });
    if (existingFriendship) {
      return res.status(409).json({ error: 'Already friends' });
    }

    // Check for existing pending request (either direction)
    const existingRequest = await FriendRequest.findOne({
      $or: [
        { from: currentUserId, to: targetUser._id, status: 'pending' },
        { from: targetUser._id, to: currentUserId, status: 'pending' },
      ],
    });
    
    if (existingRequest) {
      // If the other person already sent a request, auto-accept it
      if (existingRequest.from.equals(targetUser._id)) {
        existingRequest.status = 'accepted';
        await existingRequest.save();

        const [u1, u2] = normalizePair(currentUserId, targetUser._id);
        await Friendship.create({ user1: u1, user2: u2 });

        return res.json({
          ok: true,
          message: 'Friend request from this user accepted automatically',
          autoAccepted: true,
        });
      }
      return res.status(409).json({ error: 'Friend request already sent' });
    }

    const request = await FriendRequest.create({ from: currentUserId, to: targetUser._id });

    // Notify the recipient
    const notification = await createNotification({
      userId: targetUser._id,
      type: 'friend_request',
      title: 'New friend request',
      message: `${req.user.displayName} sent you a friend request`,
      data: { requestId: request._id, fromUserId: currentUserId, fromUserName: req.user.displayName },
    });
    if (notification) {
      req.app.locals.emitToUser?.(targetUser._id, 'notification', { type: 'friend_request', notification });
    }

    res.status(201).json({
      ok: true,
      request: {
        id: request._id,
        to: { id: targetUser._id, displayName: targetUser.displayName, email: targetUser.email },
        status: request.status,
        createdAt: request.createdAt,
      },
    });
  } catch (err) {
    console.error('POST /friends/request error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/friends/accept/:requestId ─────────────────────────────────────
router.post('/accept/:requestId', async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    if (!request.to.equals(req.user._id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    request.status = 'accepted';
    await request.save();

    const [u1, u2] = normalizePair(request.from, request.to);
    await Friendship.findOneAndUpdate(
      { user1: u1, user2: u2 },
      { user1: u1, user2: u2, status: 'active' },
      { upsert: true, new: true }
    );

    // Notify the original sender that their request was accepted
    const notification = await createNotification({
      userId: request.from,
      type: 'friend_accepted',
      title: 'Friend request accepted',
      message: `${req.user.displayName} accepted your friend request`,
      data: { friendUserId: req.user._id, friendUserName: req.user.displayName },
    });
    if (notification) {
      req.app.locals.emitToUser?.(request.from, 'notification', { type: 'friend_accepted', notification });
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /friends/accept error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── POST /api/friends/decline/:requestId ────────────────────────────────────
router.post('/decline/:requestId', async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    if (!request.to.equals(req.user._id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ error: `Request is already ${request.status}` });
    }

    request.status = 'declined';
    await request.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /friends/decline error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ─── DELETE /api/friends/:friendUserId ───────────────────────────────────────
// Remove an existing friend
router.delete('/:friendUserId', async (req, res) => {
  try {
    const { friendUserId } = req.params;
    if (!mongoose.isValidObjectId(friendUserId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }
    const [u1, u2] = normalizePair(req.user._id, new mongoose.Types.ObjectId(friendUserId));
    const result = await Friendship.deleteOne({ user1: u1, user2: u2 });
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Friendship not found' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /friends error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
