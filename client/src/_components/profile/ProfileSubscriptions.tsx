import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@/lib/storage';
import { apiService } from '@/src/_services/apiService';
import { DEFAULT_AVATAR_URL } from '@/lib/api';

interface ProfileSubscriptionsProps {
  currentUserId: string | null;
}

interface SubscriptionItem {
  creatorId: string;
  title: string;
  price: string;
  subscribedAt: number;
  status: 'active' | 'canceled';
  canceledAt?: number;
  displayName?: string;
  avatar?: string;
  username?: string;
}

export const ProfileSubscriptions: React.FC<ProfileSubscriptionsProps> = ({ currentUserId }) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'recent' | 'all' | 'oldest' | 'canceled'>('recent');
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>([]);

  // Seed interactive initial local data if none exists
  const checkAndSeed = async (uid: string) => {
    // Ensure creator tier definitions exist for seeds first
    try {
      const hasDavisTier = await AsyncStorage.getItem('sub_tier_davis_press_id');
      if (!hasDavisTier) {
        await Promise.all([
          AsyncStorage.setItem('sub_tier_davis_press_id', JSON.stringify({
            title: 'One Creator',
            description: 'Exclusive subscriber-only videos and feed content',
            price: '10',
            createGroupChat: true,
            included: ['Access videos 48H before everyone else', 'Behind the scenes footage']
          })),
          AsyncStorage.setItem('sub_tier_paul_zuak_id', JSON.stringify({
            title: 'Entry level',
            description: 'Support my comedy and unlock reels',
            price: '5',
            createGroupChat: false,
            included: ['Access videos 48H before everyone else']
          })),
          AsyncStorage.setItem('sub_tier_nolan22_id', JSON.stringify({
            title: 'Premium Pack',
            description: 'Unlock everything + direct DM access',
            price: '15',
            createGroupChat: true,
            included: ['Access videos 48H before everyone else', 'Direct message access', 'Monthly subscriber chat']
          }))
        ]);
      }
    } catch (e) {
      console.warn('[ProfileSubscriptions] Tier seeding error:', e);
    }

    const SEED_KEY = `sub_seeded_for_${uid}`;
    try {
      const isSeeded = await AsyncStorage.getItem(SEED_KEY);
      if (isSeeded === 'true') return;

      const davisSubKey = `sub_subscribed_${uid}_to_davis_press_id`;
      const davisMetaKey = `sub_meta_${uid}_to_davis_press_id`;
      const paulSubKey = `sub_subscribed_${uid}_to_paul_zuak_id`;
      const paulMetaKey = `sub_meta_${uid}_to_paul_zuak_id`;

      const davisToMeSubKey = `sub_subscribed_davis_press_id_to_${uid}`;
      const davisToMeMetaKey = `sub_meta_davis_press_id_to_${uid}`;
      const nolanToMeSubKey = `sub_subscribed_nolan22_id_to_${uid}`;
      const nolanToMeMetaKey = `sub_meta_nolan22_id_to_${uid}`;

      await Promise.all([
        AsyncStorage.setItem(davisSubKey, 'true'),
        AsyncStorage.setItem(davisMetaKey, JSON.stringify({
          creatorId: 'davis_press_id',
          title: 'One Creator',
          price: '10',
          subscribedAt: Date.now() - 1000 * 60 * 60 * 24 * 3, // 3 days ago
          status: 'active'
        })),
        AsyncStorage.setItem(paulSubKey, 'true'),
        AsyncStorage.setItem(paulMetaKey, JSON.stringify({
          creatorId: 'paul_zuak_id',
          title: 'Entry level',
          price: '5',
          subscribedAt: Date.now() - 1000 * 60 * 60 * 24 * 10, // 10 days ago
          status: 'active'
        })),
        AsyncStorage.setItem(davisToMeSubKey, 'true'),
        AsyncStorage.setItem(davisToMeMetaKey, JSON.stringify({
          creatorId: uid,
          title: 'One Creator',
          price: '10',
          subscribedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
          status: 'active',
          subscriberId: 'davis_press_id',
          subscriberName: 'Davis Press',
          subscriberAvatar: 'https://i.pravatar.cc/150?img=33'
        })),
        AsyncStorage.setItem(nolanToMeSubKey, 'true'),
        AsyncStorage.setItem(nolanToMeMetaKey, JSON.stringify({
          creatorId: uid,
          title: 'One Creator',
          price: '10',
          subscribedAt: Date.now() - 1000 * 60 * 60 * 24 * 1,
          status: 'active',
          subscriberId: 'nolan22_id',
          subscriberName: 'Nolan22',
          subscriberAvatar: 'https://i.pravatar.cc/150?img=60'
        })),
        AsyncStorage.setItem(SEED_KEY, 'true')
      ]);
    } catch (e) {
      console.warn('[ProfileSubscriptions] Seeding error:', e);
    }
  };

  const loadSubscriptions = async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      await checkAndSeed(currentUserId);
      const keys = await AsyncStorage.getAllKeys();
      const metaPrefix = `sub_meta_${currentUserId}_to_`;
      const matchedKeys = keys.filter(k => k.startsWith(metaPrefix));

      if (matchedKeys.length === 0) {
        setSubscriptions([]);
        setLoading(false);
        return;
      }

      const values = await AsyncStorage.multiGet(matchedKeys);
      const items: SubscriptionItem[] = [];

      for (const [key, val] of values) {
        if (!val) continue;
        try {
          const item = JSON.parse(val) as SubscriptionItem;
          // Load display details from API or mock fallbacks
          if (item.creatorId === 'davis_press_id') {
            item.displayName = 'Davis Press';
            item.avatar = 'https://i.pravatar.cc/150?img=33';
            item.username = 'davis_press';
          } else if (item.creatorId === 'paul_zuak_id') {
            item.displayName = 'Paul Zuak';
            item.avatar = 'https://i.pravatar.cc/150?img=12';
            item.username = 'paul_zuak';
          } else if (item.creatorId === 'nolan22_id') {
            item.displayName = 'Nolan22';
            item.avatar = 'https://i.pravatar.cc/150?img=60';
            item.username = 'nolan22';
          } else {
            // Fetch real user info from backend
            try {
              const res = await apiService.getUser(item.creatorId);
              if (res?.success && res?.data) {
                item.displayName = res.data.displayName || res.data.name || 'User';
                item.avatar = res.data.avatar || res.data.photoURL || '';
                item.username = res.data.username || 'user';
              }
            } catch (err) {
              item.displayName = 'Creator';
            }
          }
          items.push(item);
        } catch (e) {}
      }

      setSubscriptions(items);
    } catch (e) {
      console.warn('[ProfileSubscriptions] Error loading:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscriptions();
  }, [currentUserId]);

  const handleCancelSub = async (item: SubscriptionItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert(
      'Cancel Subscription',
      `Are you sure you want to cancel your subscription to ${item.displayName || 'this creator'}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const subKey = `sub_subscribed_${currentUserId}_to_${item.creatorId}`;
              const metaKey = `sub_meta_${currentUserId}_to_${item.creatorId}`;

              await AsyncStorage.removeItem(subKey);
              
              // Update status in metadata
              const updated = {
                ...item,
                status: 'canceled' as const,
                canceledAt: Date.now()
              };
              await AsyncStorage.setItem(metaKey, JSON.stringify(updated));
              
              Alert.alert('Canceled', 'Subscription canceled successfully.');
              loadSubscriptions();
            } catch (err) {
              Alert.alert('Error', 'Failed to cancel subscription.');
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
      result = result.filter(item => item.status === 'active');
      result.sort((a, b) => b.subscribedAt - a.subscribedAt);
    } else if (filter === 'oldest') {
      result = result.filter(item => item.status === 'active');
      result.sort((a, b) => a.subscribedAt - b.subscribedAt);
    } else if (filter === 'all') {
      result = result.filter(item => item.status === 'active');
    } else if (filter === 'canceled') {
      result = result.filter(item => item.status === 'canceled');
      result.sort((a, b) => (b.canceledAt || 0) - (a.canceledAt || 0));
    }
    return result;
  };

  const filteredItems = getFilteredData();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="small" color="#007aff" />
      </View>
    );
  }

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
          <Feather name="clock" size={14} color={filter === 'recent' ? '#fff' : '#fff'} style={{ marginRight: 6 }} />
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
        {filteredItems.length > 0 ? (
          filteredItems.map((item, idx) => (
            <View key={item.creatorId || idx} style={styles.card}>
              <View style={styles.cardHeader}>
                <ExpoImage 
                  source={{ uri: item.avatar || DEFAULT_AVATAR_URL }} 
                  style={styles.avatar}
                  contentFit="cover"
                />
                <View style={styles.cardHeaderInfo}>
                  <Text style={styles.displayName}>{item.displayName || 'Davis Press'}</Text>
                  <Text style={styles.subText}>Subscribed to "{item.title}"</Text>
                  <Text style={styles.priceText}>${item.price} per month</Text>
                </View>
              </View>
              
              <View style={styles.actions}>
                <TouchableOpacity 
                  style={styles.btnSeeProfile}
                  onPress={() => handleSeeProfile(item.creatorId)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.btnText}>See profile</Text>
                </TouchableOpacity>

                {item.status === 'active' && (
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
            <Ionicons name="star-outline" size={40} color="#bbb" />
            <Text style={styles.emptyText}>No subscriptions found</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
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
    paddingHorizontal: 16,
    gap: 12,
  },
  card: {
    backgroundColor: '#f5f5f7',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e5ea',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: 13,
    color: '#1c1c1e',
    fontWeight: '500',
  },
  priceText: {
    fontSize: 13,
    color: '#1c1c1e',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 10,
  },
  btnSeeProfile: {
    backgroundColor: '#00a2ff',
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#FF5A1F', // Orange Cancel btn
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
