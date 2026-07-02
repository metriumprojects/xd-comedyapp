const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken, optionalAuth } = require('../middleware/authMiddleware');
const stripeService = require('../services/stripeService');

const SubscriptionTier = () => mongoose.model('SubscriptionTier');
const Subscription = () => mongoose.model('Subscription');
const User = () => mongoose.model('User');

// ============================================================================
// TIER MANAGEMENT (Creator endpoints)
// ============================================================================

/**
 * POST /subscriptions/tiers
 * Creator creates or updates their subscription tier.
 */
router.post('/tiers', verifyToken, async (req, res) => {
  try {
    const creatorId = req.userId;
    const { title, description, price, benefits, createGroupChat } = req.body;

    if (!title || !description || !price) {
      return res.status(400).json({
        success: false,
        error: 'Title, description, and price are required',
      });
    }

    // Convert dollar string/number to cents
    const priceInCents = Math.round(parseFloat(price) * 100);

    if (isNaN(priceInCents) || priceInCents < 100) {
      return res.status(400).json({
        success: false,
        error: 'Price must be at least $1.00',
      });
    }

    const Tier = SubscriptionTier();

    // Find specific tier if tierId is provided, otherwise create a new one
    let tier = null;
    if (req.body.tierId) {
      tier = await Tier.findOne({ _id: req.body.tierId, creatorId, isActive: true });
    }

    if (tier) {
      // Update existing tier
      const priceChanged = tier.priceInCents !== priceInCents;

      tier.title = title.trim();
      tier.description = description.trim();
      tier.priceInCents = priceInCents;
      tier.benefits = Array.isArray(benefits) ? benefits.filter(Boolean) : [];
      tier.createGroupChat = !!createGroupChat;

      // Update Stripe product/price
      if (tier.stripeProductId) {
        const updates = await stripeService.updateStripeProduct(tier, priceChanged);
        if (updates.stripePriceId) {
          tier.stripePriceId = updates.stripePriceId;
        }
      }

      await tier.save();

      return res.json({
        success: true,
        data: tier,
        message: 'Subscription tier updated',
      });
    }

    // Create new tier
    tier = new Tier({
      creatorId,
      title: title.trim(),
      description: description.trim(),
      priceInCents,
      benefits: Array.isArray(benefits) ? benefits.filter(Boolean) : [],
      createGroupChat: !!createGroupChat,
    });

    await tier.save();

    // Create Stripe Product + Price
    try {
      const stripeIds = await stripeService.createStripeProductAndPrice(tier);
      tier.stripeProductId = stripeIds.stripeProductId;
      tier.stripePriceId = stripeIds.stripePriceId;
      await tier.save();
    } catch (stripeError) {
      console.error('[Subscription] Failed to create Stripe product:', stripeError.message);
      // Tier is saved in DB but without Stripe IDs — can be retried
    }

    res.status(201).json({
      success: true,
      data: tier,
      message: 'Subscription tier created',
    });
  } catch (error) {
    console.error('[Subscription] Create tier error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to create subscription tier' });
  }
});

/**
 * GET /subscriptions/tiers/:creatorId
 * Get a creator's active subscription tier. Public endpoint.
 */
router.get('/tiers/:creatorId', optionalAuth, async (req, res) => {
  try {
    const { creatorId } = req.params;

    const tiers = await SubscriptionTier().find({
      creatorId,
      isActive: true,
    }).sort({ priceInCents: 1 }).lean();

    // Convert cents back to dollars for display
    const response = tiers.map(tier => ({
      ...tier,
      price: (tier.priceInCents / 100).toFixed(2),
    }));

    res.json({ success: true, data: response });
  } catch (error) {
    console.error('[Subscription] Get tier error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch subscription tier' });
  }
});

/**
 * DELETE /subscriptions/tiers/:tierId
 * Creator deletes their subscription tier.
 */
router.delete('/tiers/:tierId', verifyToken, async (req, res) => {
  try {
    const { tierId } = req.params;
    const Tier = SubscriptionTier();

    const tier = await Tier.findById(tierId);

    if (!tier) {
      return res.status(404).json({ success: false, error: 'Tier not found' });
    }

    // Only the creator can delete their tier
    if (String(tier.creatorId) !== String(req.userId)) {
      return res.status(403).json({ success: false, error: 'You can only delete your own tiers' });
    }

    // Deactivate in Stripe
    try {
      await stripeService.deactivateStripeProduct(tier);
    } catch (stripeError) {
      console.warn('[Subscription] Stripe deactivation warning:', stripeError.message);
    }

    // Soft delete — mark as inactive
    tier.isActive = false;
    await tier.save();

    res.json({ success: true, message: 'Subscription tier deleted' });
  } catch (error) {
    console.error('[Subscription] Delete tier error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to delete subscription tier' });
  }
});

