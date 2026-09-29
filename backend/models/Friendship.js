const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema({
  user1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  user2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'blocked'],
    default: 'active',
  },
}, {
  timestamps: true,
});

// Ensure a friendship is only created once between two users
friendshipSchema.index({ user1: 1, user2: 1 }, { unique: true });

// Prevent self-friendships
friendshipSchema.pre('validate', function() {
  if (this.user1.equals(this.user2)) {
    throw new Error('Cannot create friendship with yourself');
  }
});

module.exports = mongoose.model('Friendship', friendshipSchema);