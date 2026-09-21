import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useState, useMemo } from 'react';
import { Image as ExpoImage } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SectionList, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@/lib/storage';
import { useNotifications } from '../hooks/useNotifications';
import AcceptDeclineButtons from '@/src/_components/AcceptDeclineButtons';
import { getNotificationActionText, getNotificationDisplayText, isSystemNotification } from '../lib/notificationText';
import { hapticLight, hapticMedium } from '@/lib/haptics';
import { safeRouterBack } from '@/lib/safeRouterBack';
import { showStoryUnavailableAlert } from '@/src/utils/storyAlerts';
import UserAvatar from '@/src/_components/UserAvatar';
import { resolveNotificationSender, warmNotificationAvatars } from '@/src/utils/notificationAvatar';
import { resolveAvatarUrl, isMissingOrDefaultAvatar } from '@/lib/utils/avatar';
import { cacheUserProfile } from '@/hooks/useUserProfile';
import { useReelsStore } from '@/store/useReelsStore';
import { getActiveStories } from '@/lib/firebaseHelpers/core';
import COLORS from '@/src/theme/colors';

function formatInstagramTime(dateInput: any): string {
  if (!dateInput) return 'now';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return 'now';
  const diffSec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diffSec < 60) return `${Math.max(1, diffSec)}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d`;
  const diffWeeks = Math.floor(diffDays / 7);
  return `${diffWeeks}w`;
}

