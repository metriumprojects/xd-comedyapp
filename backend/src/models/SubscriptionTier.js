const mongoose = require('mongoose');

const SubscriptionTierSchema = new mongoose.Schema({
  // The creator who owns this tier
  creatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 100,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    maxlength: 300,
    trim: true,
  },
  // Price in cents to avoid floating point issues (e.g. 999 = $9.99)
  priceInCents: {
    type: Number,
    required: true,
    min: 100, // Stripe minimum is $1.00
  },
  currency: {
    type: String,
    default: 'usd',
    lowercase: true,
    trim: true,
  },
  // List of benefits/perks included in this tier
  benefits: [{
    type: String,
    trim: true,
  }],
  createGroupChat: {
    type: Boolean,
    default: false,
  },
  // Stripe identifiers — created when the tier is saved
  stripeProductId: {
    type: String,
    default: null,
  },
  stripePriceId: {
    type: String,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  subscriberCount: {
    type: Number,
    default: 0,
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

// Multiple active tiers per creator are supported now
SubscriptionTierSchema.index(
  { creatorId: 1 }
);

SubscriptionTierSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.models.SubscriptionTier || mongoose.model('SubscriptionTier', SubscriptionTierSchema);

