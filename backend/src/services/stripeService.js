/**
 * Stripe Service
 * Handles all Stripe API interactions for subscription management.
 *
 * Responsibilities:
 * - Customer creation/retrieval
 * - Product + Price creation for creator tiers
 * - Subscription lifecycle (create, cancel)
 * - Webhook event processing
 */

const mongoose = require('mongoose');

// Platform revenue split — creator keeps 80%, platform keeps 20%
const PLATFORM_FEE_PERCENT = 20;

// Helper to safely parse dates from Stripe timestamps
const parseStripeDate = (timestamp) => {
  if (!timestamp || isNaN(timestamp)) return null;
  const date = new Date(timestamp * 1000);
  return isNaN(date.getTime()) ? null : date;
};

// ============= STRIPE INITIALIZATION =============

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured. Set it in your environment variables.');
  }
  // Lazy-init: require stripe only when needed
  const Stripe = require('stripe');
  return new Stripe(secretKey, { apiVersion: '2022-11-15' });
}

// ============= CUSTOMER MANAGEMENT =============

/**
 * Get or create a Stripe Customer for a given user.
 * Stores the stripeCustomerId on the User document for reuse.
 */
async function getOrCreateCustomer(userId) {
  const User = mongoose.model('User');
  const user = await User.findById(userId).select('email displayName stripeCustomerId');

  if (!user) {
    throw new Error('User not found');
  }

  // If user already has a Stripe customer, return it
  if (user.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  const stripe = getStripe();

  // Check if a customer with this email already exists in Stripe
  const existingCustomers = await stripe.customers.list({
    email: user.email,
    limit: 1,
  });

  let customerId;

  if (existingCustomers.data.length > 0) {
    customerId = existingCustomers.data[0].id;
  } else {
    // Create a new Stripe customer
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.displayName || 'User',
      metadata: {
        userId: String(userId),
      },
    });
    customerId = customer.id;
  }

  // Persist the Stripe customer ID on the user
  await User.findByIdAndUpdate(userId, { stripeCustomerId: customerId });

  return customerId;
}

// ============= TIER / PRODUCT MANAGEMENT =============

/**
 * Create a Stripe Product + recurring Price for a creator's subscription tier.
 * Returns the created Stripe product and price IDs.
 */
async function createStripeProductAndPrice(tier) {
  const stripe = getStripe();

  const User = mongoose.model('User');
  const creator = await User.findById(tier.creatorId).select('displayName username');
  const creatorName = creator?.displayName || creator?.username || 'Creator';

  // Create the Stripe Product
  const product = await stripe.products.create({
    name: `${tier.title} — ${creatorName}`,
    description: tier.description || `Subscription tier by ${creatorName}`,
    metadata: {
      tierId: String(tier._id),
      creatorId: String(tier.creatorId),
    },
  });

  // Create a recurring monthly Price
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: tier.priceInCents,
    currency: tier.currency || 'usd',
    recurring: {
      interval: 'month',
    },
    metadata: {
      tierId: String(tier._id),
      creatorId: String(tier.creatorId),
    },
  });

  return { stripeProductId: product.id, stripePriceId: price.id };
}

/**
 * Update the Stripe Product metadata/name when a tier is edited.
 * If the price changed, create a new Price (Stripe prices are immutable).
 */
async function updateStripeProduct(tier, priceChanged = false) {
  const stripe = getStripe();

  // Update product details
  if (tier.stripeProductId) {
    await stripe.products.update(tier.stripeProductId, {
      name: tier.title,
      description: tier.description,
    });
  }

  // If price changed, create a new Price and deactivate the old one
  if (priceChanged && tier.stripeProductId) {
    // Deactivate old price
    if (tier.stripePriceId) {
      await stripe.prices.update(tier.stripePriceId, { active: false });
    }

    // Create new price
    const newPrice = await stripe.prices.create({
      product: tier.stripeProductId,
      unit_amount: tier.priceInCents,
      currency: tier.currency || 'usd',
      recurring: {
        interval: 'month',
      },
      metadata: {
        tierId: String(tier._id),
        creatorId: String(tier.creatorId),
      },
    });

    return { stripePriceId: newPrice.id };
  }

  return {};
}

/**
 * Deactivate a Stripe Product when a creator deletes their tier.
 */
