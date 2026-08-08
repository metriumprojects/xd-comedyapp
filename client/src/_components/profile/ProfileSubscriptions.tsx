import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Animated } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { DEFAULT_AVATAR_URL } from '@/lib/api';
import { subscriptionService, SubscriptionRecord } from '@/src/_services/subscriptionService';
import COLORS from '@/src/theme/colors';

interface ProfileSubscriptionsProps {
  currentUserId: string | null;
}

export const ProfileSubscriptions: React.FC<ProfileSubscriptionsProps> = ({ currentUserId }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'recent' | 'all' | 'oldest' | 'canceled'>('recent');
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);

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
    setSubscriptions([]);
    setLoading(true);
  }, [currentUserId]);

  const renderSkeletonCard = () => {
    return (
      <Animated.View style={[styles.card, { opacity: skeletonOpacity }]}>
        <View style={styles.cardHeader}>
          <View style={[styles.avatar, { backgroundColor: COLORS.border }]} />
          <View style={styles.cardHeaderInfo}>
            <View style={{ width: 120, height: 16, backgroundColor: COLORS.border, borderRadius: 4, marginBottom: 6 }} />
            <View style={{ width: 180, height: 12, backgroundColor: COLORS.border, borderRadius: 4, marginBottom: 4 }} />
            <View style={{ width: 80, height: 12, backgroundColor: COLORS.border, borderRadius: 4 }} />
          </View>
        </View>
        <View style={styles.actions}>
          <View style={[styles.btnSeeProfile, { backgroundColor: COLORS.border, width: 90 }]}>
            <View style={{ width: 60, height: 12, backgroundColor: '#d1d1d6', borderRadius: 4 }} />
          </View>
          <View style={[styles.btnCancel, { backgroundColor: COLORS.border, width: 130 }]}>
            <View style={{ width: 100, height: 12, backgroundColor: '#d1d1d6', borderRadius: 4 }} />
          </View>
        </View>
      </Animated.View>
    );
  };

  const loadSubscriptions = useCallback(async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      const response = await subscriptionService.getMySubscriptions();
      if (response.success && Array.isArray(response.data)) {
        setSubscriptions(response.data);
      } else {
        setSubscriptions([]);
      }
    } catch (e) {
      console.warn('[ProfileSubscriptions] Error loading:', e);
      setSubscriptions([]);
    } finally {
      setLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  const handleCancelSub = async (item: SubscriptionRecord) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(
      'Cancel Subscription',
      `Are you sure you want to cancel your subscription to ${item.creator?.displayName || 'this creator'}? You'll keep access until the end of your billing period.`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await subscriptionService.cancelSubscription(item.id);
              if (result.success) {
                Alert.alert('Canceled', 'Subscription will end at the end of your billing period.');
                loadSubscriptions();
              } else {
                Alert.alert('Error', 'Failed to cancel subscription.');
              }
            } catch (err: any) {
              Alert.alert('Error', err?.response?.data?.error || 'Failed to cancel subscription.');
            }
          }
        }
      ]
    );
  };

  const handleSeeProfile = (creatorId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push(`/user-profile?uid=${creatorId}`);
  };

  const getFilteredData = () => {
    let result = [...subscriptions];
    
    if (filter === 'recent') {
      result = result.filter(item => item.status === 'active' || item.status === 'trialing');
      result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (filter === 'oldest') {
      result = result.filter(item => item.status === 'active' || item.status === 'trialing');
      result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    } else if (filter === 'all') {
      result = result.filter(item => item.status === 'active' || item.status === 'trialing');
    } else if (filter === 'canceled') {
      result = result.filter(item => item.cancelAtPeriodEnd || item.status === 'past_due');
    }
    return result;
  };

  const filteredItems = getFilteredData();

  return (
    <View style={styles.container}>
      {/* Horizontal filter pills */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false} 
        contentContainerStyle={styles.filterRow}
      >
        <TouchableOpacity
          style={[styles.pill, filter === 'recent' && styles.pillActive]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); setFilter('recent'); }}
        >
          <Feather name="clock" size={14} color={filter === 'recent' ? COLORS.textLight : COLORS.textLight} style={{ marginRight: 6 }} />
          <Text style={styles.pillText}>Recent subscription</Text>
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

      {/* Subscription Cards List */}
      <View style={styles.list}>
        {loading ? (
          <>
            {renderSkeletonCard()}
            {renderSkeletonCard()}
          </>
        ) : filteredItems.length > 0 ? (
          filteredItems.map((item, idx) => (
            <View key={item.id || idx} style={styles.card}>
              <View style={styles.cardHeader}>
                <ExpoImage 
                  source={{ uri: item.creator?.avatar || DEFAULT_AVATAR_URL }} 
                  style={styles.avatar}
                  contentFit="cover"
                />
                <View style={styles.cardHeaderInfo}>
                  <Text style={styles.displayName}>{item.creator?.displayName || 'Creator'}</Text>
                  <Text style={styles.subText}>Subscribed to "{item.tier?.title || 'Subscription'}"</Text>
                  <Text style={styles.priceText}>${item.tier?.price || '0'} per month</Text>
                  {item.cancelAtPeriodEnd && item.currentPeriodEnd && (
                    <Text style={styles.cancelText}>
                      Ends {new Date(item.currentPeriodEnd).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </View>
              
              <View style={styles.actions}>
                <TouchableOpacity 
                  style={styles.btnSeeProfile}
                  onPress={() => item.creator?.id && handleSeeProfile(item.creator.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnText}>See profile</Text>
                </TouchableOpacity>

                {(item.status === 'active' || item.status === 'trialing') && !item.cancelAtPeriodEnd && (
                  <TouchableOpacity 
                    style={styles.btnCancel}
                    onPress={() => handleCancelSub(item)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.btnText}>Cancel subscription</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="star-outline" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No subscriptions found</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.background,
    paddingTop: 10,
    paddingBottom: 20,
  },
  center: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterRow: {
    paddingHorizontal: 16,
    gap: 8,
    flexDirection: 'row',
    marginBottom: 16,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.info, // Figma light blue
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  pillBlack: {
    backgroundColor: COLORS.black, // Black inactive pills
  },
  pillActive: {
    backgroundColor: COLORS.info, // Active filter highlight blue
    borderWidth: 1,
    borderColor: COLORS.textLight,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textLight,
  },
  list: {
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.border,
  },
  cardHeaderInfo: {
    marginLeft: 12,
    flex: 1,
    gap: 2,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.black,
  },
  subText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  priceText: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  cancelText: {
    fontSize: 12,
    color: COLORS.danger,
    fontWeight: '600',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  btnSeeProfile: {
    backgroundColor: COLORS.info,
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: COLORS.accent, // Orange Cancel btn
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnText: {
    color: COLORS.textLight,
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
    color: COLORS.textMuted,
    fontWeight: '600',
  },
});
