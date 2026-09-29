const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema({
  from: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  to: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'declined', 'cancelled'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

friendRequestSchema.index({ from: 1, to: 1, status: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });

friendRequestSchema.pre('validate', function() {
  if (this.from.equals(this.to)) {
    throw new Error('Cannot send friend request to yourself');
  }
});

module.exports = mongoose.model('FriendRequest', friendRequestSchema);
