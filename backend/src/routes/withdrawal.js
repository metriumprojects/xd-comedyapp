const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken } = require('../middleware/authMiddleware');
const stripeService = require('../services/stripeService');

const User = () => mongoose.model('User');
const Withdrawal = () => mongoose.model('Withdrawal');

// Minimum withdrawal amount in dollars
const MIN_WITHDRAWAL_DOLLARS = 5;
const MIN_WITHDRAWAL_CENTS = MIN_WITHDRAWAL_DOLLARS * 100;

// ============================================================================
// STRIPE CONNECT ONBOARDING
// ============================================================================

/**
 * POST /withdrawals/connect/onboard
 * Start or resume Stripe Connect onboarding for the creator.
 * Returns a URL the creator should open in their browser to complete setup.
 */
router.post('/connect/onboard', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User().findById(userId).select('stripeConnectAccountId stripeConnectOnboarded');

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    let accountId = user.stripeConnectAccountId;

    // Create a new connect account if the user doesn't have one yet
    if (!accountId) {
      accountId = await stripeService.createConnectAccount(userId);
    }

    // If already fully onboarded, return a dashboard link instead
    if (user.stripeConnectOnboarded) {
      try {
        const dashboardUrl = await stripeService.createLoginLink(accountId);
        return res.json({
          success: true,
          data: {
            url: dashboardUrl,
            type: 'dashboard',
            alreadyOnboarded: true,
          },
        });
      } catch (loginLinkError) {
        // If login link fails (e.g. account not fully activated), fall through to onboarding
        console.warn('[Withdrawal] Login link failed, generating onboarding link instead:', loginLinkError.message);
      }
    }

    // Generate onboarding link
    const onboardingUrl = await stripeService.createOnboardingLink(accountId, userId);
    console.log('🔗 [Stripe Connect] Generated Onboarding URL:', onboardingUrl);

    res.json({
      success: true,
      data: {
        url: onboardingUrl,
        type: 'onboarding',
        alreadyOnboarded: false,
      },
    });
  } catch (error) {
    console.error('[Withdrawal] Onboarding error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to start onboarding' });
  }
});

// ============================================================================
// CONNECT ACCOUNT STATUS
// ============================================================================

/**
 * GET /withdrawals/connect/status
 * Check the creator's Stripe Connect account status.
 * Returns onboarding state and whether payouts are enabled.
 */
