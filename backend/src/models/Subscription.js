const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  // Who is paying
  subscriberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // Who they subscribe to
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  // Reference to the tier they subscribed to
  tierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SubscriptionTier',
    required: true,
  },
  // Stripe identifiers
  stripeCustomerId: {
    type: String,
    required: true,
  },
  stripeSubscriptionId: {
    type: String,
    required: true,
    unique: true,
  },
  stripePriceId: {
    type: String,
    required: true,
  },
  // Subscription lifecycle
  status: {
    type: String,
    enum: ['active', 'canceled', 'past_due', 'incomplete', 'incomplete_expired', 'trialing', 'unpaid', 'paused'],
    default: 'incomplete',
    index: true,
  },
  currentPeriodStart: {
    type: Date,
    default: null,
  },
  currentPeriodEnd: {
    type: Date,
    default: null,
  },
  cancelAtPeriodEnd: {
    type: Boolean,
    default: false,
  },
  canceledAt: {
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

// Compound index: one active subscription per subscriber-tier pair
SubscriptionSchema.index(
  { subscriberId: 1, tierId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ['active', 'trialing', 'past_due'] } } }
);

// Fast lookup by Stripe subscription ID (for webhook processing)
SubscriptionSchema.index({ stripeSubscriptionId: 1 });

SubscriptionSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
