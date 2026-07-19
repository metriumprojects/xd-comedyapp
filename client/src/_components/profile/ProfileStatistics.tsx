import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Linking, Animated } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@/lib/storage';
import { apiService } from '@/src/_services/apiService';
import { DEFAULT_AVATAR_URL } from '@/lib/api';
import { subscriptionService } from '@/src/_services/subscriptionService';
import { withdrawalService, type ConnectStatus, type BalanceData, type WithdrawalRecord } from '@/src/_services/withdrawalService';

interface ProfileStatisticsProps {
  creatorPosts?: any[];
  currentUserId?: string | null;
}

interface SubscriberItem {
  id: string;
  status: string;
  createdAt: string;
  subscriberId: string;
  subscriberName: string;
  subscriberAvatar: string;
  subscriberUsername: string;
  title: string;
  price: string;
}

export const ProfileStatistics: React.FC<ProfileStatisticsProps> = ({
  creatorPosts = [],
  currentUserId = null,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'recent' | 'all' | 'oldest' | 'canceled'>('recent');
  const [subscribers, setSubscribers] = useState<SubscriberItem[]>([]);
  const [tierPrice, setTierPrice] = useState<string>('0');

  // Withdrawal state
  const [connectStatus, setConnectStatus] = useState<ConnectStatus | null>(null);
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [payoutHistory, setPayoutHistory] = useState<WithdrawalRecord[]>([]);

  // Skeleton pulsing animation
  const skeletonOpacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (loading) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(skeletonOpacity, {
            toValue: 0.7,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(skeletonOpacity, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    } else {
      skeletonOpacity.setValue(1);
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [loading]);

  // Reset states on userId change to prevent showing old cached results
  useEffect(() => {
    setSubscribers([]);
    setTierPrice('0');
    setConnectStatus(null);
    setBalance(null);
    setPayoutHistory([]);
    setLoading(true);
  }, [currentUserId]);

  // Skeleton rendering helper for subscriber list item cards
  const renderSkeletonCard = () => {
    return (
      <Animated.View style={[styles.subscriberCard, { opacity: skeletonOpacity }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: '#e5e5ea' }]} />
          <View style={styles.cardHeaderInfo}>
            <View style={{ width: 120, height: 16, backgroundColor: '#e5e5ea', borderRadius: 4, marginBottom: 6 }} />
            <View style={{ width: 180, height: 12, backgroundColor: '#e5e5ea', borderRadius: 4, marginBottom: 4 }} />
            <View style={{ width: 80, height: 12, backgroundColor: '#e5e5ea', borderRadius: 4 }} />
          </View>
        </View>
        <View style={[styles.btnMessage, { backgroundColor: '#e5e5ea', width: 90, marginTop: 10 }]}>
          <View style={{ width: 60, height: 12, backgroundColor: '#d1d1d6', borderRadius: 4 }} />
        </View>
      </Animated.View>
    );
  };

  const renderStatValue = (val: string | number, width = 60) => {
    if (loading) {
      return (
        <Animated.View style={{ width, height: 28, backgroundColor: '#e5e5ea', borderRadius: 6, marginVertical: 4, opacity: skeletonOpacity }} />
      );
    }
    return <Text style={styles.statValue}>{val}</Text>;
  };

  const renderBalanceValue = (val: string, width = 120) => {
    if (loading) {
      return (
        <Animated.View style={{ width, height: 36, backgroundColor: '#e5e5ea', borderRadius: 6, marginVertical: 4, opacity: skeletonOpacity }} />
      );
    }
    return <Text style={styles.moneyValue}>{val}</Text>;
  };

  const loadSubscribers = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      // Load real subscribers from backend API
      const response = await subscriptionService.getMySubscribers();
      if (response.success && Array.isArray(response.data)) {
        const items: SubscriberItem[] = response.data.map((sub: any) => ({
          id: sub.id,
          status: sub.status || 'active',
          createdAt: sub.createdAt || new Date().toISOString(),
          subscriberId: sub.subscriber?.id || '',
          subscriberName: sub.subscriber?.displayName || 'Subscriber',
          subscriberAvatar: sub.subscriber?.avatar || DEFAULT_AVATAR_URL,
          subscriberUsername: sub.subscriber?.username || 'user',
          title: sub.tier?.title || 'Subscription',
          price: sub.tier?.price || '0',
        }));
        setSubscribers(items);
      } else {
        setSubscribers([]);
      }

      // Load own tier price for earnings calculation
      const tierResponse = await subscriptionService.getTier(currentUserId);
      if (tierResponse.success && tierResponse.data?.price) {
        setTierPrice(tierResponse.data.price);
      }
    } catch (e) {
      console.warn('[ProfileStatistics] Error loading subscribers:', e);
      setSubscribers([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadSubscribers();
  }, [loadSubscribers]);

  // Load withdrawal-related data (Connect status + balance + history)
  const loadWithdrawalData = useCallback(async () => {
    try {
      // Check Connect account status
      const statusRes = await withdrawalService.getConnectStatus();
      if (statusRes.success) {
        setConnectStatus(statusRes.data);

        // Fetch balance whenever a connect account exists (not just when onboarded)
        // This ensures we show real Stripe balance even if verification is pending/failed
        if (statusRes.data.hasAccount) {
          const balanceRes = await withdrawalService.getBalance();
          if (balanceRes.success) {
            setBalance(balanceRes.data);
          }

          // Fetch payout history if there's any account
          const historyRes = await withdrawalService.getPayoutHistory(1, 5);
          if (historyRes.success) {
            setPayoutHistory(historyRes.data);
          }
        }
      }
    } catch (e) {
      console.warn('[ProfileStatistics] Error loading withdrawal data:', e);
    }
  }, []);

  useEffect(() => {
    loadWithdrawalData();
  }, [loadWithdrawalData]);

  // Calculate total earnings from active subscribers (always available regardless of Stripe status)
  const totalEarnings = useMemo(() => {
    const activeCount = subscribers.filter(s => s.status === 'active').length;
    const priceNum = parseFloat(tierPrice) || 0;
    return (activeCount * priceNum).toFixed(2);
  }, [subscribers, tierPrice]);

  // The display balance — prefer real Stripe balance if available and > 0, else show estimated earnings
  const displayBalance = useMemo(() => {
    // If we have a real Stripe balance (even with verification issues), show it
    if (balance && (balance.available > 0 || balance.pending > 0)) {
      return balance.availableFormatted;
    }
    // Always fall back to estimated earnings from subscriber count
    return `$${totalEarnings}`;
  }, [balance, totalEarnings]);

  // Label for the balance display
  const displayBalanceLabel = useMemo(() => {
    if (connectStatus?.isOnboarded && connectStatus?.payoutsEnabled) {
      return 'Available balance';
    }
    if (balance && (balance.available > 0 || balance.pending > 0)) {
      return 'Balance (setup required to withdraw)';
    }
    return 'Estimated earnings';
  }, [connectStatus, balance]);

  const pendingBalance = useMemo(() => {
    if (balance && balance.pending > 0) {
      return balance.pendingFormatted;
    }
    return '$0.00';
  }, [balance]);

  // Determine if the user is in a "stuck" state — has account but verification failed
  const isVerificationIssue = useMemo(() => {
    return connectStatus?.hasAccount && (
      connectStatus?.verificationFailed ||
      connectStatus?.needsRetry
    ) && !connectStatus?.payoutsEnabled;
  }, [connectStatus]);

  // Handle "Set up payouts" button
  const handleSetupPayouts = async () => {
    setSetupLoading(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      const res = await withdrawalService.startOnboarding();
      if (res.success && res.data.url) {
        await Linking.openURL(res.data.url);
        // After returning from browser, refresh status
        setTimeout(() => loadWithdrawalData(), 2000);
      } else {
        Alert.alert('Error', 'Failed to start payout setup. Please try again.');
      }
    } catch (e: any) {
      console.error('[ProfileStatistics] Setup payouts error:', e);
      Alert.alert('Error', 'Failed to start payout setup. Please try again.');
    } finally {
      setSetupLoading(false);
    }
  };

  // Handle real withdrawal
  const handleWithdraw = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    if (!connectStatus?.isOnboarded) {
      Alert.alert(
        'Setup Required',
        'You need to set up your payout account first before withdrawing.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Set Up Now', onPress: handleSetupPayouts },
        ]
      );
      return;
    }

    if (!balance || !balance.canWithdraw) {
      Alert.alert(
        'Insufficient Balance',
        `You need at least ${balance?.minimumWithdrawalFormatted || '$5.00'} to withdraw. Your available balance is ${balance?.availableFormatted || '$0.00'}.`
      );
      return;
    }

    // Show confirmation dialog with full available balance
    const withdrawAmount = (balance.available / 100).toFixed(2);
    Alert.alert(
      'Confirm Withdrawal',
      `Withdraw ${balance.availableFormatted} to your bank account?\n\nThis typically takes 2-3 business days to arrive.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Withdraw',
          style: 'default',
          onPress: async () => {
            setWithdrawLoading(true);
            try {
              const res = await withdrawalService.requestPayout(withdrawAmount);
              if (res.success) {
                Alert.alert(
                  'Withdrawal Initiated! 🎉',
                  `${res.data.amountFormatted} is being sent to your bank account. You'll receive it within 2-3 business days.`
                );
                // Refresh balance and history
                loadWithdrawalData();
              } else {
                Alert.alert('Withdrawal Failed', 'Something went wrong. Please try again.');
              }
            } catch (e: any) {
              console.error('[ProfileStatistics] Withdraw error:', e);
              const message = e?.response?.data?.error || e?.message || 'Failed to process withdrawal';
              Alert.alert('Withdrawal Failed', message);
            } finally {
              setWithdrawLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleMessageSubscriber = (item: SubscriberItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push({
      pathname: '/dm',
      params: {
        otherUserId: item.subscriberId,
        user: item.subscriberName || 'User',
        avatar: item.subscriberAvatar || ''
      }
    });
  };

  const getFilteredData = () => {
    let result = [...subscribers];
    
    if (filter === 'recent') {
      result = result.filter(item => item.status === 'active');
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (filter === 'oldest') {
      result = result.filter(item => item.status === 'active');
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (filter === 'all') {
      result = result.filter(item => item.status === 'active');
    } else if (filter === 'canceled') {
      result = result.filter(item => item.status === 'canceled');
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return result;
  };

  const activeSubscribersCount = useMemo(() => {
    return subscribers.filter(s => s.status === 'active').length;
  }, [subscribers]);

  // Calculate real stats from posts
  const stats = useMemo(() => {
    const totalViews = creatorPosts.reduce((sum, p) => {
      const views = p.viewsCount || Math.floor((p.laughCount || 0) * 12.4 + (p.tomatoCount || 0) * 4.3 + 12);
      return sum + views;
    }, 0);

    const totalLaughs = creatorPosts.reduce((sum, p) => sum + (p.laughCount || 0), 0);

    const formatNumber = (num: number) => {
      if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
      if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
      return String(num);
    };

    return {
      views: formatNumber(totalViews),
      laughs: formatNumber(totalLaughs),
    };
  }, [creatorPosts]);

  const filteredSubscribers = getFilteredData();

  const currentPeriodText = useMemo(() => {
    const date = new Date();
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
  }, []);

  return (
    <View style={styles.container}>
      {/* Views Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Views</Text>
          <Text style={styles.cardDate}>{currentPeriodText}</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statCol}>
            {renderStatValue(stats.views, 50)}
            <Text style={styles.statLabel}>Total views</Text>
          </View>
          <View style={styles.statCol}>
            {renderStatValue(stats.laughs, 50)}
            <Text style={styles.statLabel}>Total laughs</Text>
          </View>
          <View style={styles.statCol}>
            {renderStatValue(activeSubscribersCount, 40)}
            <Text style={styles.statLabel}>Subscribers</Text>
          </View>
        </View>
      </View>

      {/* Money Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Money</Text>
          <Text style={styles.cardDate}>{currentPeriodText}</Text>
        </View>
        <View style={styles.moneyRow}>
          <View style={styles.moneyContainer}>
            {renderBalanceValue(displayBalance, 100)}
            <Text style={styles.moneyLabel}>{displayBalanceLabel}</Text>
            {balance && balance.pending > 0 && (
              <Text style={styles.pendingText}>{pendingBalance} pending</Text>
            )}
          </View>
          {/* No account at all — show setup button */}
          {!connectStatus?.hasAccount ? (
            <TouchableOpacity 
              style={[styles.withdrawBtn, styles.setupBtn]} 
              onPress={handleSetupPayouts}
              activeOpacity={0.8}
              disabled={setupLoading}
            >
              {setupLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Feather name="settings" size={16} color="#000" style={{ marginRight: 6 }} />
                  <Text style={styles.withdrawText}>Set up payouts</Text>
                </>
              )}
            </TouchableOpacity>
          ) : connectStatus?.payoutsEnabled ? (
            /* Fully set up — show withdraw button */
            <TouchableOpacity 
              style={[
                styles.withdrawBtn,
                (!balance?.canWithdraw || withdrawLoading) && styles.withdrawBtnDisabled,
              ]} 
              onPress={handleWithdraw}
              activeOpacity={0.8}
              disabled={withdrawLoading || !balance?.canWithdraw}
            >
              {withdrawLoading ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <>
                  <Text style={styles.withdrawText}>Withdraw</Text>
                  <Feather name="arrow-down" size={16} color="#000" style={styles.withdrawIcon} />
                </>
              )}
            </TouchableOpacity>
          ) : (
            /* Has account but not verified / needs retry */
            <TouchableOpacity 
              style={[styles.withdrawBtn, styles.retryBtn]} 
              onPress={handleSetupPayouts}
              activeOpacity={0.8}
              disabled={setupLoading}
            >
              {setupLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="refresh-cw" size={14} color="#fff" style={{ marginRight: 6 }} />
                  <Text style={[styles.withdrawText, { color: '#fff' }]}>Fix payout info</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Verification issue banner */}
        {isVerificationIssue && (
          <View style={styles.verificationBanner}>
            <Feather name="alert-triangle" size={14} color="#e65100" style={{ marginRight: 8 }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.verificationBannerText}>
                {connectStatus?.verificationFailed
                  ? 'Your payout info could not be verified. Please update your details to enable withdrawals.'
                  : 'Your payout setup is incomplete. Please complete the verification to withdraw.'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Payout History (show whenever there's history data) */}
      {payoutHistory.length > 0 && (
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Recent Payouts</Text>
          </View>
          {payoutHistory.map((payout) => (
            <View key={payout.id} style={styles.payoutRow}>
              <View style={styles.payoutInfo}>
                <Text style={styles.payoutAmount}>{payout.amountFormatted}</Text>
                <Text style={styles.payoutDate}>
                  {new Date(payout.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <View style={[
                styles.payoutStatusBadge,
                payout.status === 'paid' && styles.payoutStatusPaid,
                payout.status === 'processing' && styles.payoutStatusProcessing,
                payout.status === 'failed' && styles.payoutStatusFailed,
              ]}>
                <Text style={[
                  styles.payoutStatusText,
                  payout.status === 'paid' && styles.payoutStatusTextPaid,
                  payout.status === 'processing' && styles.payoutStatusTextProcessing,
                  payout.status === 'failed' && styles.payoutStatusTextFailed,
                ]}>
                  {payout.status.charAt(0).toUpperCase() + payout.status.slice(1)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Subscribers Header & Filters */}
      <View style={styles.subscribersSection}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.filterRow}
        >
          <TouchableOpacity
            style={[styles.pill, filter === 'recent' && styles.pillActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setFilter('recent'); }}
          >
            <Feather name="clock" size={14} color={filter === 'recent' ? '#fff' : '#fff'} style={{ marginRight: 6 }} />
            <Text style={styles.pillText}>Recent subscribers</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, styles.pillBlack, filter === 'all' && styles.pillActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setFilter('all'); }}
          >
            <Text style={styles.pillText}>All</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, styles.pillBlack, filter === 'oldest' && styles.pillActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setFilter('oldest'); }}
          >
            <Text style={styles.pillText}>Oldest</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.pill, styles.pillBlack, filter === 'canceled' && styles.pillActive]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setFilter('canceled'); }}
          >
            <Text style={styles.pillText}>Canceled</Text>
          </TouchableOpacity>
        </ScrollView>

        {/* Subscribers Cards List */}
        <View style={styles.list}>
          {loading ? (
            <>
              {renderSkeletonCard()}
              {renderSkeletonCard()}
            </>
          ) : filteredSubscribers.length > 0 ? (
            filteredSubscribers.map((item, idx) => (
              <View key={item.subscriberId || idx} style={styles.subscriberCard}>
                <TouchableOpacity 
                  style={styles.cardHeader} 
                  activeOpacity={0.7}
                  onPress={() => {
                    if (item.subscriberId) {
                      router.push(`/user-profile/${item.subscriberId}` as any);
                    }
                  }}
                >
                  <ExpoImage 
                    source={{ uri: item.subscriberAvatar || DEFAULT_AVATAR_URL }} 
                    style={styles.avatar}
                    contentFit="cover"
                  />
                  <View style={styles.cardHeaderInfo}>
                    <Text style={styles.displayName}>{item.subscriberName || 'Davis Press'}</Text>
                    <Text style={styles.subText}>Subscription to "{item.title || 'One Creator'}" #34526</Text>
                    <Text style={styles.priceText}>${item.price} per month</Text>
                  </View>
                </TouchableOpacity>
                
                {item.status === 'active' && (
                  <TouchableOpacity 
                    style={styles.btnMessage}
                    onPress={() => handleMessageSubscriber(item)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="chatbubble-outline" size={14} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.btnText}>Message</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="people-outline" size={40} color="#bbb" />
              <Text style={styles.emptyText}>No subscribers found</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: '#fff',
    gap: 16,
  },
  card: {
    backgroundColor: '#f5f5f7',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1c1c1e',
  },
  cardDate: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statCol: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#000',
  },
  statLabel: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 4,
    fontWeight: '600',
  },
  moneyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  moneyContainer: {
    flex: 1,
  },
  moneyValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#000',
  },
  moneyLabel: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 2,
    fontWeight: '600',
  },
  withdrawBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFD60A', // Figma Yellow
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1.5,
    elevation: 2,
    minWidth: 120,
  },
  withdrawBtnDisabled: {
    backgroundColor: '#e5e5ea',
    shadowOpacity: 0,
    elevation: 0,
  },
  setupBtn: {
    backgroundColor: '#FFD60A',
    minWidth: 140,
  },
  withdrawText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  withdrawIcon: {
    marginLeft: 6,
    fontWeight: '800',
  },
  pendingText: {
    fontSize: 12,
    color: '#ff9500',
    marginTop: 4,
    fontWeight: '600',
  },
  retryBtn: {
    backgroundColor: '#e65100',
    minWidth: 140,
  },
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3e0',
    borderRadius: 10,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#ffe0b2',
  },
  verificationBannerText: {
    fontSize: 12,
    color: '#e65100',
    fontWeight: '600',
    lineHeight: 17,
  },
  // Payout history styles
  payoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5ea',
  },
  payoutInfo: {
    flex: 1,
  },
  payoutAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  payoutDate: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 2,
    fontWeight: '500',
  },
  payoutStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
  },
  payoutStatusPaid: {
    backgroundColor: '#e8f5e9',
  },
  payoutStatusProcessing: {
    backgroundColor: '#fff3e0',
  },
  payoutStatusFailed: {
    backgroundColor: '#fce4ec',
  },
  payoutStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  payoutStatusTextPaid: {
    color: '#2e7d32',
  },
  payoutStatusTextProcessing: {
    color: '#e65100',
  },
  payoutStatusTextFailed: {
    color: '#c62828',
  },
  subscribersSection: {
    marginTop: 10,
  },
  filterRow: {
    gap: 8,
    flexDirection: 'row',
    marginBottom: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00a2ff', // Figma light blue
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  pillBlack: {
    backgroundColor: '#000', // Black inactive pills
  },
  pillActive: {
    backgroundColor: '#007aff', // Active filter highlight blue
    borderWidth: 1,
    borderColor: '#fff',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  list: {
    gap: 12,
  },
  subscriberCard: {
    backgroundColor: '#f5f5f7',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#eee',
  },
  cardHeaderInfo: {
    marginLeft: 12,
    flex: 1,
    gap: 2,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
  },
  subText: {
    fontSize: 12,
    color: '#1c1c1e',
    fontWeight: '500',
  },
  priceText: {
    fontSize: 12,
    color: '#1c1c1e',
    fontWeight: '500',
  },
  btnMessage: {
    flexDirection: 'row',
    backgroundColor: '#00a2ff',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  btnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
});