// ============================================================================
// SUBSCRIPTION MANAGEMENT (Subscriber endpoints)
// ============================================================================

/**
 * POST /subscriptions/create
 * Subscriber initiates a subscription. Returns client secret for Payment Sheet.
 */
router.post('/create', verifyToken, async (req, res) => {
  try {
    const subscriberId = req.userId;
    const { tierId } = req.body;

    if (!tierId) {
      return res.status(400).json({ success: false, error: 'tierId is required' });
    }

    const result = await stripeService.createSubscription(subscriberId, tierId);

    res.json({
      success: true,
      data: {
        subscriptionId: result.subscriptionId,
        stripeSubscriptionId: result.stripeSubscriptionId,
        clientSecret: result.clientSecret,
        customerId: result.customerId,
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      },
    });
  } catch (error) {
    console.error('[Subscription] Create subscription error:', error.message);

    // Return user-friendly messages for known errors
    const knownErrors = [
      'Subscription tier not found or inactive',
      'You cannot subscribe to your own tier',
      'You already have an active subscription to this creator',
      'Tier has no Stripe price configured',
    ];

    const status = knownErrors.includes(error.message) ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

/**
 * POST /subscriptions/cancel
 * Subscriber cancels their subscription (at period end).
 */
router.post('/cancel', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ success: false, error: 'subscriptionId is required' });
    }

    const result = await stripeService.cancelSubscription(subscriptionId, userId);

    res.json({
      success: true,
      data: result,
      message: 'Subscription will be canceled at the end of the billing period',
    });
  } catch (error) {
    console.error('[Subscription] Cancel error:', error.message);

    const knownErrors = [
      'Subscription not found',
      'You can only cancel your own subscription',
      'Subscription is already canceled',
    ];

    const status = knownErrors.includes(error.message) ? 400 : 500;
    res.status(status).json({ success: false, error: error.message });
  }
});

/**
 * POST /subscriptions/confirm
 * Called by the frontend right after a successful Stripe Payment Sheet completion.
 * Retrieves the live subscription status from Stripe and updates the local DB,
 * bypassing the webhook race condition.
 */
router.post('/confirm', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { subscriptionId } = req.body;

    if (!subscriptionId) {
      return res.status(400).json({ success: false, error: 'subscriptionId is required' });
    }

    const sub = await Subscription().findById(subscriptionId);
    if (!sub) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    if (String(sub.subscriberId) !== String(userId)) {
      return res.status(403).json({ success: false, error: 'Not your subscription' });
    }

    // If already active, just return success
    if (sub.status === 'active') {
      return res.json({ success: true, data: { status: 'active', alreadyActive: true } });
    }

    // Retrieve the live status from Stripe, expanding the latest invoice and payment intent
    const stripe = stripeService.getStripe();
    const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId, {
      expand: ['latest_invoice.payment_intent'],
    });

    let liveStatus = stripeSub.status;
    const paymentIntent = stripeSub.latest_invoice?.payment_intent;
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      liveStatus = 'active';
    }

    // Update the local record
    sub.status = liveStatus;
    sub.currentPeriodStart = new Date(stripeSub.current_period_start * 1000);
    sub.currentPeriodEnd = new Date(stripeSub.current_period_end * 1000);
    sub.cancelAtPeriodEnd = stripeSub.cancel_at_period_end || false;
    await sub.save();

    console.log(`✅ [Subscription] Confirmed ${sub.stripeSubscriptionId} → ${liveStatus}`);

    res.json({
      success: true,
      data: {
        status: liveStatus,
        isActive: ['active', 'trialing'].includes(liveStatus),
      },
    });
  } catch (error) {
    console.error('[Subscription] Confirm error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to confirm subscription status' });
  }
});

/**
 * GET /subscriptions/status/:creatorId
 * Check if current user has an active subscription to a specific creator.
 */
