import { DEFAULT_AVATAR_URL } from '../lib/api';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React from 'react';
import { Image as ExpoImage } from 'expo-image';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@/lib/storage';
import { useNotifications } from '../hooks/useNotifications';
import AcceptDeclineButtons from '@/src/_components/AcceptDeclineButtons';
import { getNotificationActionText } from '../lib/notificationText';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { safeRouterBack } from '@/lib/safeRouterBack';
import COLORS from '@/src/theme/colors';

export default function NotificationsScreen() {
  const router = useRouter();
  const [userId, setUserId] = React.useState<string>('');

  const { notifications, unreadCount, loading, fetchNotifications, markAllAsRead, deleteAllNotifications } = useNotifications(userId || '');

  React.useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const uid = await AsyncStorage.getItem('userId');
        if (isMounted && uid) setUserId(String(uid));
      } catch {}
    })();
    return () => { isMounted = false; };
  }, []);

  // Refresh notifications when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      fetchNotifications();
      // Screen open = treat as read
      markAllAsRead();
    }, [])
  );

  function getNotificationIcon(type: string) {
    const t = String(type || '').toLowerCase().replace(/_/g, '-');
    switch (t) {
      case 'like':
      case 'post-like':
      case 'story-like':
      case 'comment-like':
        return 'heart';
      case 'comment':
      case 'post-comment':
      case 'story-reply':
      case 'story-comment':
        return 'message-circle';
      case 'comment-reply':
        return 'corner-down-right';
      case 'follow':
      case 'follow-request':
      case 'new-follower':
        return 'user-plus';
      case 'follow-approved':
        return 'user-check';
      case 'mention':
      case 'post-mention':
        return 'at-sign';
      case 'dm':
      case 'message':
        return 'send';
      case 'story-mention':
        return 'star';
      case 'story':
      case 'new-story':
        return 'film';
      case 'tag':
      case 'post-tag':
        return 'tag';
      case 'live':
      case 'livestream':
        return 'radio';
      default:
        return 'bell';
    }
  }

  function getNotificationColor(type: string) {
    const t = String(type || '').toLowerCase().replace(/_/g, '-');
    switch (t) {
      case 'like':
      case 'post-like':
      case 'story-like':
      case 'comment-like':
      case 'follow':
      case 'follow-request':
      case 'new-follower':
      case 'tag':
      case 'post-tag':
      case 'story-mention':
        return '#FF6B00';
      case 'comment':
      case 'post-comment':
      case 'comment-reply':
      case 'story-reply':
      case 'story-comment':
      case 'follow-approved':
      case 'dm':
      case 'message':
      case 'story':
      case 'new-story':
        return COLORS.info;
      case 'mention':
      case 'post-mention':
        return '#8b5cf6';
      case 'live':
      case 'livestream':
        return COLORS.danger;
      default:
        return COLORS.textSecondary;
    }
  }

  function formatTime(timestamp: any) {
    if (!timestamp) return '';
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      date = timestamp;
    }
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff/60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff/3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff/86400)}d ago`;
    return date.toLocaleDateString();
  }

  function handleNotificationClick(item: any) {
    hapticLight();
    const type = String(item?.type || '').toLowerCase().replace(/_/g, '-');
    const senderId = String(item?.senderId || item?.fromUserId || item?.data?.senderId || '').trim();
    const postId = String(item?.postId || item?.data?.postId || '').trim();
    const commentId = String(item?.commentId || item?.data?.commentId || '').trim();

    let navRoute = '';
    if (type === 'follow' || type === 'follow-request' || type === 'follow-approved' || type === 'new-follower') {
      navRoute = senderId ? `/user-profile?id=${encodeURIComponent(senderId)}` : '/(tabs)/profile';
    } else if (type === 'like' || type === 'post-like' || type === 'tag' || type === 'post-tag' || type === 'mention' || type === 'post-mention') {
      if (postId) {
        navRoute = `/post-detail?id=${encodeURIComponent(postId)}`;
      } else if (senderId) {
        navRoute = `/user-profile?id=${encodeURIComponent(senderId)}`;
      } else {
        navRoute = '/(tabs)/home';
      }
    } else if (type === 'comment' || type === 'post-comment' || type === 'comment-reply' || type === 'comment-like') {
      if (postId) {
        navRoute = `/post-detail?id=${encodeURIComponent(postId)}&openComments=true&commentId=${encodeURIComponent(commentId)}`;
      } else if (senderId) {
        navRoute = `/user-profile?id=${encodeURIComponent(senderId)}`;
      } else {
        navRoute = '/(tabs)/home';
      }
    } else if (type === 'dm' || type === 'message') {
      navRoute = senderId ? `/dm?otherUserId=${encodeURIComponent(senderId)}` : '/inbox';
    } else if (type === 'live' || type === 'livestream') {
      navRoute = '/(tabs)/home';
    } else if (type === 'story' || type === 'story-like' || type === 'story-mention' || type === 'story-reply' || type === 'story-comment' || type === 'new-story') {
      if (senderId) {
        navRoute = `/user-profile?id=${encodeURIComponent(senderId)}&openStory=true${storyId ? '&storyId=' + encodeURIComponent(storyId) : ''}`;
      } else {
        navRoute = '/(tabs)/home';
      }
    } else {
      navRoute = senderId ? `/user-profile?id=${encodeURIComponent(senderId)}` : '/(tabs)/home';
    }
    router.push(navRoute as any);
  }

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}> 
        <View style={{ width: '100%', padding: 16 }}>
          {[1,2,3,4].map(i => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.border, marginRight: 8 }} />
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.border, marginRight: 14 }} />
              <View style={{ flex: 1 }}>
                <View style={{ width: '60%', height: 16, borderRadius: 6, backgroundColor: COLORS.border, marginBottom: 6 }} />
                <View style={{ width: '40%', height: 13, borderRadius: 6, backgroundColor: COLORS.border }} />
              </View>
            </View>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            safeRouterBack();
          }}
        >
          <Feather name="arrow-left" size={20} color={COLORS.info} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            router.push('/passport' as any);
          }}
        >
          <Feather name="briefcase" size={20} color={COLORS.black} />
        </TouchableOpacity>
      </View>

      {/* Bulk Actions */}
      <View style={{ flexDirection: 'row', gap: 12, margin: 12 }}>
        <TouchableOpacity
          style={{ backgroundColor: COLORS.info, padding: 8, borderRadius: 8 }}
          onPress={async () => {
            hapticMedium();
            try {
              await markAllAsRead();
            } catch (err) {
              alert('Error marking all as read');
            }
          }}
        >
          <Text style={{ color: COLORS.textLight, fontWeight: 'bold' }}>Mark All Read</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{ backgroundColor: COLORS.danger, padding: 8, borderRadius: 8 }}
          onPress={async () => {
            hapticMedium();
            try {
              await deleteAllNotifications();
            } catch (err) {
              alert('Error deleting all notifications');
            }
          }}
        >
          <Text style={{ color: COLORS.textLight, fontWeight: 'bold' }}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="bell-off" size={64} color={COLORS.border} />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n: any, index: number) => {
            const base = String(n?._id || n?.id || '');
            if (base) return base;
            const created = String(n?.createdAt || '');
            const sender = String(n?.senderId || n?.fromUserId || '');
            const type = String(n?.type || '');
            return `notif_${type}_${sender}_${created}_${index}`;
          }}
          initialNumToRender={15}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews={true}
          renderItem={({ item }) => (
            <View>
              <TouchableOpacity 
                style={[styles.nRow, !item.read && styles.nRowUnread]} 
                onPress={() => handleNotificationClick(item)}
              >
                <View style={[styles.iconContainer, { backgroundColor: getNotificationColor(item.type) + '15' }]}>
                  <Feather name={getNotificationIcon(item.type) as any} size={20} color={getNotificationColor(item.type)} />
                </View>
                <ExpoImage 
                  source={{ uri: item.senderAvatar && item.senderAvatar.trim() !== "" ? item.senderAvatar : DEFAULT_AVATAR_URL }} 
                  style={styles.nAvatar}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.nTitle}>
                    <Text style={{ fontWeight: '700', color: '#FF6B00' }}>{String(item?.senderName || 'Someone')}</Text>
                    <Text style={{ fontWeight: '400', color: COLORS.textSecondary }}> {getNotificationActionText(item)}</Text>
                  </Text>
                  <Text style={styles.nBody}>{formatTime(item.createdAt)}</Text>
                </View>
                {!item.read && <View style={styles.unreadDot} />}
              </TouchableOpacity>
              {/* Accept/Decline for follow-request notifications */}
              {item.type === 'follow-request' && (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginRight: 24, marginBottom: 8 }}>
                  <AcceptDeclineButtons item={item} onActionTaken={(id) => {
                    fetchNotifications();
                  }} />
                </View>
              )}
            </View>
          )}
          ItemSeparatorComponent={() => <View style={styles.nSep} />}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background 
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginTop: 8,
  },
  nRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: COLORS.background,
  },
  nRowUnread: {
    backgroundColor: '#f0f8ff',
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  nAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 14,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.info,
    marginLeft: 8,
  },
  nTitle: {
    fontSize: 15,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  nBody: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  nSep: {
    height: 1,
    backgroundColor: COLORS.inputBg,
    marginLeft: 74,
  },
});
