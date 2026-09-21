import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Alert,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import AsyncStorage from '@/lib/storage';
import { safeRouterBack } from '@/lib/safeRouterBack';
import { resolveAvatarUrl, isMissingOrDefaultAvatar } from '@/lib/utils/avatar';
import { DEFAULT_AVATAR_URL, getCdnUrl } from '@/lib/api';
import { getCachedUserProfile, useUserProfile } from '@/hooks/useUserProfile';
import { apiService } from '@/src/_services/apiService';
import { userService } from '@/lib/userService';
import { clearConversation, fetchMessages } from '@/lib/firebaseHelpers/index';
import { useAppStore } from '@/store/useAppStore';
import { resolveCanonicalUserId } from '@/lib/currentUser';
import { isVideoUrl } from '@/lib/utils/media';
import { buildSharedPostMetadata, resolveSharedPostId, isPostVideo, getPostPrimaryImageUrl, getPostMediaUrls } from '@/src/utils/postMedia';
import { getVideoThumbnailUrl } from '@/lib/imageHelpers';
import { addBlockedUserId, removeBlockedUserId, addReportedUserId, isUserBlockedLocally, fetchBlockedUserIds } from '@/services/moderation';
import { feedEventEmitter } from '@/lib/feedEventEmitter';
import { clearConversationCaches } from '@/src/_services/dmHelpers';
import COLORS from '@/src/theme/colors';
import UserAvatar from '@/src/_components/UserAvatar';

