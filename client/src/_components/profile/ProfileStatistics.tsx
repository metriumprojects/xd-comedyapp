import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@/lib/storage';
import { apiService } from '@/src/_services/apiService';
import { DEFAULT_AVATAR_URL } from '@/lib/api';

interface ProfileStatisticsProps {
  creatorPosts?: any[];
  currentUserId?: string | null;
}

interface SubscriberItem {
  creatorId: string;
  title: string;
  price: string;
  subscribedAt: number;
  status: 'active' | 'canceled';
  canceledAt?: number;
  subscriberId: string;
  subscriberName?: string;
  subscriberAvatar?: string;
  subscriberUsername?: string;
}

export const ProfileStatistics: React.FC<ProfileStatisticsProps> = ({
  creatorPosts = [],
  currentUserId = null,
}) => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'recent' | 'all' | 'oldest' | 'canceled'>('recent');
  const [subscribers, setSubscribers] = useState<SubscriberItem[]>([]);

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
      console.warn('[ProfileStatistics] Tier seeding error:', e);
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
      console.warn('[ProfileStatistics] Seeding error:', e);
    }
  };

  const loadSubscribers = async () => {
    if (!currentUserId) return;
    setLoading(true);
    try {
      await checkAndSeed(currentUserId);
      const keys = await AsyncStorage.getAllKeys();
      
      // Find keys where another user is subscribed to currentUserId
      const suffix = `_to_${currentUserId}`;
      const matchedKeys = keys.filter(k => k.startsWith('sub_meta_') && k.endsWith(suffix));

      if (matchedKeys.length === 0) {
        setSubscribers([]);
        setLoading(false);
        return;
      }

      const values = await AsyncStorage.multiGet(matchedKeys);
      const items: SubscriberItem[] = [];

      for (const [key, val] of values) {
        if (!val) continue;
        try {
          const item = JSON.parse(val) as SubscriberItem;
          // Load subscriber details from API or mock fallbacks
          if (item.subscriberId === 'davis_press_id') {
            item.subscriberName = 'Davis Press';
            item.subscriberAvatar = 'https://i.pravatar.cc/150?img=33';
            item.subscriberUsername = 'davis_press';
          } else if (item.subscriberId === 'nolan22_id') {
            item.subscriberName = 'Nolan22';
            item.subscriberAvatar = 'https://i.pravatar.cc/150?img=60';
            item.subscriberUsername = 'nolan22';
          } else {
            // Fetch real user info from backend
            try {
              const res = await apiService.getUser(item.subscriberId);
              if (res?.success && res?.data) {
                item.subscriberName = res.data.displayName || res.data.name || 'User';
                item.subscriberAvatar = res.data.avatar || res.data.photoURL || '';
                item.subscriberUsername = res.data.username || 'user';
              }
            } catch (err) {
              item.subscriberName = 'Subscriber';
            }
          }
          items.push(item);
        } catch (e) {}
      }

      setSubscribers(items);
    } catch (e) {
      console.warn('[ProfileStatistics] Error loading subscribers:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubscribers();
  }, [currentUserId]);

  const handleWithdraw = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Alert.alert('Withdrawal Request', 'Your withdrawal request of $1215 has been successfully initiated.');
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

  return (
    <View style={styles.container}>
      {/* Views Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Views</Text>
          <Text style={styles.cardDate}>Mar - Jan 2022</Text>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{stats.views}</Text>
            <Text style={styles.statLabel}>Total views</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{stats.laughs}</Text>
            <Text style={styles.statLabel}>Total laughs</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={styles.statValue}>{activeSubscribersCount}</Text>
            <Text style={styles.statLabel}>Subscribers</Text>
          </View>
        </View>
      </View>

      {/* Money Card */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Money</Text>
          <Text style={styles.cardDate}>Mar - Jan 2022</Text>
        </View>
        <View style={styles.moneyRow}>
          <View style={styles.moneyContainer}>
            <Text style={styles.moneyValue}>$1215</Text>
            <Text style={styles.moneyLabel}>Balance available</Text>
          </View>
          <TouchableOpacity 
            style={styles.withdrawBtn} 
            onPress={handleWithdraw}
            activeOpacity={0.8}
          >
            <Text style={styles.withdrawText}>Withdraw</Text>
            <Feather name="arrow-down" size={16} color="#000" style={styles.withdrawIcon} />
          </TouchableOpacity>
        </View>
      </View>

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
            <ActivityIndicator size="small" color="#007aff" style={{ padding: 20 }} />
          ) : filteredSubscribers.length > 0 ? (
            filteredSubscribers.map((item, idx) => (
              <View key={item.subscriberId || idx} style={styles.subscriberCard}>
                <View style={styles.cardHeader}>
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
                </View>
                
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