router.get('/status/:creatorId', verifyToken, async (req, res) => {
  try {
    const subscriberId = req.userId;
    const { creatorId } = req.params;

    const subs = await Subscription().find({
      subscriberId,
      creatorId,
      status: { $in: ['active', 'trialing'] },
    }).lean();

    res.json({
      success: true,
      data: {
        isSubscribed: subs.length > 0,
        activeTierIds: subs.map(s => String(s.tierId)),
        subscriptions: subs.map(s => ({
          id: s._id,
          tierId: s.tierId,
          status: s.status,
          currentPeriodEnd: s.currentPeriodEnd,
          cancelAtPeriodEnd: s.cancelAtPeriodEnd,
        })),
        subscription: subs.length > 0 ? {
          id: subs[0]._id,
          status: subs[0].status,
          currentPeriodEnd: subs[0].currentPeriodEnd,
          cancelAtPeriodEnd: subs[0].cancelAtPeriodEnd,
        } : null,
      },
    });
  } catch (error) {
    console.error('[Subscription] Status check error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to check subscription status' });
  }
});

/**
 * GET /subscriptions/my-subscriptions
 * Get all active subscriptions for the current user (subscriber view).
 */
router.get('/my-subscriptions', verifyToken, async (req, res) => {
  try {
    const subscriberId = req.userId;

    const subs = await Subscription()
      .find({
        subscriberId,
        status: { $in: ['active', 'trialing', 'past_due'] },
      })
      .populate('creatorId', 'displayName username avatar')
      .populate('tierId', 'title description priceInCents benefits')
      .sort({ createdAt: -1 })
      .lean();

    // Transform for frontend
    const data = subs.map((sub) => ({
      id: sub._id,
      status: sub.status,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      currentPeriodEnd: sub.currentPeriodEnd,
      createdAt: sub.createdAt,
      creator: sub.creatorId ? {
        id: sub.creatorId._id,
        displayName: sub.creatorId.displayName,
        username: sub.creatorId.username,
        avatar: sub.creatorId.avatar,
      } : null,
      tier: sub.tierId ? {
        id: sub.tierId._id,
        title: sub.tierId.title,
        description: sub.tierId.description,
        price: (sub.tierId.priceInCents / 100).toFixed(2),
        benefits: sub.tierId.benefits,
      } : null,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('[Subscription] My subscriptions error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch subscriptions' });
  }
});

/**
 * GET /subscriptions/my-subscribers
 * Get all active subscribers of the current user (creator view).
 */
router.get('/my-subscribers', verifyToken, async (req, res) => {
  try {
    const creatorId = req.userId;

    const subs = await Subscription()
      .find({
        creatorId,
        status: { $in: ['active', 'trialing'] },
      })
      .populate('subscriberId', 'displayName username avatar')
      .populate('tierId', 'title priceInCents')
      .sort({ createdAt: -1 })
      .lean();

    const data = subs.map((sub) => ({
      id: sub._id,
      status: sub.status,
      createdAt: sub.createdAt,
      subscriber: sub.subscriberId ? {
        id: sub.subscriberId._id,
        displayName: sub.subscriberId.displayName,
        username: sub.subscriberId.username,
        avatar: sub.subscriberId.avatar,
      } : null,
      tier: sub.tierId ? {
        id: sub.tierId._id,
        title: sub.tierId.title,
        price: (sub.tierId.priceInCents / 100).toFixed(2),
      } : null,
    }));

    res.json({ success: true, data, count: data.length });
  } catch (error) {
    console.error('[Subscription] My subscribers error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch subscribers' });
  }
});

// ============================================================================
// STRIPE WEBHOOK
// ============================================================================

/**
 * POST /subscriptions/webhook
 * Stripe webhook handler. Requires raw body for signature verification.
 * The express.raw() middleware is applied at the server level for this route.
 */
router.post('/webhook', async (req, res) => {
  const signature = req.headers['stripe-signature'];

  if (!signature) {
    return res.status(400).json({ error: 'Missing stripe-signature header' });
  }

  try {
    const event = stripeService.constructWebhookEvent(req.body, signature);

    // Process the event asynchronously — respond immediately to Stripe
    await stripeService.handleWebhookEvent(event);

    res.json({ received: true });
  } catch (error) {
    console.error('[Stripe Webhook] Error:', error.message);
    res.status(400).json({ error: `Webhook error: ${error.message}` });
  }
});

module.exports = router;
