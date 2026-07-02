const mongoose = require('mongoose');

const WithdrawalSchema = new mongoose.Schema({
  // The creator requesting the withdrawal
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // Amount in cents (e.g. 1000 = $10.00)
  amount: {
    type: Number,
    required: true,
    min: 1,
  },
  currency: {
    type: String,
    default: 'usd',
    lowercase: true,
    trim: true,
  },
  // Stripe payout ID returned from the API
  stripePayoutId: {
    type: String,
    default: null,
  },
  // Stripe transfer ID (if using transfers instead of direct payouts)
  stripeTransferId: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed', 'canceled'],
    default: 'pending',
    index: true,
  },
  failureReason: {
    type: String,
    default: null,
  },
  // When the payout was completed
  paidAt: {
    type: Date,
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Fast lookups by creator
WithdrawalSchema.index({ creatorId: 1, createdAt: -1 });

WithdrawalSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.models.Withdrawal || mongoose.model('Withdrawal', WithdrawalSchema);