async function deactivateStripeProduct(tier) {
  const stripe = getStripe();

  if (tier.stripeProductId) {
    await stripe.products.update(tier.stripeProductId, { active: false });
  }
  if (tier.stripePriceId) {
    await stripe.prices.update(tier.stripePriceId, { active: false });
  }
}

// ============= STRIPE CONNECT (Creator Payouts) =============

/**
 * Create a Stripe Express Connected Account for a creator.
 * This allows the creator to receive payouts from subscription revenue.
 */
async function createConnectAccount(userId) {
  const stripe = getStripe();
  const User = mongoose.model('User');
  const user = await User.findById(userId).select('email displayName stripeConnectAccountId');

  if (!user) {
    throw new Error('User not found');
  }

  // If already has a connect account, return it
  if (user.stripeConnectAccountId) {
    return user.stripeConnectAccountId;
  }

  // Create a Stripe Express account
  const account = await stripe.accounts.create({
    type: 'express',
    email: user.email,
    metadata: {
      userId: String(userId),
    },
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
  });

  // Save the connect account ID on the user
  await User.findByIdAndUpdate(userId, {
    stripeConnectAccountId: account.id,
  });

  console.log(`✅ [Stripe Connect] Created Express account ${account.id} for user ${userId}`);
  return account.id;
}

/**
 * Generate a Stripe Connect onboarding link.
 * The creator opens this URL to complete their account setup (bank details, identity, etc.).
 */
