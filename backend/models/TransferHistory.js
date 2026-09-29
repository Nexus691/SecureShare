const mongoose = require('mongoose');

const transferHistorySchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  fileName: {
    type: String,
    required: true,
  },
  fileSize: {
    type: Number,
    required: true,
  },
  fileType: {
    type: String,
    default: 'application/octet-stream',
  },
  roomCode: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['completed', 'failed', 'cancelled'],
    default: 'completed',
  },
}, {
  timestamps: true,
});

transferHistorySchema.index({ senderId: 1, createdAt: -1 });
transferHistorySchema.index({ receiverId: 1, createdAt: -1 });

module.exports = mongoose.model('TransferHistory', transferHistorySchema);
