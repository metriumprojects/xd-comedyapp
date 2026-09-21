/**
 * Subscription Service
 * Client-side service for subscription API calls.
 * Communicates with the backend subscription endpoints.
 */

import { apiService } from './apiService';

// ============= TIER MANAGEMENT (Creator) =============

export interface TierData {
  title: string;
  description: string;
  price: string; // Dollar amount as string (e.g. "9.99")
  benefits: string[];
  createGroupChat: boolean;
}

export interface TierResponse {
  _id: string;
  creatorId: string;
  title: string;
  description: string;
  priceInCents: number;
  price: string; // Dollar string from API
  benefits: string[];
  createGroupChat: boolean;
  stripeProductId: string | null;
  stripePriceId: string | null;
  isActive: boolean;
  isArchived?: boolean;
  isPrivate?: boolean;
  subscriberCount: number;
}

export interface SubscriptionRecord {
  id: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string;
  createdAt: string;
  creator: {
    id: string;
    displayName: string;
    username: string;
    avatar: string | null;
  } | null;
  tier: {
    id: string;
    title: string;
    description: string;
    price: string;
    benefits: string[];
  } | null;
}

// ============= API METHODS =============

export const subscriptionService = {
  /**
   * Creator creates or updates their subscription tier.
   */
  createTier: async (data: TierData & { tierId?: string }): Promise<{ success: boolean; data: TierResponse }> => {
    return apiService.post('/subscriptions/tiers', data);
  },

  /**
   * Get all active subscription tiers of a creator.
   */
  getTiers: async (creatorId: string): Promise<{ success: boolean; data: TierResponse[] }> => {
    return apiService.get(`/subscriptions/tiers/${creatorId}`);
  },

  /**
   * Get a creator's active subscription tier (legacy helper, returns the first tier).
   */
  getTier: async (creatorId: string): Promise<{ success: boolean; data: TierResponse | null }> => {
    try {
      const res = await apiService.get(`/subscriptions/tiers/${creatorId}`);
      return {
        success: res.success,
        data: (res.success && Array.isArray(res.data) && res.data.length > 0) ? res.data[0] : null
      };
    } catch {
      return { success: false, data: null };
    }
  },

  /**
   * Creator deletes their subscription tier.
   */
  deleteTier: async (tierId: string): Promise<{ success: boolean }> => {
    return apiService.delete(`/subscriptions/tiers/${tierId}`);
  },

  /**
   * Creator restores an archived subscription tier.
   */
  restoreTier: async (tierId: string): Promise<{ success: boolean; data: TierResponse; message?: string }> => {
    return apiService.post(`/subscriptions/tiers/${tierId}/restore`, {});
  },

  /**
   * Creator updates visibility (public/private) of an archived tier.
   */
  updateTierVisibility: async (tierId: string, isPrivate: boolean): Promise<{ success: boolean; data: TierResponse; message?: string }> => {
    return apiService.patch(`/subscriptions/tiers/${tierId}/visibility`, { isPrivate });
  },

  /**
   * Subscriber initiates a subscription to a creator's tier.
   * Returns the Stripe client secret for the Payment Sheet.
   */
  subscribe: async (tierId: string): Promise<{
    success: boolean;
    data: {
      subscriptionId: string;
      stripeSubscriptionId: string;
      clientSecret: string;
      customerId: string;
      publishableKey: string;
    };
  }> => {
    return apiService.post('/subscriptions/create', { tierId });
  },

  /**
   * Subscriber cancels their subscription.
   * Subscription remains active until end of billing period.
   */
  cancelSubscription: async (subscriptionId: string): Promise<{
    success: boolean;
    data: {
      status: string;
      cancelAtPeriodEnd: boolean;
      currentPeriodEnd: string;
    };
  }> => {
    return apiService.post('/subscriptions/cancel', { subscriptionId });
  },

  /**
   * Confirm subscription status after successful payment.
   * This syncs the Stripe status to our DB immediately, bypassing the webhook delay.
   */
  confirmSubscription: async (subscriptionId: string): Promise<{
    success: boolean;
    data: {
      status: string;
      isActive: boolean;
    };
  }> => {
    return apiService.post('/subscriptions/confirm', { subscriptionId });
  },

  /**
   * Check if the current user is subscribed to a specific creator.
   */
  checkSubscriptionStatus: async (creatorId: string): Promise<{
    success: boolean;
    data: {
      isSubscribed: boolean;
      activeTierIds: string[];
      subscriptions: Array<{
        id: string;
        tierId: string;
        status: string;
        currentPeriodEnd: string;
        cancelAtPeriodEnd: boolean;
      }>;
      subscription: {
        id: string;
        status: string;
        currentPeriodEnd: string;
        cancelAtPeriodEnd: boolean;
      } | null;
    };
  }> => {
    return apiService.get(`/subscriptions/status/${creatorId}`);
  },

  /**
   * Get all active subscriptions for the current user (subscriber view).
   */
  getMySubscriptions: async (): Promise<{
    success: boolean;
    data: SubscriptionRecord[];
  }> => {
    return apiService.get('/subscriptions/my-subscriptions');
  },

  /**
   * Get all subscribers of the current user (creator view), optionally filtered by tierId.
   */
  getMySubscribers: async (tierId?: string): Promise<{
    success: boolean;
    data: Array<{
      id: string;
      status: string;
      createdAt: string;
      subscriber: {
        id: string;
        displayName: string;
        username: string;
        avatar: string | null;
      } | null;
      tier?: {
        id: string;
        title: string;
        price: string;
      } | null;
    }>;
    count: number;
  }> => {
    const url = tierId ? `/subscriptions/my-subscribers?tierId=${tierId}` : '/subscriptions/my-subscribers';
    return apiService.get(url);
  },
};

export default subscriptionService;
