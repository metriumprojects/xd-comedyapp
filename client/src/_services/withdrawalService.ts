/**
 * Withdrawal Service
 * Client-side service for creator payout/withdrawal API calls.
 * Communicates with the backend withdrawal endpoints.
 */

import { apiService } from './apiService';

// ============= TYPES =============

export interface ConnectStatus {
  hasAccount: boolean;
  isOnboarded: boolean;
  payoutsEnabled: boolean;
  chargesEnabled?: boolean;
  requirements?: string[];
  needsRetry?: boolean;
  verificationFailed?: boolean;
  disabledReason?: string | null;
  errors?: string[];
}

export interface BalanceData {
  available: number;       // in cents
  pending: number;         // in cents
  currency: string;
  availableFormatted: string;
  pendingFormatted: string;
  minimumWithdrawal: number;
  minimumWithdrawalFormatted: string;
  canWithdraw: boolean;
}

export interface WithdrawalRecord {
  id: string;
  amount: number;
  amountFormatted: string;
  currency: string;
  status: 'pending' | 'processing' | 'paid' | 'failed' | 'canceled';
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
}

// ============= API METHODS =============

export const withdrawalService = {
  /**
   * Start or resume Stripe Connect onboarding.
   * Returns a URL that should be opened in the system browser.
   */
  startOnboarding: async (): Promise<{
    success: boolean;
    data: {
      url: string;
      type: 'onboarding' | 'dashboard';
      alreadyOnboarded: boolean;
    };
  }> => {
    return apiService.post('/withdrawals/connect/onboard', {});
  },

  /**
   * Check the creator's Stripe Connect account status.
   */
  getConnectStatus: async (): Promise<{
    success: boolean;
    data: ConnectStatus;
  }> => {
    return apiService.get('/withdrawals/connect/status');
  },

  /**
   * Get the creator's available balance from Stripe.
   */
  getBalance: async (): Promise<{
    success: boolean;
    data: BalanceData;
  }> => {
    return apiService.get('/withdrawals/balance');
  },

  /**
   * Request a payout (withdrawal).
   * @param amount - Amount in dollars (e.g. "25.00")
   */
  requestPayout: async (amount: string): Promise<{
    success: boolean;
    data: {
      withdrawalId: string;
      amount: number;
      amountFormatted: string;
      status: string;
      stripePayoutId: string;
    };
    message: string;
  }> => {
    return apiService.post('/withdrawals/payout', { amount });
  },

  /**
   * Get payout/withdrawal history.
   */
  getPayoutHistory: async (page: number = 1, limit: number = 20): Promise<{
    success: boolean;
    data: WithdrawalRecord[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> => {
    return apiService.get(`/withdrawals/history?page=${page}&limit=${limit}`);
  },
};

export default withdrawalService;