/** Group notifications into Instagram-style chronological sections */
function groupNotificationsByDate(items: any[]): { title: string; data: any[] }[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - (24 * 60 * 60 * 1000);
  const startOfWeek = startOfToday - (6 * 24 * 60 * 60 * 1000); // 7-day window

  const groups: { [key: string]: any[] } = {
    'Today': [],
    'Yesterday': [],
    'This week': [],
    'Earlier': [],
  };

  for (const item of items) {
    const itemDate = item?.createdAt ? new Date(item.createdAt).getTime() : 0;
    if (itemDate >= startOfToday) {
      groups['Today'].push(item);
    } else if (itemDate >= startOfYesterday) {
      groups['Yesterday'].push(item);
    } else if (itemDate >= startOfWeek) {
      groups['This week'].push(item);
    } else {
      groups['Earlier'].push(item);
    }
  }

  const order = ['Today', 'Yesterday', 'This week', 'Earlier'];
  const result: { title: string; data: any[] }[] = [];

  for (const key of order) {
    if (groups[key].length > 0) {
      result.push({ title: key, data: groups[key] });
    }
  }

  return result;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');
  const [activeStoryMap, setActiveStoryMap] = useState<Map<string, string>>(new Map());

  const { notifications, loading, fetchNotifications, markAsRead, markAllAsRead, deleteAllNotifications } = useNotifications(userId || '');

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

  // Refresh notifications, pause reels, and fetch active stories
  useFocusEffect(
    React.useCallback(() => {
      useReelsStore.getState().setModalOpen(true);
      fetchNotifications();
      markAllAsRead();

      // Fetch live stories to ensure story rings ONLY appear if a user actually has an active story
      (async () => {
        try {
          const res = await getActiveStories();
          const stories = Array.isArray(res?.stories) ? res.stories : [];
          const map = new Map<string, string>();
          for (const s of stories) {
            const uid = String(s?.userId || s?.authorId || s?.uid || '').trim();
            const sid = String(s?._id || s?.id || s?.storyId || '').trim();
            const uname = String(s?.userName || s?.username || '').trim().toLowerCase();
            if (uid && sid && !map.has(uid)) {
              map.set(uid, sid);
            }
            if (uname && sid && !map.has(`name:${uname}`)) {
              map.set(`name:${uname}`, sid);
            }
          }
          setActiveStoryMap(map);
        } catch {}
      })();

      return () => {
        useReelsStore.getState().setModalOpen(false);
      };
    }, [])
  );

  // Pre-warm avatar cache on arrival
  React.useEffect(() => {
    if (Array.isArray(notifications) && notifications.length > 0) {
      warmNotificationAvatars(notifications);
    }
  }, [notifications]);

  const sections = useMemo(() => groupNotificationsByDate(notifications), [notifications]);

  function handleNotificationClick(item: any) {
    hapticLight();
    if (item?._id) {
      markAsRead(item._id).catch(() => {});
    }

    const isValidId = (s: any): boolean => {
      if (s == null) return false;
      const str = String(s).trim();
      return str !== '' && str !== 'undefined' && str !== 'null' && str !== '[object Object]' && str !== '0' && str !== 'false';
    };

    const type = String(item?.type || '').toLowerCase().trim().replace(/_/g, '-');
    const message = String(item?.message || '').toLowerCase();

    const rawStoryId = (
      item?.storyId ||
      item?.story?._id ||
      item?.story?.id ||
      item?.data?.storyId ||
      item?.data?.story?._id ||
      item?.data?.story?.id ||
      item?.metadata?.storyId ||
      item?.payload?.storyId ||
      ''
    );
    const resolvedStoryId = isValidId(rawStoryId) ? String(rawStoryId).trim() : '';

    const rawPostId = (
      item?.postId ||
      item?.post?._id ||
      item?.post?.id ||
      item?.data?.postId ||
      item?.data?.post_id ||
      item?.data?.sharePostId ||
      item?.sharePostId ||
      item?.targetId ||
      item?.entityId ||
      ''
    );
    const resolvedPostId = isValidId(rawPostId) ? String(rawPostId).trim() : '';

    const rawConversationId = (
      item?.conversationId ||
      item?.conversation_id ||
      item?.groupId ||
      item?.chatId ||
      item?.data?.conversationId ||
      item?.data?.conversation_id ||
      ''
    );
    const resolvedConversationId = isValidId(rawConversationId) ? String(rawConversationId).trim() : '';

    const resolved = resolveNotificationSender(item);
    const resolvedSenderId = isValidId(resolved.senderId) ? resolved.senderId : '';
    const resolvedSenderName = resolved.senderName;
    const resolvedSenderAvatar = isMissingOrDefaultAvatar(resolved.senderAvatar) ? '' : resolved.senderAvatar;

    if (resolvedSenderId && (resolvedSenderName || resolvedSenderAvatar)) {
      try {
        cacheUserProfile({
          uid: resolvedSenderId,
          displayName: resolvedSenderName,
          avatar: resolvedSenderAvatar || undefined,
        });
      } catch {}
    }

    // 1. Direct Message / Chat
    if (
      type === 'dm' ||
      type === 'message' ||
      type === 'chat' ||
      type === 'new-message' ||
      type === 'chat-message' ||
      type === 'group-message' ||
      type === 'conversation' ||
      message.includes('sent you a message')
    ) {
      if (resolvedConversationId || resolvedSenderId) {
        const qs = `conversationId=${encodeURIComponent(resolvedConversationId)}&otherUserId=${encodeURIComponent(resolvedSenderId)}&user=${encodeURIComponent(resolvedSenderName)}&avatar=${encodeURIComponent(resolvedSenderAvatar)}`;
        router.push(`/dm?${qs}` as any);
      } else {
        router.push('/inbox' as any);
      }
      return;
    }

    // 2. Post Shared to Story
    const isPostStoryShare = (
      type === 'post-story-share' ||
      type === 'poststoryshare' ||
      type === 'post-share-story' ||
      message.includes('shared your post to their story')
    );

    if (isPostStoryShare) {
      if (resolvedStoryId) {
        router.push(`/(tabs)/home?storyId=${encodeURIComponent(resolvedStoryId)}&authorId=${encodeURIComponent(resolvedSenderId)}&t=${Date.now()}` as any);
      } else if (resolvedPostId) {
        router.push(`/post-detail?id=${encodeURIComponent(resolvedPostId)}` as any);
      } else if (resolvedSenderId) {
        router.push(`/user-profile?id=${encodeURIComponent(resolvedSenderId)}` as any);
      } else {
        router.push('/(tabs)/home' as any);
      }
      return;
    }

    const hasConversation = Boolean(resolvedConversationId);

    // 3. Story Comment
    const isStoryCommentInteraction = (
      type === 'story-comment' ||
      type === 'storycomment' ||
      message.includes('commented on your story')
    );

    if (isStoryCommentInteraction) {
      if (resolvedStoryId) {
        router.push(`/(tabs)/home?storyId=${encodeURIComponent(resolvedStoryId)}&isOwnStory=true&openComments=true&t=${Date.now()}` as any);
      } else if (resolvedConversationId || resolvedSenderId) {
        const qs = `conversationId=${encodeURIComponent(resolvedConversationId)}&otherUserId=${encodeURIComponent(resolvedSenderId)}&user=${encodeURIComponent(resolvedSenderName)}&avatar=${encodeURIComponent(resolvedSenderAvatar)}`;
        router.push(`/dm?${qs}` as any);
      } else {
        showStoryUnavailableAlert();
      }
      return;
    }

    // 4. Story Reply
    const isStoryReplyInteraction = (
      type === 'story-reply' ||
      type === 'storyreply' ||
      (hasConversation && message.includes('replied'))
    );

    if (isStoryReplyInteraction) {
      if (resolvedStoryId) {
        router.push(`/(tabs)/home?storyId=${encodeURIComponent(resolvedStoryId)}&isOwnStory=true&openComments=true&t=${Date.now()}` as any);
      } else if (resolvedConversationId) {
        const qs = `conversationId=${encodeURIComponent(resolvedConversationId)}&otherUserId=${encodeURIComponent(resolvedSenderId)}&user=${encodeURIComponent(resolvedSenderName)}&avatar=${encodeURIComponent(resolvedSenderAvatar)}`;
        router.push(`/dm?${qs}` as any);
      } else {
        showStoryUnavailableAlert();
      }
      return;
    }

    // 5. Story Like
    const isStoryLikeInteraction = (
      type === 'story-like' ||
      type === 'storylike' ||
      message.includes('liked your story')
    );

    if (isStoryLikeInteraction) {
      if (resolvedStoryId) {
        router.push(`/(tabs)/home?storyId=${encodeURIComponent(resolvedStoryId)}&isOwnStory=true&openComments=true&t=${Date.now()}` as any);
      } else {
        showStoryUnavailableAlert();
      }
      return;
    }

    // 6. Other User's Story
    const isOtherStoryInteraction = (
      type === 'story' ||
      type === 'new-story' ||
      type === 'newstory' ||
      type === 'story-share' ||
      type === 'storyshare' ||
      type === 'story-mention' ||
      type === 'storymention' ||
      message.includes('posted a new story') ||
      message.includes('shared a new story') ||
      message.includes('mentioned you in a story') ||
      message.includes('shared your story') ||
      ((type.includes('story') || message.includes('story')) && !isStoryCommentInteraction && !isStoryReplyInteraction && !isStoryLikeInteraction && !isPostStoryShare)
    );

    if (isOtherStoryInteraction) {
      if (resolvedStoryId) {
        router.push(`/(tabs)/home?storyId=${encodeURIComponent(resolvedStoryId)}&authorId=${encodeURIComponent(resolvedSenderId)}&t=${Date.now()}` as any);
      } else if (resolvedSenderId) {
        router.push(`/(tabs)/home?authorId=${encodeURIComponent(resolvedSenderId)}&isAuthorLookup=true&t=${Date.now()}` as any);
      } else {
        showStoryUnavailableAlert();
      }
      return;
    }

    // 7. Post Comments
    if (
      type === 'comment' ||
      type === 'post-comment' ||
      type === 'postcomment' ||
      type === 'comment-like' ||
      type === 'commentlike' ||
      type === 'comment-reply' ||
      type === 'commentreply' ||
      type === 'replylike' ||
      type === 'reply-comment'
    ) {
      if (resolvedPostId) {
        const commentId = String(item?.commentId || item?.data?.commentId || '').trim();
        router.push(`/post-detail?id=${encodeURIComponent(resolvedPostId)}&openComments=true&commentId=${encodeURIComponent(commentId)}` as any);
      } else if (resolvedSenderId) {
        router.push(`/user-profile?id=${encodeURIComponent(resolvedSenderId)}` as any);
      } else {
        router.push('/(tabs)/home' as any);
      }
      return;
    }

    // 8. Post Likes, Laugh, Tomato, Shares, Mentions, Tags
    if (
      type === 'like' ||
      type === 'post-like' ||
      type === 'postlike' ||
      type === 'laugh' ||
      type === 'reaction-laugh' ||
      type === 'post-laugh' ||
      type === 'tomato' ||
      type === 'reaction-tomato' ||
      type === 'post-tomato' ||
      type === 'tag' ||
      type === 'post-tag' ||
      type === 'mention' ||
      type === 'post-mention' ||
      type === 'post-share' ||
      type === 'share'
    ) {
      if (resolvedPostId) {
        router.push(`/post-detail?id=${encodeURIComponent(resolvedPostId)}` as any);
      } else if (resolvedSenderId) {
        router.push(`/user-profile?id=${encodeURIComponent(resolvedSenderId)}` as any);
      } else {
        router.push('/(tabs)/home' as any);
      }
      return;
    }

    // 9. Podium
    if (type === 'podium' || type === 'podium-vote') {
      router.push('/podium' as any);
      return;
    }

    // 10. Follows
    if (type === 'follow' || type === 'follow-request' || type === 'follow-approved' || type === 'new-follower') {
      if (resolvedSenderId) router.push(`/user-profile?id=${encodeURIComponent(resolvedSenderId)}` as any);
      else router.push('/(tabs)/home' as any);
      return;
    }

    // Fallback
    if (type.includes('story') || message.includes('story')) {
      if (resolvedStoryId) {
        router.push(`/(tabs)/home?storyId=${encodeURIComponent(resolvedStoryId)}&isOwnStory=true&openComments=true&t=${Date.now()}` as any);
      } else {
        showStoryUnavailableAlert();
      }
      return;
    }

    if (resolvedConversationId || (type === 'dm' || type === 'message')) {
      const qs = `conversationId=${encodeURIComponent(resolvedConversationId)}&otherUserId=${encodeURIComponent(resolvedSenderId)}&user=${encodeURIComponent(resolvedSenderName)}&avatar=${encodeURIComponent(resolvedSenderAvatar)}`;
      router.push(`/dm?${qs}` as any);
    } else if (resolvedPostId) {
      router.push(`/post-detail?id=${encodeURIComponent(resolvedPostId)}` as any);
    } else if (resolvedSenderId) {
      router.push(`/user-profile?id=${encodeURIComponent(resolvedSenderId)}` as any);
    } else {
      router.push('/(tabs)/home' as any);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            hapticLight();
            safeRouterBack();
          }}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="arrow-left" size={24} color={COLORS.primary || '#FF6B00'} />
        </TouchableOpacity>
        <Text style={styles.title}>Notifications</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Bulk Actions */}
      <View style={styles.bulkActionsRow}>
        <TouchableOpacity
          style={styles.markAllButton}
          onPress={async () => {
            hapticMedium();
            try {
              await markAllAsRead();
            } catch (err) {
              // silent
            }
          }}
        >
          <Text style={styles.markAllText}>Mark All Read</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.clearAllButton}
          onPress={async () => {
            hapticMedium();
            try {
              await deleteAllNotifications();
            } catch (err) {
              // silent
            }
          }}
        >
          <Text style={styles.clearAllText}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="bell-off" size={64} color={COLORS.textMuted || '#ccc'} />
          <Text style={styles.emptyText}>No notifications yet</Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
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
          removeClippedSubviews={Platform.OS === 'android'}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{title}</Text>
            </View>
          )}
          renderItem={({ item }: { item: any }) => {
            const resolved = resolveNotificationSender(item);
            const resolvedSenderName = resolved.senderName;
            const resolvedSenderId = String(resolved.senderId || '').trim();

            const rawThumbnail = String(
              item?.postThumbnail ||
              item?.post?.imageUrl ||
              item?.post?.mediaUrl ||
              item?.post?.media?.[0] ||
              item?.data?.postThumbnail ||
              item?.data?.imageUrl ||
              item?.data?.mediaUrl ||
              item?.thumbnailUrl ||
              ''
            ).trim();

            const thumbnailUri = rawThumbnail ? resolveAvatarUrl(rawThumbnail) : null;
            const actionText = getNotificationActionText(item);
            const relativeTime = formatInstagramTime(item.createdAt);

            // Determine if user has an active story right now
            let activeStoryId: string | null = null;
            if (resolvedSenderId && activeStoryMap.has(resolvedSenderId)) {
              activeStoryId = activeStoryMap.get(resolvedSenderId)!;
            } else if (resolvedSenderName && activeStoryMap.has(`name:${resolvedSenderName.toLowerCase()}`)) {
              activeStoryId = activeStoryMap.get(`name:${resolvedSenderName.toLowerCase()}`)!;
            }
            const hasActiveStory = Boolean(activeStoryId);

            const handleAvatarPress = () => {
              if (item?._id) markAsRead(item._id).catch(() => {});
              if (hasActiveStory && activeStoryId) {
                router.push(`/(tabs)/home?storyId=${encodeURIComponent(activeStoryId)}&authorId=${encodeURIComponent(resolvedSenderId)}&t=${Date.now()}` as any);
              } else if (resolvedSenderId) {
                router.push(`/user-profile?id=${encodeURIComponent(resolvedSenderId)}` as any);
              }
            };

            return (
              <View>
                <TouchableOpacity 
                  activeOpacity={0.7}
                  style={[styles.nRow, !item.read && styles.nRowUnread]} 
                  onPress={() => handleNotificationClick(item)}
                >
                  {/* Left: Fixed Avatar Slot (48x48) guarantees pixel-perfect vertical alignment with or without ring */}
                  <View style={styles.avatarSlot}>
                    <TouchableOpacity activeOpacity={0.8} onPress={handleAvatarPress}>
                      {hasActiveStory ? (
                        <LinearGradient
                          colors={['#FF5E3A', '#FF2A68', '#FF8928']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.avatarGradientRing}
                        >
                          <View style={styles.avatarInnerContainer}>
                            <UserAvatar
                              user={item}
                              name={resolvedSenderName}
                              size={38}
                              showInitials
                            />
                          </View>
                        </LinearGradient>
                      ) : (
                        <View style={styles.avatarPlainContainer}>
                          <UserAvatar
                            user={item}
                            name={resolvedSenderName}
                            size={44}
                            showInitials
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Middle: Rich Text */}
                  <View style={styles.notificationContent}>
                    <Text style={styles.nTitle}>
                      {isSystemNotification(item) ? (
                        <>
                          <Text style={styles.systemText}>{getNotificationDisplayText(item)}</Text>
                          {' '}
                          <Text style={styles.nBody}>{relativeTime}</Text>
                        </>
                      ) : (
                        <>
                          <Text style={styles.senderNameText}>{resolvedSenderName}</Text>
                          {' '}
                          <Text style={styles.actionText}>{actionText}</Text>
                          {' '}
                          <Text style={styles.nBody}>{relativeTime}</Text>
                        </>
                      )}
                    </Text>
                  </View>

                  {/* Right: Media Thumbnail or Unread Dot */}
                  {thumbnailUri ? (
                    <ExpoImage
                      source={{ uri: thumbnailUri }}
                      style={styles.thumbnailImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                  ) : !item.read ? (
                    <View style={styles.unreadDot} />
                  ) : null}
                </TouchableOpacity>

                {/* Follow Request Actions */}
                {item.type === 'follow-request' && (
                  <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginRight: 24, marginBottom: 8 }}>
                    <AcceptDeclineButtons item={item} onActionTaken={() => {
                      fetchNotifications();
                    }} />
                  </View>
                )}
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={styles.nSep} />}
          contentContainerStyle={{ paddingBottom: 28 }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background || '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: COLORS.background || '#ffffff',
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.border || '#ebebeb',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary || '#1f2937',
  },
  bulkActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 16,
    marginVertical: 10,
  },
  markAllButton: {
    backgroundColor: COLORS.primary || '#FF6B00',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  markAllText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  clearAllButton: {
    backgroundColor: COLORS.danger || '#FF3B30',
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  clearAllText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 13,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textMuted || '#9ca3af',
    marginTop: 16,
  },
  sectionHeader: {
    backgroundColor: COLORS.background || '#ffffff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary || '#111827',
    letterSpacing: -0.2,
  },
  nRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.card || '#ffffff',
  },
  nRowUnread: {
    backgroundColor: COLORS.primaryLight || '#FFF9F2',
  },
  avatarSlot: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarPlainContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  avatarGradientRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInnerContainer: {
    width: 43,
    height: 43,
    borderRadius: 21.5,
    borderWidth: 2,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  },
  notificationContent: {
    flex: 1,
    marginRight: 8,
  },
  nTitle: {
    fontSize: 14,
    lineHeight: 18,
    color: COLORS.textPrimary || '#1f2937',
  },
  senderNameText: {
    fontWeight: '700',
    color: COLORS.textPrimary || '#000000',
  },
  actionText: {
    color: COLORS.textSecondary || '#4b5563',
  },
  systemText: {
    color: COLORS.textPrimary || '#1f2937',
    fontWeight: '500',
  },
  nBody: {
    fontSize: 13,
    color: COLORS.textMuted || '#8e8e8e',
    fontWeight: '400',
  },
  thumbnailImage: {
    width: 44,
    height: 44,
    borderRadius: 6,
    backgroundColor: '#eee',
    marginLeft: 8,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary || '#FF6B00',
    marginLeft: 8,
  },
  nSep: {
    height: 0.5,
    backgroundColor: COLORS.border || '#f0f0f0',
    marginLeft: 76,
  },
});