router.get('/connect/status', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User().findById(userId).select(
      'stripeConnectAccountId stripeConnectOnboarded stripeConnectPayoutsEnabled'
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // No connect account at all
    if (!user.stripeConnectAccountId) {
      return res.json({
        success: true,
        data: {
          hasAccount: false,
          isOnboarded: false,
          payoutsEnabled: false,
          needsRetry: false,
          verificationFailed: false,
          requirements: [],
          disabledReason: null,
        },
      });
    }

    // Fetch live status from Stripe (in case webhook hasn't updated us yet)
    try {
      const status = await stripeService.getConnectAccountStatus(user.stripeConnectAccountId);

      // Update local cache if it differs
      const onboarded = status.detailsSubmitted || false;
      const payoutsEnabled = status.payoutsEnabled || false;

      if (user.stripeConnectOnboarded !== onboarded || user.stripeConnectPayoutsEnabled !== payoutsEnabled) {
        await User().findByIdAndUpdate(userId, {
          stripeConnectOnboarded: onboarded,
          stripeConnectPayoutsEnabled: payoutsEnabled,
        });
      }

      // If payouts are enabled, ensure all existing subscriptions are linked
      // to the creator's connected account (handles the case where subscriptions
      // were created before Connect setup — otherwise creator's Stripe balance stays $0)
      if (payoutsEnabled && user.stripeConnectAccountId) {
        // Fire-and-forget: don't block the response for this
        stripeService.linkExistingSubscriptionsToConnect(userId, user.stripeConnectAccountId)
          .catch(err => console.error('[Withdrawal] Error linking subscriptions:', err.message));
      }

      // Determine if the user submitted details but verification failed or has issues
      const currentlyDue = status.requirements?.currently_due || [];
      const pastDue = status.requirements?.past_due || [];
      const errors = status.requirements?.errors || [];
      const disabledReason = status.requirements?.disabled_reason || null;

      // needsRetry: account exists, details were submitted but payouts aren't enabled yet
      // OR there are outstanding requirements
      const needsRetry = !!(user.stripeConnectAccountId && (
        (onboarded && !payoutsEnabled) ||
        currentlyDue.length > 0 ||
        pastDue.length > 0
      ));

      // verificationFailed: there are actual errors from Stripe verification
      const verificationFailed = errors.length > 0 || (
        disabledReason && disabledReason !== 'requirements.pending_verification'
      );

      return res.json({
        success: true,
        data: {
          hasAccount: true,
          isOnboarded: onboarded,
          payoutsEnabled: payoutsEnabled,
          chargesEnabled: status.chargesEnabled,
          needsRetry,
          verificationFailed,
          requirements: [...new Set([...currentlyDue, ...pastDue])],
          disabledReason,
          errors: errors.map(e => e.reason || e.code || 'Unknown error'),
        },
      });
    } catch (stripeError) {
      // If Stripe call fails, return cached data
      console.warn('[Withdrawal] Stripe status check failed, using cached data:', stripeError.message);
      return res.json({
        success: true,
        data: {
          hasAccount: true,
          isOnboarded: user.stripeConnectOnboarded,
          payoutsEnabled: user.stripeConnectPayoutsEnabled,
          needsRetry: user.stripeConnectAccountId && !user.stripeConnectPayoutsEnabled,
          verificationFailed: false,
          requirements: [],
          disabledReason: null,
        },
      });
    }
  } catch (error) {
    console.error('[Withdrawal] Status check error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to check account status' });
  }
});

// ============================================================================
// BALANCE
// ============================================================================

/**
 * GET /withdrawals/balance
 * Get the creator's available balance from their Stripe connected account.
 */
router.get('/balance', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User().findById(userId).select(
      'stripeConnectAccountId stripeConnectOnboarded stripeConnectPayoutsEnabled'
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // No connect account at all — return zeros
    if (!user.stripeConnectAccountId) {
      return res.json({
        success: true,
        data: {
          available: 0,
          pending: 0,
          currency: 'usd',
          availableFormatted: '$0.00',
          pendingFormatted: '$0.00',
          minimumWithdrawal: MIN_WITHDRAWAL_CENTS,
          minimumWithdrawalFormatted: `$${MIN_WITHDRAWAL_DOLLARS.toFixed(2)}`,
          canWithdraw: false,
        },
      });
    }

    // Try to fetch balance even if not fully onboarded — Stripe will return
    // whatever balance exists on the connected account. If the account has
    // issues, we catch the error and return zeros gracefully.
    try {
      const balance = await stripeService.getConnectAccountBalance(user.stripeConnectAccountId);

      const getCurrencySymbol = (currency) => {
        const cur = String(currency || '').toLowerCase();
        if (cur === 'eur') return '€';
        if (cur === 'gbp') return '£';
        return '$';
      };
      const symbol = getCurrencySymbol(balance.currency);

      // canWithdraw requires: sufficient balance AND payouts fully enabled
      const canWithdraw = balance.available >= MIN_WITHDRAWAL_CENTS
        && user.stripeConnectOnboarded
        && user.stripeConnectPayoutsEnabled;

      res.json({
        success: true,
        data: {
          available: balance.available,
          pending: balance.pending,
          currency: balance.currency,
          availableFormatted: `${symbol}${(balance.available / 100).toFixed(2)}`,
          pendingFormatted: `${symbol}${(balance.pending / 100).toFixed(2)}`,
          minimumWithdrawal: MIN_WITHDRAWAL_CENTS,
          minimumWithdrawalFormatted: `${symbol}${MIN_WITHDRAWAL_DOLLARS.toFixed(2)}`,
          canWithdraw,
        },
      });
    } catch (balanceError) {
      // If Stripe can't fetch balance (e.g. account restricted), return zeros
      console.warn('[Withdrawal] Balance fetch failed for account, returning zeros:', balanceError.message);
      return res.json({
        success: true,
        data: {
          available: 0,
          pending: 0,
          currency: 'usd',
          availableFormatted: '$0.00',
          pendingFormatted: '$0.00',
          minimumWithdrawal: MIN_WITHDRAWAL_CENTS,
          minimumWithdrawalFormatted: `$${MIN_WITHDRAWAL_DOLLARS.toFixed(2)}`,
          canWithdraw: false,
        },
      });
    }
  } catch (error) {
    console.error('[Withdrawal] Balance error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch balance' });
  }
});