async function createOnboardingLink(accountId, userId) {
  const stripe = getStripe();

  // In production, these should be deep links back to the app
  // For now, use generic return URLs that the app can handle
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.APP_URL || 'https://comedyapp.com'}/stripe/refresh?userId=${userId}`,
    return_url: `${process.env.APP_URL || 'https://comedyapp.com'}/stripe/return?userId=${userId}`,
    type: 'account_onboarding',
  });

  return accountLink.url;
}

/**
 * Generate a Stripe Express Dashboard login link for an already-onboarded creator.
 */
async function createLoginLink(accountId) {
  const stripe = getStripe();
  const loginLink = await stripe.accounts.createLoginLink(accountId);
  return loginLink.url;
}

/**
 * Check the status of a creator's Stripe Connect account.
 * Returns whether onboarding is complete and payouts are enabled.
 */
async function getConnectAccountStatus(accountId) {
  const stripe = getStripe();
  const account = await stripe.accounts.retrieve(accountId);

  return {
    id: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: account.requirements,
  };
}

/**
 * Get the available balance on a creator's connected account.
 * This is the money that has been settled and is available for payout.
 */
async function getConnectAccountBalance(accountId) {
  const stripe = getStripe();

  const balance = await stripe.balance.retrieve({}, {
    stripeAccount: accountId,
  });

  // Sum up available amounts (typically just one entry for 'usd')
  const available = balance.available.reduce((sum, b) => {
    return sum + b.amount;
  }, 0);

  const pending = balance.pending.reduce((sum, b) => {
    return sum + b.amount;
  }, 0);

  return {
    available, // in cents
    pending,   // in cents
    currency: balance.available[0]?.currency || 'usd',
  };
}

/**
 * Create a payout (withdrawal) from the creator's connected account to their bank.
 * Amount is in cents.
 */
async function createPayout(accountId, amountInCents, currency = 'usd') {
  const stripe = getStripe();

  // Verify balance is sufficient
  const balance = await getConnectAccountBalance(accountId);
  if (balance.available < amountInCents) {
    throw new Error(`Insufficient balance. Available: $${(balance.available / 100).toFixed(2)}, Requested: $${(amountInCents / 100).toFixed(2)}`);
  }

  // Create the payout on the connected account
  const payout = await stripe.payouts.create(
    {
      amount: amountInCents,
      currency,
      metadata: {
        stripeAccountId: accountId,
      },
    },
    {
      stripeAccount: accountId,
    }
  );

  console.log(`✅ [Stripe Connect] Payout ${payout.id} created for account ${accountId}: $${(amountInCents / 100).toFixed(2)}`);

  return {
    payoutId: payout.id,
    amount: payout.amount,
    currency: payout.currency,
    status: payout.status,
    arrivalDate: payout.arrival_date,
  };
}

// ============= LINK EXISTING SUBSCRIPTIONS TO CONNECT =============

/**
 * When a creator completes Stripe Connect onboarding, retroactively update
 * all their existing active subscriptions to route future payments to their
 * connected account. Without this, subscriptions created before Connect setup
 * send all money to the platform and the creator's Stripe balance stays at $0.
 */
async function linkExistingSubscriptionsToConnect(creatorId, connectAccountId) {
  const stripe = getStripe();
  const Subscription = mongoose.model('Subscription');

  // Find all active subscriptions where this user is the creator
  const activeSubs = await Subscription.find({
    creatorId,
    status: { $in: ['active', 'trialing', 'past_due'] },
  }).select('stripeSubscriptionId').lean();

  if (activeSubs.length === 0) {
    console.log(`[Stripe Connect] No active subscriptions to link for creator ${creatorId}`);
    return { updated: 0, failed: 0 };
  }

  let updated = 0;
  let failed = 0;

  for (const sub of activeSubs) {
    try {
      // Check if this subscription already has transfer_data
      const stripeSub = await stripe.subscriptions.retrieve(sub.stripeSubscriptionId);

      if (stripeSub.transfer_data?.destination === connectAccountId) {
        // Already linked, skip
        continue;
      }

      // Update the subscription to route future payments to the creator
      await stripe.subscriptions.update(sub.stripeSubscriptionId, {
        application_fee_percent: PLATFORM_FEE_PERCENT,
        transfer_data: {
          destination: connectAccountId,
        },
      });

      updated++;
      console.log(`✅ [Stripe Connect] Linked subscription ${sub.stripeSubscriptionId} → ${connectAccountId}`);
    } catch (err) {
      failed++;
      console.error(`⚠️ [Stripe Connect] Failed to link subscription ${sub.stripeSubscriptionId}:`, err.message);
    }
  }

  console.log(`[Stripe Connect] Link results for creator ${creatorId}: ${updated} updated, ${failed} failed out of ${activeSubs.length} total`);
  return { updated, failed, total: activeSubs.length };
}

// ============= SUBSCRIPTION MANAGEMENT =============

/**
 * Create a Stripe Subscription for a subscriber to a creator's tier.
 * Uses PaymentIntent flow — returns the client secret for the frontend
 * to collect payment via Stripe Payment Sheet.
 */
async function createSubscription(subscriberId, tierId) {
  const stripe = getStripe();

  const SubscriptionTier = mongoose.model('SubscriptionTier');
  const tier = await SubscriptionTier.findById(tierId);

  if (!tier || !tier.isActive) {
    throw new Error('Subscription tier not found or inactive');
  }

  if (!tier.stripePriceId) {
    throw new Error('Tier has no Stripe price configured');
  }

  // Prevent self-subscription
  if (String(tier.creatorId) === String(subscriberId)) {
    throw new Error('You cannot subscribe to your own tier');
  }

  // Check for existing active subscription to this specific tier
  const Subscription = mongoose.model('Subscription');
  const existing = await Subscription.findOne({
    subscriberId,
    tierId,
    status: { $in: ['active', 'trialing', 'past_due'] },
  });

  if (existing) {
    throw new Error('You already have an active subscription to this tier');
  }

  // Get or create the Stripe customer
  const customerId = await getOrCreateCustomer(subscriberId);

  // Check if the creator has a connected Stripe account for revenue splitting
  const User = mongoose.model('User');
  const creator = await User.findById(tier.creatorId).select('stripeConnectAccountId stripeConnectOnboarded');

  // Build subscription options
  const subscriptionOptions = {
    customer: customerId,
    items: [{ price: tier.stripePriceId }],
    payment_behavior: 'default_incomplete',
    payment_settings: {
      save_default_payment_method: 'on_subscription',
    },
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      subscriberId: String(subscriberId),
      creatorId: String(tier.creatorId),
      tierId: String(tierId),
    },
  };

  // If creator has a connected account and payouts are enabled, split payments: 80% to creator, 20% platform
  if (creator?.stripeConnectAccountId && creator?.stripeConnectOnboarded && creator?.stripeConnectPayoutsEnabled) {
    subscriptionOptions.application_fee_percent = PLATFORM_FEE_PERCENT;
    subscriptionOptions.transfer_data = {
      destination: creator.stripeConnectAccountId,
    };
    console.log(`[Stripe] Splitting payments: ${100 - PLATFORM_FEE_PERCENT}% → ${creator.stripeConnectAccountId}`);
  } else {
    console.log(`[Stripe] Creator ${tier.creatorId} payouts are not fully enabled — full payment goes to platform`);
  }

  // Create the Stripe Subscription
  const subscription = await stripe.subscriptions.create(subscriptionOptions);

  console.log('[Stripe Debug] Subscription details:', {
    id: subscription.id,
    status: subscription.status,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
  });

  // Save the subscription record in our DB
  const subRecord = await Subscription.create({
    subscriberId,
    creatorId: tier.creatorId,
    tierId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: tier.stripePriceId,
    status: subscription.status,
    currentPeriodStart: parseStripeDate(subscription.current_period_start),
    currentPeriodEnd: parseStripeDate(subscription.current_period_end),
  });

  // Return the client secret for the frontend Payment Sheet
  let latestInvoice = subscription.latest_invoice;
  
  // Fail-safe: if latest_invoice was not expanded by Stripe, retrieve it manually
  if (typeof latestInvoice === 'string') {
    console.log(`[Stripe Debug] latest_invoice was not expanded (ID: ${latestInvoice}). Fetching manually...`);
    latestInvoice = await stripe.invoices.retrieve(latestInvoice, {
      expand: ['payment_intent'],
    });
  }

  const clientSecret = latestInvoice?.payment_intent?.client_secret;

  if (!clientSecret) {
    console.error('[Stripe Debug] Failed to get clientSecret. Full subscription.latest_invoice:', latestInvoice);
    throw new Error('Failed to get payment client secret from Stripe');
  }

  return {
    subscriptionId: subRecord._id,
    stripeSubscriptionId: subscription.id,
    clientSecret,
    customerId,
  };
}

/**
 * Cancel a subscription. Sets it to cancel at the end of the billing period
 * so the subscriber keeps access until they've paid for.
 */
async function cancelSubscription(subscriptionId, userId) {
  const stripe = getStripe();
  const Subscription = mongoose.model('Subscription');

  const sub = await Subscription.findById(subscriptionId);

  if (!sub) {
    throw new Error('Subscription not found');
  }

  // Only the subscriber can cancel their own subscription
  if (String(sub.subscriberId) !== String(userId)) {
    throw new Error('You can only cancel your own subscription');
  }

  if (sub.status === 'canceled') {
    throw new Error('Subscription is already canceled');
  }

  // Cancel at period end so they keep access until billing cycle ends
  const updated = await stripe.subscriptions.update(sub.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  // Update our record
  sub.cancelAtPeriodEnd = true;
  sub.canceledAt = new Date();
  await sub.save();

  return {
    status: updated.status,
    cancelAtPeriodEnd: updated.cancel_at_period_end,
    currentPeriodEnd: parseStripeDate(updated.current_period_end),
  };
}

// ============= WEBHOOK EVENT HANDLING =============

/**
 * Process incoming Stripe webhook events.
 * Updates our Subscription records based on Stripe lifecycle events.
 */
async function handleWebhookEvent(event) {
  const Subscription = mongoose.model('Subscription');
  const SubscriptionTier = mongoose.model('SubscriptionTier');

  switch (event.type) {
    // ---- Subscription lifecycle events ----

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const stripeSubscription = event.data.object;

      const sub = await Subscription.findOne({
        stripeSubscriptionId: stripeSubscription.id,
      });

      if (sub) {
        sub.status = stripeSubscription.status;
        sub.currentPeriodStart = parseStripeDate(stripeSubscription.current_period_start);
        sub.currentPeriodEnd = parseStripeDate(stripeSubscription.current_period_end);
        sub.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end || false;

        if (stripeSubscription.canceled_at) {
          sub.canceledAt = parseStripeDate(stripeSubscription.canceled_at);
        }

        await sub.save();

        // Update subscriber count on the tier
        if (stripeSubscription.status === 'active' && sub.tierId) {
          const activeCount = await Subscription.countDocuments({
            tierId: sub.tierId,
            status: { $in: ['active', 'trialing'] },
          });
          await SubscriptionTier.findByIdAndUpdate(sub.tierId, {
            subscriberCount: activeCount,
          });
        }

        console.log(`✅ [Stripe] Subscription ${stripeSubscription.id} updated → ${stripeSubscription.status}`);
      } else {
        console.warn(`⚠️ [Stripe] Subscription ${stripeSubscription.id} not found in DB`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const stripeSubscription = event.data.object;

      const sub = await Subscription.findOne({
        stripeSubscriptionId: stripeSubscription.id,
      });

      if (sub) {
        sub.status = 'canceled';
        sub.canceledAt = sub.canceledAt || new Date();
        await sub.save();

        // Update subscriber count
        if (sub.tierId) {
          const activeCount = await Subscription.countDocuments({
            tierId: sub.tierId,
            status: { $in: ['active', 'trialing'] },
          });
          await SubscriptionTier.findByIdAndUpdate(sub.tierId, {
            subscriberCount: activeCount,
          });
        }

        console.log(`✅ [Stripe] Subscription ${stripeSubscription.id} deleted/canceled`);
      }
      break;
    }

    // ---- Invoice / Payment events ----

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;

      if (invoice.subscription) {
        const sub = await Subscription.findOne({
          stripeSubscriptionId: invoice.subscription,
        });

        if (sub && sub.status !== 'active') {
          sub.status = 'active';
          await sub.save();
          console.log(`✅ [Stripe] Payment succeeded for subscription ${invoice.subscription}`);
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;

      if (invoice.subscription) {
        const sub = await Subscription.findOne({
          stripeSubscriptionId: invoice.subscription,
        });

        if (sub) {
          sub.status = 'past_due';
          await sub.save();
          console.warn(`⚠️ [Stripe] Payment failed for subscription ${invoice.subscription}`);
        }
      }
      break;
    }

    // ---- Stripe Connect events ----

    case 'account.updated': {
      const account = event.data.object;
      const User = mongoose.model('User');

      // Find user by their connected account ID
      const user = await User.findOne({ stripeConnectAccountId: account.id });
      if (user) {
        const wasPayoutsEnabled = user.stripeConnectPayoutsEnabled;
        user.stripeConnectOnboarded = account.details_submitted || false;
        user.stripeConnectPayoutsEnabled = account.payouts_enabled || false;
        await user.save();
        console.log(`✅ [Stripe Connect] Account ${account.id} updated → onboarded: ${user.stripeConnectOnboarded}, payouts: ${user.stripeConnectPayoutsEnabled}`);

        // If payouts just became enabled, link all existing subscriptions
        // so future payments route to the creator's connected account
        if (!wasPayoutsEnabled && user.stripeConnectPayoutsEnabled) {
          console.log(`🔗 [Stripe Connect] Payouts just enabled for ${user._id}, linking existing subscriptions...`);
          try {
            await linkExistingSubscriptionsToConnect(user._id, account.id);
          } catch (linkError) {
            console.error(`⚠️ [Stripe Connect] Error linking subscriptions for ${user._id}:`, linkError.message);
          }
        }
      } else {
        console.warn(`⚠️ [Stripe Connect] No user found for account ${account.id}`);
      }
      break;
    }

    case 'payout.paid': {
      const payout = event.data.object;
      const Withdrawal = mongoose.model('Withdrawal');

      const withdrawal = await Withdrawal.findOne({ stripePayoutId: payout.id });
      if (withdrawal) {
        withdrawal.status = 'paid';
        withdrawal.paidAt = new Date();
        await withdrawal.save();
        console.log(`✅ [Stripe Connect] Payout ${payout.id} paid`);
      }
      break;
    }

    case 'payout.failed': {
      const payout = event.data.object;
      const Withdrawal = mongoose.model('Withdrawal');

      const withdrawal = await Withdrawal.findOne({ stripePayoutId: payout.id });
      if (withdrawal) {
        withdrawal.status = 'failed';
        withdrawal.failureReason = payout.failure_message || 'Payout failed';
        await withdrawal.save();
        console.warn(`⚠️ [Stripe Connect] Payout ${payout.id} failed: ${payout.failure_message}`);
      }
      break;
    }

    default:
      // Unhandled event type — ignore silently
      if (process.env.NODE_ENV !== 'production') {
        console.log(`ℹ️ [Stripe] Unhandled event type: ${event.type}`);
      }
  }
}

/**
 * Verify and construct a Stripe webhook event from the raw body + signature.
 */
function constructWebhookEvent(rawBody, signature) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
  }

  return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
}

module.exports = {
  PLATFORM_FEE_PERCENT,
  getStripe,
  getOrCreateCustomer,
  createStripeProductAndPrice,
  updateStripeProduct,
  deactivateStripeProduct,
  createSubscription,
  cancelSubscription,
  handleWebhookEvent,
  constructWebhookEvent,
  // Stripe Connect (creator payouts)
  createConnectAccount,
  createOnboardingLink,
  createLoginLink,
  getConnectAccountStatus,
  getConnectAccountBalance,
  createPayout,
  linkExistingSubscriptionsToConnect,
};