export default function ChatDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { userId: storeUserId } = useAppStore();
  const [currentUserId, setCurrentUserId] = useState<string | null>(storeUserId);

  useEffect(() => {
    resolveCanonicalUserId().then(uid => {
      if (uid) setCurrentUserId(uid);
    }).catch(() => {});
  }, [storeUserId]);

  const conversationId = String((params as any)?.conversationId || '').trim();
  const targetUserId = String(
    (params as any)?.userId || (params as any)?.otherUserId || (params as any)?.uid || (params as any)?.id || ''
  ).trim();

  const [isMutedMessages, setIsMutedMessages] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  // Shared content state for 3 tabs: Media, Posts, Links
  const [activeTab, setActiveTab] = useState<'media' | 'posts' | 'links'>('media');
  const [selectedMediaItem, setSelectedMediaItem] = useState<any | null>(null);
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [postList, setPostList] = useState<any[]>([]);
  const [linkList, setLinkList] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);

  const getMediaThumbnail = (item: any): string => {
    const rawMsg = item?.raw || item || {};
    const postObj = rawMsg.sharedPost || rawMsg.sharedStory || rawMsg.postMetadata || rawMsg.post || rawMsg;

    let img = getPostPrimaryImageUrl(postObj);
    if (img) return img;

    img = getPostPrimaryImageUrl(rawMsg);
    if (img) return img;

    const mediaUrls = [
      ...(Array.isArray(postObj?.mediaUrls) ? postObj.mediaUrls : []),
      ...(Array.isArray(postObj?.imageUrls) ? postObj.imageUrls : []),
      ...(Array.isArray(postObj?.images) ? postObj.images : []),
      ...(Array.isArray(postObj?.media) ? postObj.media : []),
      ...(postObj?.imageUrl ? [postObj.imageUrl] : []),
      ...(postObj?.image ? [postObj.image] : []),
      ...(postObj?.thumbnailUrl ? [postObj.thumbnailUrl] : []),
      ...(postObj?.thumbnail ? [postObj.thumbnail] : []),
      ...(postObj?.mediaUrl ? [postObj.mediaUrl] : []),
      ...(postObj?.videoUrl ? [postObj.videoUrl] : []),
      ...(postObj?.video ? [postObj.video] : []),
      ...(rawMsg?.mediaUrl ? [rawMsg.mediaUrl] : []),
      ...(rawMsg?.imageUrl ? [rawMsg.imageUrl] : []),
    ];

    for (const url of mediaUrls) {
      const rawStr = typeof url === 'string' ? url : (url?.url || url?.uri || url?.imageUrl || url?.thumbnailUrl || '');
      if (rawStr && typeof rawStr === 'string' && rawStr.trim()) {
        if (item.isVideo || isVideoUrl(rawStr)) {
          const poster = postObj?.thumbnailUrl || postObj?.thumbnail || rawMsg?.thumbnailUrl;
          const thumb = getVideoThumbnailUrl(rawStr, poster);
          if (thumb) return getCdnUrl(thumb);
        }
        return getCdnUrl(rawStr);
      }
    }
    return '';
  };

  const { profile: targetProfile } = useUserProfile(targetUserId);
  const cachedProfile = useMemo(() => (targetUserId ? getCachedUserProfile(targetUserId) : null), [targetUserId]);

  const displayName = useMemo(() => {
    const fromApi = targetProfile?.displayName || targetProfile?.name;
    const fromCache = cachedProfile?.displayName || cachedProfile?.name;
    const fromParam = (params as any)?.displayName || (params as any)?.user || (params as any)?.name;
    return fromApi || fromCache || fromParam || 'User';
  }, [targetProfile, cachedProfile, params]);

  const username = useMemo(() => {
    return targetProfile?.username || (targetProfile as any)?.userName || cachedProfile?.username || (params as any)?.username || null;
  }, [targetProfile, cachedProfile, params]);

  const avatarUri = useMemo(() => {
    const raw = targetProfile?.avatar || targetProfile?.photoURL || cachedProfile?.avatar || (params as any)?.avatar;
    if (raw && !isMissingOrDefaultAvatar(raw)) {
      return resolveAvatarUrl(raw);
    }
    return DEFAULT_AVATAR_URL;
  }, [targetProfile, cachedProfile, params]);

  // Load persisted mute state
  useEffect(() => {
    if (conversationId || targetUserId) {
      const key = conversationId || targetUserId;
      AsyncStorage.getItem(`mute_chat_${key}`).then((val) => {
        if (val !== null) setIsMutedMessages(val === 'true');
      });
    }
  }, [conversationId, targetUserId]);

  // Load and categorize shared content
  useEffect(() => {
    let isMounted = true;

    const isRealSharedPostMessage = (m: any): boolean => {
      if (!m) return false;
      const msgType = String(m.type || m.mediaType || '').toLowerCase();

      if (
        msgType.includes('story') ||
        msgType === 'story_reply' ||
        msgType === 'story_comment' ||
        msgType === 'dm' ||
        msgType === 'text' ||
        msgType === 'message' ||
        msgType === 'image' ||
        msgType === 'video'
      ) {
        if (!m.sharedPost || typeof m.sharedPost !== 'object' || Object.keys(m.sharedPost).length === 0) {
          return false;
        }
      }

      const postObj = m.sharedPost || m.post || (msgType === 'post' ? m : null);
      const msgId = String(m.id || m._id || '').trim();

      const candidatePostId = String(
        m.sharedPostId ||
        m.postId ||
        postObj?.postId ||
        postObj?._id ||
        postObj?.id ||
        m.postMetadata?.postId ||
        m.postMetadata?.sharePostId ||
        ''
      ).trim();

      const hasValidPostId = Boolean(
        candidatePostId &&
        candidatePostId !== 'undefined' &&
        candidatePostId !== 'null' &&
        candidatePostId !== msgId
      );

      const hasSharedPostObj = Boolean(
        m.sharedPost &&
        typeof m.sharedPost === 'object' &&
        Object.keys(m.sharedPost).length > 0 &&
        (m.sharedPost.id || m.sharedPost._id || m.sharedPost.postId || m.sharedPost.mediaUrl || m.sharedPost.imageUrl)
      );

      return hasSharedPostObj || (msgType === 'post' && hasValidPostId);
    };

    const fetchSharedContent = async () => {
      setLoadingMedia(true);
      try {
        let msgs: any[] = [];
        if (conversationId) {
          const res: any = await fetchMessages(conversationId, { limit: 100 }).catch(() => null);
          msgs = Array.isArray(res) ? res : (res?.data || res?.messages || []);
        }
        if ((!msgs || msgs.length === 0) && currentUserId && targetUserId) {
          const pairKey = [String(currentUserId), String(targetUserId)].sort().join('_');
          const res: any = await fetchMessages(pairKey, { limit: 100 }).catch(() => null);
          msgs = Array.isArray(res) ? res : (res?.data || res?.messages || []);
        }

        if (isMounted && Array.isArray(msgs)) {
          const medias: any[] = [];
          const posts: any[] = [];
          const links: any[] = [];

          const URL_REGEX = /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

          msgs.forEach((m) => {
            if (!m) return;

            // 1. Shared Posts & Reels
            if (isRealSharedPostMessage(m)) {
              const postObj = m.sharedPost || m.postMetadata || {};
              const msgId = String(m.id || m._id || '').trim();
              const rawPostId = String(
                m.sharedPostId ||
                m.postId ||
                postObj.postId ||
                postObj._id ||
                postObj.id ||
                ''
              ).trim();

              const validPostId = (rawPostId && rawPostId !== 'undefined' && rawPostId !== 'null' && rawPostId !== msgId) ? rawPostId : '';
              const primaryImg = getPostPrimaryImageUrl(postObj) || getPostPrimaryImageUrl(m);
              const isVideo = isPostVideo(postObj) || isPostVideo(m) || isVideoUrl(primaryImg || m.mediaUrl || '');

              posts.push({
                id: m.id || m._id || String(Math.random()),
                postId: validPostId || m.id,
                mediaUrl: primaryImg || m.mediaUrl || m.imageUrl || '',
                isVideo,
                raw: m,
              });
            }
            // 2. Direct Photos & Videos from gallery
            else if (
              (m.mediaUrl || m.imageUrl || ['image', 'video'].includes(String(m.mediaType || m.type || '').toLowerCase())) &&
              !String(m.type || m.mediaType || '').toLowerCase().includes('story')
            ) {
              const mediaUrl = m.mediaUrl || m.imageUrl;
              const isVideo = isVideoUrl(mediaUrl || '') || String(m.mediaType || m.type || '').toLowerCase() === 'video';
              if (mediaUrl) {
                medias.push({
                  id: m.id || m._id || String(Math.random()),
                  mediaUrl,
                  isVideo,
                  raw: m,
                });
              }
            }

            // 3. Extracted Web Links
            if (m.text && typeof m.text === 'string') {
              const matches = m.text.match(URL_REGEX);
              if (matches) {
                matches.forEach((urlMatch: string) => {
                  let fullUrl = urlMatch;
                  if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
                    fullUrl = 'https://' + fullUrl;
                  }
                  const domain = fullUrl.replace(/^https?:\/\//i, '').split('/')[0];
                  links.push({
                    id: (m.id || m._id || String(Math.random())) + '_' + Math.random(),
                    url: fullUrl,
                    domain,
                    text: m.text,
                    createdAt: m.createdAt,
                  });
                });
              }
            }
          });

          setMediaList(medias);
          setPostList(posts);
          setLinkList(links);
        }
      } catch (err) {
        console.warn('[chat-details] Fetch media error:', err);
      } finally {
        if (isMounted) setLoadingMedia(false);
      }
    };

    fetchSharedContent();
    return () => {
      isMounted = false;
    };
  }, [conversationId, targetUserId, currentUserId]);

  const handleOpenLink = async (url: string) => {
    if (!url) return;
    let targetUrl = url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }
    try {
      await Linking.openURL(targetUrl);
    } catch {
      Alert.alert('Link', `Could not open link: ${targetUrl}`);
    }
  };

  const handlePressPostItem = (item: any) => {
    const pid = item.postId || item.id;
    if (pid) {
      router.push(`/post-detail?id=${encodeURIComponent(pid)}` as any);
    }
  };

  const toggleMuteMessages = async (val: boolean) => {
    setIsMutedMessages(val);
    const key = conversationId || targetUserId;
    if (key) {
      await AsyncStorage.setItem(`mute_chat_${key}`, String(val));
    }
  };

  const [isBlocked, setIsBlocked] = useState(() => isUserBlockedLocally(targetUserId, currentUserId || undefined));

  useEffect(() => {
    if (!currentUserId || !targetUserId) return;
    fetchBlockedUserIds(currentUserId).then((ids) => {
      if (ids.has(String(targetUserId))) {
        setIsBlocked(true);
      }
    }).catch(() => {});
  }, [currentUserId, targetUserId]);

  const handleBlockUser = async () => {
    const activeUserId = currentUserId || (await resolveCanonicalUserId());
    if (!targetUserId || (activeUserId && String(targetUserId) === String(activeUserId))) {
      Alert.alert('Action Not Allowed', 'You cannot block yourself.');
      return;
    }
    setShowOptionsModal(false);

    if (isBlocked) {
      Alert.alert(
        `Unblock ${displayName}?`,
        `They will be able to message you and find your profile on Comedy App.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            style: 'default',
            onPress: async () => {
              const effectiveUid = activeUserId || (await resolveCanonicalUserId());
              if (!effectiveUid || !targetUserId) {
                Alert.alert('Error', 'Could not identify user. Please try again.');
                return;
              }
              try {
                removeBlockedUserId(effectiveUid, targetUserId);
                setIsBlocked(false);
                feedEventEmitter.emitFeedUpdate({ type: 'USER_UNBLOCKED', userId: targetUserId, blockedUserId: targetUserId });
                await userService.unblockUser(effectiveUid, targetUserId);
                Alert.alert('Unblocked', `${displayName} has been unblocked.`);
              } catch (e) {
                Alert.alert('Error', 'Failed to unblock user.');
              }
            },
          },
        ]
      );
      return;
    }

    Alert.alert(
      `Block ${displayName}?`,
      `They won't be able to message you or find your profile on Comedy App. They won't be notified that you blocked them.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const effectiveUid = activeUserId || (await resolveCanonicalUserId());
            if (!effectiveUid || !targetUserId) {
              Alert.alert('Error', 'Unable to resolve user identity. Please try logging in again.');
              return;
            }
            try {
              addBlockedUserId(effectiveUid, targetUserId);
              setIsBlocked(true);
              feedEventEmitter.emitFeedUpdate({ type: 'USER_BLOCKED', userId: targetUserId, blockedUserId: targetUserId });
              const success = await userService.blockUser(effectiveUid, targetUserId);
              if (success) {
                Alert.alert('Blocked', `${displayName} has been blocked.`);
                router.replace('/inbox' as any);
              } else {
                Alert.alert('Error', 'Failed to block user on server. Please try again.');
              }
            } catch (e) {
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleClearConversation = () => {
    setShowOptionsModal(false);
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to clear all messages? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              if (conversationId) {
                await clearConversation(conversationId);
              }
              clearConversationCaches(conversationId, targetUserId, currentUserId);
              setMediaList([]);
              setPostList([]);
              setLinkList([]);
              Alert.alert('Success', 'Conversation cleared.');
              safeRouterBack();
            } catch (e) {
              Alert.alert('Error', 'Failed to clear conversation.');
            }
          }
        }
      ]
    );
  };

  const handleReportUser = () => {
    setShowOptionsModal(false);
    if (!targetUserId) return;
    Alert.alert(
      `Report ${displayName}`,
      'Why are you reporting this user?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Spam or Scam',
          onPress: async () => {
            if (targetUserId) addReportedUserId(targetUserId);
            Alert.alert('Report Submitted', 'Thank you. We will review this report within 24 hours.');
          }
        },
        {
          text: 'Inappropriate Content',
          onPress: async () => {
            if (targetUserId) addReportedUserId(targetUserId);
            Alert.alert('Report Submitted', 'Thank you. We will review this report within 24 hours.');
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <TouchableOpacity onPress={() => safeRouterBack()} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={24} color={COLORS.textPrimary || '#1f2937'} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Details</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <View style={styles.userCard}>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              if (targetUserId) {
                router.push(`/user-profile?id=${encodeURIComponent(targetUserId)}` as any);
              }
            }}
            style={{ alignItems: 'center' }}
            disabled={!targetUserId}
          >
            <UserAvatar uri={avatarUri} name={displayName} size={84} showInitials />
            <Text style={styles.userName}>{displayName}</Text>
            {username && <Text style={styles.userHandle}>@{username}</Text>}
          </TouchableOpacity>
        </View>

        {/* Instagram-Style Circular Action Bubbles (Search, Mute, Options) */}
        <View style={styles.actionGrid}>
          <TouchableOpacity
            style={styles.actionItem}
            activeOpacity={0.7}
            onPress={() => {
              safeRouterBack();
              router.push(`/dm?conversationId=${encodeURIComponent(conversationId)}&otherUserId=${encodeURIComponent(targetUserId)}&searchMode=1&focusSearch=1` as any);
            }}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="search-outline" size={22} color={COLORS.textPrimary || '#000000'} />
            </View>
            <Text style={styles.actionLabel}>Search</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            activeOpacity={0.7}
            onPress={() => toggleMuteMessages(!isMutedMessages)}
          >
            <View style={[styles.iconCircle, isMutedMessages && styles.iconCircleActive]}>
              <Ionicons
                name={isMutedMessages ? 'notifications-off' : 'notifications-outline'}
                size={22}
                color={isMutedMessages ? (COLORS.primary || '#FF6B00') : (COLORS.textPrimary || '#000000')}
              />
            </View>
            <Text style={[styles.actionLabel, isMutedMessages && { color: COLORS.primary || '#FF6B00' }]}>
              {isMutedMessages ? 'Muted' : 'Mute'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            activeOpacity={0.7}
            onPress={() => setShowOptionsModal(true)}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="ellipsis-horizontal" size={22} color={COLORS.textPrimary || '#000000'} />
            </View>
            <Text style={styles.actionLabel}>Options</Text>
          </TouchableOpacity>
        </View>

        {/* Shared Content Tabs (Icons) */}
        <View style={styles.tabHeaderContainer}>
          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'media' && styles.tabButtonActive]}
            onPress={() => setActiveTab('media')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="images-outline"
              size={24}
              color={activeTab === 'media' ? (COLORS.textPrimary || '#000000') : '#8E8E93'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'posts' && styles.tabButtonActive]}
            onPress={() => setActiveTab('posts')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="repeat-outline"
              size={24}
              color={activeTab === 'posts' ? (COLORS.textPrimary || '#000000') : '#8E8E93'}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, activeTab === 'links' && styles.tabButtonActive]}
            onPress={() => setActiveTab('links')}
            activeOpacity={0.7}
          >
            <Ionicons
              name="link-outline"
              size={24}
              color={activeTab === 'links' ? (COLORS.textPrimary || '#000000') : '#8E8E93'}
            />
          </TouchableOpacity>
        </View>

        {/* Content Body */}
        {loadingMedia ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={COLORS.primary || '#FF6B00'} />
          </View>
        ) : (
          <View style={styles.tabContentArea}>
            {activeTab === 'media' && (
              mediaList.length === 0 ? (
                <Text style={styles.emptyTabText}>No photos or videos shared yet</Text>
              ) : (
                <View style={styles.gridContainer}>
                  {mediaList.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.gridItem}
                      onPress={() => setSelectedMediaItem(item)}
                    >
                      <ExpoImage
                        source={{ uri: getMediaThumbnail(item) || item.mediaUrl }}
                        style={styles.gridImage}
                        contentFit="cover"
                      />
                      {item.isVideo && (
                        <View style={styles.videoBadge}>
                          <Ionicons name="play" size={14} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )
            )}

            {activeTab === 'posts' && (
              postList.length === 0 ? (
                <Text style={styles.emptyTabText}>No posts or reels shared yet</Text>
              ) : (
                <View style={styles.gridContainer}>
                  {postList.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.gridItem}
                      onPress={() => handlePressPostItem(item)}
                    >
                      <ExpoImage
                        source={{ uri: item.mediaUrl || getMediaThumbnail(item) }}
                        style={styles.gridImage}
                        contentFit="cover"
                      />
                      {item.isVideo && (
                        <View style={styles.videoBadge}>
                          <Ionicons name="play" size={14} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )
            )}

            {activeTab === 'links' && (
              linkList.length === 0 ? (
                <Text style={styles.emptyTabText}>No links shared yet</Text>
              ) : (
                <View style={styles.linksContainer}>
                  {linkList.map((link) => (
                    <TouchableOpacity
                      key={link.id}
                      style={styles.linkRow}
                      onPress={() => handleOpenLink(link.url)}
                    >
                      <View style={styles.linkIconWrap}>
                        <Feather name="link" size={18} color={COLORS.primary || '#FF6B00'} />
                      </View>
                      <View style={styles.linkInfo}>
                        <Text style={styles.linkDomain} numberOfLines={1}>{link.domain}</Text>
                        <Text style={styles.linkUrl} numberOfLines={1}>{link.url}</Text>
                      </View>
                      <Feather name="external-link" size={16} color="#9ca3af" />
                    </TouchableOpacity>
                  ))}
                </View>
              )
            )}
          </View>
        )}

      </ScrollView>

      {/* Media Fullscreen Preview Modal */}
      {selectedMediaItem && (
        <Modal visible={true} transparent={true} animationType="fade" onRequestClose={() => setSelectedMediaItem(null)}>
          <View style={styles.fullscreenModal}>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setSelectedMediaItem(null)}>
              <Feather name="x" size={28} color="#fff" />
            </TouchableOpacity>
            {selectedMediaItem.isVideo ? (
              <Video
                source={{ uri: selectedMediaItem.mediaUrl }}
                style={styles.fullscreenMedia}
                resizeMode={ResizeMode.CONTAIN}
                useNativeControls
                shouldPlay
                isLooping
              />
            ) : (
              <ExpoImage
                source={{ uri: selectedMediaItem.mediaUrl }}
                style={styles.fullscreenMedia}
                contentFit="contain"
              />
            )}
          </View>
        </Modal>
      )}

      {/* 3-Dots Privacy & Support Modal Sheet */}
      <Modal visible={showOptionsModal} transparent animationType="fade" onRequestClose={() => setShowOptionsModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowOptionsModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalSheetTitle}>Privacy & Support</Text>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => { setShowOptionsModal(false); handleBlockUser(); }}>
              <Ionicons name="ban-outline" size={20} color={isBlocked ? '#0095F6' : '#ef4444'} style={{ marginRight: 12 }} />
              <Text style={[styles.sheetBtnText, { color: isBlocked ? '#0095F6' : '#ef4444' }]}>
                {isBlocked ? 'Unblock User' : 'Block User'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => { setShowOptionsModal(false); handleReportUser(); }}>
              <Ionicons name="flag-outline" size={20} color="#ef4444" style={{ marginRight: 12 }} />
              <Text style={[styles.sheetBtnText, { color: '#ef4444' }]}>Report User</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => { setShowOptionsModal(false); handleClearConversation(); }}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" style={{ marginRight: 12 }} />
              <Text style={[styles.sheetBtnText, { color: '#ef4444' }]}>Clear Conversation</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.sheetBtn, styles.sheetCancelBtn]} onPress={() => setShowOptionsModal(false)}>
              <Text style={styles.sheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background || '#ffffff',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  topTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: COLORS.textPrimary || '#1f2937',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  userCard: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 16,
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary || '#1f2937',
    marginTop: 12,
  },
  userHandle: {
    fontSize: 14,
    color: COLORS.textMuted || '#8e8e8e',
    marginTop: 2,
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
    paddingVertical: 14,
  },
  actionItem: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f2f2f2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  iconCircleActive: {
    backgroundColor: '#FFF0E6',
  },
  actionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.textPrimary || '#1f2937',
  },
  tabHeaderContainer: {
    flexDirection: 'row',
    marginTop: 16,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: COLORS.textPrimary || '#000000',
  },
  tabContentArea: {
    padding: 16,
    minHeight: 180,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyTabText: {
    textAlign: 'center',
    color: COLORS.textMuted || '#9ca3af',
    marginTop: 32,
    fontSize: 14,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridItem: {
    width: '31.3%',
    aspectRatio: 1,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#eee',
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  videoBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linksContainer: {
    gap: 12,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
  },
  linkIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFF4EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  linkInfo: {
    flex: 1,
    marginRight: 8,
  },
  linkDomain: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary || '#1f2937',
  },
  linkUrl: {
    fontSize: 12,
    color: COLORS.textMuted || '#6b7280',
    marginTop: 2,
  },
  actionRow: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionRowText: {
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 0.5,
    backgroundColor: '#ebebeb',
  },
  fullscreenModal: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  fullscreenMedia: {
    width: '100%',
    height: '80%',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 8,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d1d5db',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalSheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary || '#1f2937',
    textAlign: 'center',
    marginBottom: 16,
  },
  sheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f3f4f6',
  },
  sheetBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  sheetCancelBtn: {
    borderBottomWidth: 0,
    marginTop: 8,
    justifyContent: 'center',
  },
  sheetCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary || '#1f2937',
    textAlign: 'center',
  },
});