// ============================================================================
// PAYOUT (WITHDRAWAL)
// ============================================================================

/**
 * POST /withdrawals/payout
 * Request a payout (withdrawal) from the creator's connected account.
 * Body: { amount } — amount in dollars (e.g. "25.00" or 25)
 */
router.post('/payout', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const { amount } = req.body;

    if (!amount || isNaN(parseFloat(amount))) {
      return res.status(400).json({ success: false, error: 'Valid amount is required' });
    }

    const amountInCents = Math.round(parseFloat(amount) * 100);

    if (amountInCents < MIN_WITHDRAWAL_CENTS) {
      return res.status(400).json({
        success: false,
        error: `Minimum withdrawal is $${MIN_WITHDRAWAL_DOLLARS.toFixed(2)}`,
      });
    }

    const user = await User().findById(userId).select(
      'stripeConnectAccountId stripeConnectOnboarded stripeConnectPayoutsEnabled'
    );

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!user.stripeConnectAccountId) {
      return res.status(400).json({
        success: false,
        error: 'Please complete payout setup first',
      });
    }

    if (!user.stripeConnectOnboarded) {
      return res.status(400).json({
        success: false,
        error: 'Please complete your Stripe account onboarding first',
      });
    }

    // Create the payout via Stripe
    const payoutResult = await stripeService.createPayout(
      user.stripeConnectAccountId,
      amountInCents,
      'usd'
    );

    // Record the withdrawal in our DB
    const withdrawal = await Withdrawal().create({
      creatorId: userId,
      amount: amountInCents,
      currency: 'usd',
      stripePayoutId: payoutResult.payoutId,
      status: payoutResult.status === 'paid' ? 'paid' : 'processing',
      paidAt: payoutResult.status === 'paid' ? new Date() : null,
    });

    res.json({
      success: true,
      data: {
        withdrawalId: withdrawal._id,
        amount: amountInCents,
        amountFormatted: `$${(amountInCents / 100).toFixed(2)}`,
        status: withdrawal.status,
        stripePayoutId: payoutResult.payoutId,
      },
      message: `Withdrawal of $${(amountInCents / 100).toFixed(2)} initiated successfully`,
    });
  } catch (error) {
    console.error('[Withdrawal] Payout error:', error.message);

    // Return user-friendly messages for known errors
    if (error.message.includes('Insufficient balance')) {
      return res.status(400).json({ success: false, error: error.message });
    }

    res.status(500).json({ success: false, error: 'Failed to process withdrawal' });
  }
});

// ============================================================================
// PAYOUT HISTORY
// ============================================================================

/**
 * GET /withdrawals/history
 * Get the creator's payout/withdrawal history.
 */
router.get('/history', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const skip = (page - 1) * limit;

    const withdrawals = await Withdrawal()
      .find({ creatorId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Withdrawal().countDocuments({ creatorId: userId });

    const data = withdrawals.map((w) => ({
      id: w._id,
      amount: w.amount,
      amountFormatted: `$${(w.amount / 100).toFixed(2)}`,
      currency: w.currency,
      status: w.status,
      failureReason: w.failureReason,
      paidAt: w.paidAt,
      createdAt: w.createdAt,
    }));

    res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[Withdrawal] History error:', error.message);
    res.status(500).json({ success: false, error: 'Failed to fetch withdrawal history' });
  }
});

module.exports = router;
