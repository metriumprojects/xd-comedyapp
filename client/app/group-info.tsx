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
  Platform,
  Linking,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { safeRouterBack } from '@/lib/safeRouterBack';
import { resolveAvatarUrl, isMissingOrDefaultAvatar } from '@/lib/utils/avatar';
import { DEFAULT_AVATAR_URL, getCdnUrl } from '@/lib/api';
import { cacheUserProfile, getCachedUserProfile } from '@/hooks/useUserProfile';
import { apiService } from '@/src/_services/apiService';
import { fetchMessages, clearConversation, getUserProfile } from '@/lib/firebaseHelpers/index';
import { useAppStore } from '@/store/useAppStore';
import { resolveCanonicalUserId } from '@/lib/currentUser';
import { isVideoUrl } from '@/lib/utils/media';
import { buildSharedPostMetadata, resolveSharedPostId, isPostVideo, getPostPrimaryImageUrl, getPostMediaUrls } from '@/src/utils/postMedia';
import { getVideoThumbnailUrl } from '@/lib/imageHelpers';
import { feedEventEmitter } from '@/lib/feedEventEmitter';
import { clearConversationCaches } from '@/src/_services/dmHelpers';
import { getGroupChat } from '@/lib/groupChat';
import { showPostUnavailableAlert } from '@/src/utils/storyAlerts';
import COLORS from '@/src/theme/colors';
import UserAvatar from '@/src/_components/UserAvatar';
import AsyncStorage from '@/lib/storage';

export default function GroupInfoScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { userId: storeUserId, userProfile: storeUserProfile } = useAppStore();
  const [currentUser, setCurrentUser] = useState<any>(storeUserProfile);
  const [currentUserId, setCurrentUserId] = useState<string | null>(storeUserId);

  useEffect(() => {
    if (storeUserProfile) setCurrentUser(storeUserProfile);
  }, [storeUserProfile]);

  useEffect(() => {
    resolveCanonicalUserId().then(uid => {
      if (uid) setCurrentUserId(uid);
    }).catch(() => {});
  }, [storeUserId]);

  const myIds = useMemo(() => {
    const s = new Set<string>();
    if (currentUserId) s.add(String(currentUserId).trim().toLowerCase());
    if (storeUserId) s.add(String(storeUserId).trim().toLowerCase());
    if (currentUser?._id) s.add(String(currentUser._id).trim().toLowerCase());
    if (currentUser?.id) s.add(String(currentUser.id).trim().toLowerCase());
    if (currentUser?.userId) s.add(String(currentUser.userId).trim().toLowerCase());
    if (currentUser?.uid) s.add(String(currentUser.uid).trim().toLowerCase());
    if (currentUser?.username) s.add(String(currentUser.username).trim().toLowerCase());
    if (currentUser?.userName) s.add(String(currentUser.userName).trim().toLowerCase());
    return s;
  }, [currentUserId, storeUserId, currentUser]);

  const checkIsSelf = (item: any): boolean => {
    if (!item) return false;
    const candidates = [
      item.uid,
      item._id,
      item.id,
      item.userId,
      item.userName,
      item.username,
      item.senderId,
    ];
    for (const c of candidates) {
      if (c && myIds.has(String(c).trim().toLowerCase())) {
        return true;
      }
    }
    return false;
  };

  const conversationId = String((params as any)?.conversationId || '').trim();
  const groupId = String((params as any)?.groupId || '').trim();
  const rawGroupName = String((params as any)?.groupName || (params as any)?.name || (params as any)?.title || 'Group Chat').trim();
  const rawAvatar = String((params as any)?.avatar || (params as any)?.groupAvatar || '').trim();

  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMutedMessages, setIsMutedMessages] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);

  const handleClearChat = () => {
    setShowOptionsModal(false);
    const targetGroupId = groupId || conversationId;
    if (!targetGroupId) return;
    Alert.alert(
      'Clear Chat History?',
      'This will permanently delete all messages in this group chat for you.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Chat',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearConversation(targetGroupId);
            } catch (e) {}
            clearConversationCaches(targetGroupId);
            setMediaList([]);
            setPostList([]);
            setLinkList([]);
            Alert.alert('Chat Cleared', 'Group chat history cleared successfully.');
            safeRouterBack('/inbox');
          },
        },
      ]
    );
  };

  const handleLeaveChat = () => {
    setShowOptionsModal(false);
    const targetGroupId = groupId || conversationId;
    if (!targetGroupId) {
      Alert.alert('Error', 'Group not found.');
      return;
    }
    Alert.alert(
      'Leave Chat?',
      'You won\'t receive messages from this group anymore. You can only rejoin if someone adds you again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const res: any = await apiService.post(`/conversations/${targetGroupId}/leave`, {
                userId: currentUserId,
              });
              if (res && res.success === false) {
                throw new Error(res.error || 'Failed to leave group');
              }

              const idsToClear = [targetGroupId, conversationId, groupId].filter(Boolean);
              for (const id of idsToClear) {
                try {
                  useAppStore.getState().setCachedMessages?.(String(id), []);
                } catch {}
                clearConversationCaches(String(id));
                AsyncStorage.removeItem(`messages_cache_${id}`).catch(() => {});
                AsyncStorage.removeItem(`mute_chat_${id}`).catch(() => {});
              }

              feedEventEmitter.emit('feedUpdated', {
                type: 'GROUP_LEFT',
                conversationId: targetGroupId,
                groupId: targetGroupId,
              });

              try {
                router.replace('/inbox' as any);
              } catch {
                safeRouterBack('/inbox');
              }
            } catch (e: any) {
              Alert.alert('Couldn\'t leave', e?.message || 'Please try again.');
            }
          },
        },
      ]
    );
  };

  // Load persisted mute state
  useEffect(() => {
    const targetKey = conversationId || groupId;
    if (targetKey) {
      AsyncStorage.getItem(`mute_chat_${targetKey}`).then((val) => {
        if (val !== null) setIsMutedMessages(val === 'true');
      }).catch(() => {});
    }
  }, [conversationId, groupId]);

  const toggleMuteMessages = async (val: boolean) => {
    setIsMutedMessages(val);
    const targetKey = conversationId || groupId;
    if (targetKey) {
      try {
        await AsyncStorage.setItem(`mute_chat_${targetKey}`, String(val));
        await apiService.put(`/conversations/${targetKey}/mute`, { isMuted: val }).catch(() => {});
      } catch (e) {
        console.warn('[group-info] Error setting mute status:', e);
      }
    }
  };

  const [adminId, setAdminId] = useState<string | null>(() => {
    return (params as any)?.adminId || (params as any)?.createdBy || null;
  });

  // Shared content state for 3 Instagram tabs: Media, Posts, Links
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

  const formatSharedPostItem = (item: any) => {
    const rawMsg = item?.raw || item || {};
    const postObj = rawMsg.sharedPost || rawMsg.sharedStory || rawMsg.postMetadata || rawMsg.post || rawMsg.data?.sharedPost || rawMsg;

    const pid = String(
      resolveSharedPostId(rawMsg) ||
      resolveSharedPostId(postObj) ||
      postObj.postId ||
      postObj.id ||
      postObj._id ||
      rawMsg.postId ||
      rawMsg.id ||
      rawMsg._id ||
      item.postId ||
      item.id ||
      ''
    ).trim();

    // Safely extract Author ID (must be string!)
    const rawAuthor = postObj.userId || postObj.authorId || postObj.user || postObj.author || postObj.ownerId || rawMsg.authorId || rawMsg.postAuthorId;
    let authorId = '';
    if (typeof rawAuthor === 'string') {
      authorId = rawAuthor.trim();
    } else if (rawAuthor && typeof rawAuthor === 'object') {
      authorId = String(rawAuthor._id || rawAuthor.id || rawAuthor.uid || rawAuthor.firebaseUid || '').trim();
    }
    if (!authorId && rawMsg.senderId && !postObj.id && !postObj._id) {
      authorId = String(rawMsg.senderId).trim();
    }

    // Extract Author Display Name & Username & Avatar
    const authorName = String(
      postObj.userName ||
      postObj.authorName ||
      postObj.user?.displayName ||
      postObj.user?.name ||
      postObj.author?.displayName ||
      postObj.author?.name ||
      (typeof rawAuthor === 'object' ? (rawAuthor.displayName || rawAuthor.name) : '') ||
      'User'
    ).trim();

    const authorUsername = String(
      postObj.username ||
      postObj.authorUsername ||
      postObj.user?.username ||
      postObj.author?.username ||
      (typeof rawAuthor === 'object' ? rawAuthor.username : '') ||
      ''
    ).trim();

    const authorAvatarRaw = String(
      postObj.userAvatar ||
      postObj.authorAvatar ||
      postObj.user?.avatar ||
      postObj.user?.profilePicture ||
      postObj.user?.photoURL ||
      postObj.author?.avatar ||
      (typeof rawAuthor === 'object' ? (rawAuthor.avatar || rawAuthor.profilePicture || rawAuthor.photoURL) : '') ||
      ''
    ).trim();
    const authorAvatar = getCdnUrl(authorAvatarRaw) || DEFAULT_AVATAR_URL;

    // Primary Image & Media URLs
    const primaryImage = getPostPrimaryImageUrl(postObj) || getPostPrimaryImageUrl(rawMsg) || getCdnUrl(item.mediaUrl || postObj.mediaUrl || postObj.imageUrl || '');
    const allMediaUrls = getPostMediaUrls(postObj);
    if (allMediaUrls.length === 0 && primaryImage) {
      allMediaUrls.push(primaryImage);
    }

    const isVideo = isPostVideo(postObj) || isPostVideo(rawMsg) || item.isVideo || isVideoUrl(primaryImage);
    const videoUrlRaw = postObj.videoUrl || postObj.video || rawMsg.videoUrl || (isVideo ? primaryImage : '');
    const videoUrl = videoUrlRaw ? getCdnUrl(videoUrlRaw) : undefined;
    const thumbnailUrl = getCdnUrl(postObj.thumbnailUrl || postObj.thumbnail || rawMsg.thumbnailUrl || '');

    let metadata: any = {};
    if (pid) {
      try {
        metadata = buildSharedPostMetadata(postObj, pid);
      } catch {}
    }

    return {
      ...metadata,
      id: pid || String(item.id || Math.random()),
      _id: pid || String(item.id || Math.random()),
      postId: pid,
      caption: postObj.caption || postObj.text || rawMsg.text || '',
      userId: authorId,
      authorId: authorId,
      ownerId: authorId,
      userName: authorName,
      userAvatar: authorAvatar,
      user: {
        id: authorId,
        _id: authorId,
        uid: authorId,
        displayName: authorName,
        name: authorName,
        username: authorUsername,
        avatar: authorAvatar,
        profilePicture: authorAvatar,
        photoURL: authorAvatar,
      },
      author: {
        id: authorId,
        _id: authorId,
        uid: authorId,
        displayName: authorName,
        name: authorName,
        username: authorUsername,
        avatar: authorAvatar,
        profilePicture: authorAvatar,
        photoURL: authorAvatar,
      },
      mediaType: isVideo ? 'video' : 'image',
      isVideo: isVideo,
      imageUrl: isVideo ? (thumbnailUrl || primaryImage) : primaryImage,
      videoUrl: videoUrl,
      thumbnailUrl: thumbnailUrl,
      media: allMediaUrls.map((u: string) => ({
        url: u,
        type: isVideo ? 'video' : 'image',
        thumbnailUrl: thumbnailUrl || undefined,
      })),
      mediaUrls: allMediaUrls,
      likesCount: postObj.likesCount || (Array.isArray(postObj.likes) ? postObj.likes.length : 0),
      commentsCount: postObj.commentsCount || (Array.isArray(postObj.comments) ? postObj.comments.length : 0),
      createdAt: postObj.createdAt || rawMsg.createdAt,
    };
  };

  const handlePressPostItem = (item: any) => {
    if (item.isUnavailable) {
      try {
        showPostUnavailableAlert(item?.postId || item?.id || item?._id);
      } catch {
        Alert.alert('Post Unavailable', 'This post is no longer available because it was deleted by the owner.');
      }
      return;
    }
    const fullPost = formatSharedPostItem(item);
    const targetPostId = fullPost.id || fullPost.postId;

    router.push({
      pathname: '/post-detail',
      params: {
        id: String(targetPostId),
        postId: String(targetPostId),
        initialData: encodeURIComponent(JSON.stringify(fullPost)),
      },
    } as any);
  };

  // Load and categorize shared content for this group conversation
  useEffect(() => {
    let isMounted = true;

    const isRealSharedPostMessage = (m: any): boolean => {
      if (!m) return false;
      const msgType = String(m.type || m.mediaType || '').toLowerCase();

      // Exclude story events, comments, replies, DMs, text messages, gallery photos/videos
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
      const targetCId = conversationId || groupId;
      if (!targetCId) return;
      setLoadingMedia(true);
      try {
        const res: any = await fetchMessages(targetCId, 100).catch(() => null);
        const msgs = Array.isArray(res) ? res : (res?.data || res?.messages || []);
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

          // Background hydrator: Fetch missing post images directly from API & detect deleted posts
          const missingItems = posts.filter(p => p.postId && p.postId !== 'undefined' && p.postId !== 'null');
          if (missingItems.length > 0) {
            Promise.all(
              missingItems.slice(0, 15).map(async (p) => {
                try {
                  const res: any = await apiService.get(`/posts/${p.postId}`, { suppressErrorLog: true }).catch(() => null);
                  if (res === null || res?.success === false || res?.status === 404 || res?.error) {
                    if (isMounted) {
                      setPostList(prev => prev.filter(item => item.id !== p.id && item.postId !== p.postId));
                    }
                  } else {
                    const fetchedPost = res?.data || res?.post || (res && res._id ? res : null);
                    if (fetchedPost && isMounted) {
                      const fetchedImg = getPostPrimaryImageUrl(fetchedPost);
                      if (fetchedImg) {
                        setPostList(prev => prev.map(item => {
                          if (item.id === p.id || item.postId === p.postId) {
                            return {
                              ...item,
                              mediaUrl: fetchedImg,
                              raw: {
                                ...item.raw,
                                sharedPost: {
                                  ...(item.raw?.sharedPost || {}),
                                  ...fetchedPost,
                                  imageUrl: fetchedImg,
                                  mediaUrl: fetchedImg,
                                }
                              }
                            };
                          }
                          return item;
                        }));
                      }
                    }
                  }
                } catch {}
              })
            );
          }
        }
      } catch (err) {
        console.warn('[group-info] Fetch media error:', err);
      } finally {
        if (isMounted) setLoadingMedia(false);
      }
    };

    fetchSharedContent();
    return () => {
      isMounted = false;
    };
  }, [conversationId, groupId]);

  const groupAvatarUri = useMemo(() => {
    if (rawAvatar && !isMissingOrDefaultAvatar(rawAvatar)) {
      return resolveAvatarUrl(rawAvatar);
    }
    return DEFAULT_AVATAR_URL;
  }, [rawAvatar]);

  useEffect(() => {
    let isMounted = true;

    const sanitizeString = (val: any): string => {
      if (!val) return '';
      let s = String(val).trim();
      s = s.replace(/^['"{\[\s]+|['"}\]\s]+$/g, '').trim();
      s = s.replace(/['"}\];,]+$/g, '').trim();
      if (s.startsWith('@')) s = s.slice(1).trim();
      return s;
    };

    const isValidUserToken = (token: string): boolean => {
      if (!token) return false;
      const low = token.toLowerCase();
      if (['null', 'undefined', 'object', '[object object]', 'true', 'false', 'none', 'user', 'unknown'].includes(low)) return false;
      if (/[{}'"\]\[\\;,:\s]/.test(token)) return false;
      return /^[a-zA-Z0-9_\-\.]{2,128}$/.test(token);
    };

    const loadMembers = async () => {
      const candidateMap = new Map<string, any>();
      const uidToKeyMap = new Map<string, string>();
      const usernameToKeyMap = new Map<string, string>();

      const addCandidate = (m: any) => {
        if (!m) return;
        const obj = typeof m === 'object' ? (m.user || m.author || m.sender || m.profile || m) : {};

        const rawUidCandidate = sanitizeString(
          typeof m === 'string'
            ? m
            : (m.uid || m._id || m.id || m.userId || m.senderId || m.user?._id || m.user?.id || m.user?.uid || '')
        );
        const rawIdCandidate = typeof m === 'object' ? sanitizeString(m._id || m.id || m.userId || '') : '';
        const rawUsernameCandidate = typeof m === 'object' ? sanitizeString(m.userName || m.username || m.senderUsername || obj.userName || obj.username || '') : '';

        const rawUid = isValidUserToken(rawUidCandidate) ? rawUidCandidate : '';
        const rawId = isValidUserToken(rawIdCandidate) ? rawIdCandidate : '';
        const rawUsername = isValidUserToken(rawUsernameCandidate) ? rawUsernameCandidate : '';

        if (!rawUid && !rawId && !rawUsername) {
          return;
        }

        const rawName = typeof m === 'object' ? (m.displayName || m.name || m.userDisplayName || m.senderDisplayName || obj.displayName || obj.name) : null;
        const cleanedName = rawName ? sanitizeString(rawName) : null;
        const avatar = typeof m === 'object' ? (m.photoURL || m.avatar || m.profilePicture || m.senderAvatar || m.userAvatar || obj.photoURL || obj.avatar || obj.profilePicture) : null;

        let matchedKey: string | null = null;
        if (rawUid) {
          if (uidToKeyMap.has(rawUid.toLowerCase())) matchedKey = uidToKeyMap.get(rawUid.toLowerCase())!;
        }
        if (!matchedKey && rawId) {
          if (uidToKeyMap.has(rawId.toLowerCase())) matchedKey = uidToKeyMap.get(rawId.toLowerCase())!;
        }
        if (!matchedKey && rawUsername) {
          if (usernameToKeyMap.has(rawUsername.toLowerCase())) matchedKey = usernameToKeyMap.get(rawUsername.toLowerCase())!;
        }

        const canonicalKey = matchedKey || (rawUsername ? `user:${rawUsername.toLowerCase()}` : (rawUid ? `uid:${rawUid.toLowerCase()}` : `id:${rawId.toLowerCase()}`));

        const existing = candidateMap.get(canonicalKey) || {};

        const mergedUid = existing.uid || rawUid || rawId || null;
        const mergedUsername = existing.userName || rawUsername || null;
        const mergedName = cleanedName || existing.displayName || null;
        const mergedAvatar = avatar || existing.photoURL || existing.avatar || null;

        const updatedCandidate = {
          uid: mergedUid,
          displayName: mergedName,
          userName: mergedUsername,
          photoURL: mergedAvatar,
          avatar: mergedAvatar,
        };

        candidateMap.set(canonicalKey, updatedCandidate);

        if (mergedUid) uidToKeyMap.set(String(mergedUid).toLowerCase(), canonicalKey);
        if (rawUid) uidToKeyMap.set(rawUid.toLowerCase(), canonicalKey);
        if (rawId) uidToKeyMap.set(rawId.toLowerCase(), canonicalKey);
        if (mergedUsername) usernameToKeyMap.set(mergedUsername.toLowerCase(), canonicalKey);
        if (rawUsername) usernameToKeyMap.set(rawUsername.toLowerCase(), canonicalKey);
      };

      // 1. Seed from params
      if ((params as any)?.members) {
        try {
          const parsed = typeof (params as any).members === 'string' ? JSON.parse((params as any).members) : (params as any).members;
          if (Array.isArray(parsed)) parsed.forEach(addCandidate);
        } catch {}
      }

      // 2. Fetch group chat from API if groupId exists
      const targetGroupId = groupId || conversationId;
      if (targetGroupId) {
        try {
          const res = await getGroupChat(targetGroupId).catch(() => null);
          const data: any = res;
          const apiMembers = data?.members || data?.participants || data?.userIds;
          if (Array.isArray(apiMembers)) {
            apiMembers.forEach(addCandidate);
          }
          if (data?.createdBy) {
            setAdminId(data.createdBy);
          }
        } catch {}
      }

      // 3. Ensure current user is present in group members
      if (currentUser || currentUserId || storeUserId) {
        addCandidate({
          uid: currentUserId || storeUserId || currentUser?.uid || currentUser?._id,
          _id: currentUser?._id || currentUser?.id,
          displayName: currentUser?.displayName || currentUser?.name || 'You',
          userName: currentUser?.userName || currentUser?.username,
          photoURL: currentUser?.photoURL || currentUser?.avatar,
          avatar: currentUser?.photoURL || currentUser?.avatar,
        });
      }

      // Format initial list
      const formatList = () => {
        const formattedMap = new Map<string, any>();
        Array.from(candidateMap.values()).forEach((candidate) => {
          const cleanUid = sanitizeString(candidate.uid);
          const cleanUname = sanitizeString(candidate.userName);

          if (!isValidUserToken(cleanUid) && !isValidUserToken(cleanUname)) {
            return;
          }

          const cached = cleanUid ? getCachedUserProfile(cleanUid) : null;
          const isSelf = checkIsSelf(candidate) || (cleanUid && myIds.has(cleanUid.toLowerCase())) || (cleanUname && myIds.has(cleanUname.toLowerCase()));

          let resolvedName = candidate.displayName || (cached?.name !== 'User' && cached?.name !== 'Unknown' ? (cached?.name || cached?.displayName) : null) || (isSelf ? 'You' : null);
          if (resolvedName) resolvedName = sanitizeString(resolvedName);

          const resolvedAvatar = candidate.photoURL || (cached?.avatar && !isMissingOrDefaultAvatar(cached.avatar) ? cached.avatar : null) || (cached?.photoURL && !isMissingOrDefaultAvatar(cached.photoURL) ? cached.photoURL : null);
          const resolvedUsername = cleanUname || sanitizeString(cached?.username);

          if (resolvedUsername && !isValidUserToken(resolvedUsername)) {
            return;
          }

          const item = {
            uid: cleanUid || resolvedUsername,
            displayName: resolvedName || (resolvedUsername ? `@${resolvedUsername}` : 'User'),
            userName: resolvedUsername || undefined,
            photoURL: resolvedAvatar || DEFAULT_AVATAR_URL,
            avatar: resolvedAvatar || DEFAULT_AVATAR_URL,
          };

          const finalKey = resolvedUsername
            ? `user:${resolvedUsername.toLowerCase()}`
            : (cleanUid ? `uid:${cleanUid.toLowerCase()}` : `item:${Math.random()}`);

          if (!formattedMap.has(finalKey)) {
            formattedMap.set(finalKey, item);
          }
        });
        return Array.from(formattedMap.values());
      };

      if (isMounted) {
        setGroupMembers(formatList());
        setLoading(false);
      }

      // Fetch user profile details in parallel
      const rawList = Array.from(candidateMap.values());
      if (rawList.length > 0) {
        await Promise.all(
          rawList.map(async (m: any) => {
            const uid = sanitizeString(typeof m === 'string' ? m : (m?.uid || m?._id || m?.id || m?.userId));
            if (!uid || !isValidUserToken(uid)) return;
            const cached = getCachedUserProfile(uid);
            if (cached && cached.name !== 'User' && !isMissingOrDefaultAvatar(cached.avatar)) {
              addCandidate(cached);
              return;
            }

            let p: any = null;
            try {
              const res: any = await apiService.get(`/users/${uid}`).catch(() => null);
              p = res?.data || res?.user || (res?.success ? res : null);
            } catch {}

            if (!p || (!p.displayName && !p.name && !p.username && !p.userName)) {
              try {
                const userRes: any = await getUserProfile(uid).catch(() => null);
                p = userRes?.data || userRes;
              } catch {}
            }

            if (p && typeof p === 'object') {
              const cleanDName = sanitizeString(p.displayName || p.name || p.userName || p.username);
              const cleanUName = sanitizeString(p.userName || p.username);
              if (cleanDName || cleanUName || p.photoURL || p.avatar || p.profilePicture) {
                cacheUserProfile({
                  uid,
                  displayName: cleanDName,
                  avatar: p.photoURL || p.avatar || p.profilePicture,
                  username: cleanUName,
                });
                addCandidate({
                  uid,
                  displayName: cleanDName,
                  userName: cleanUName,
                  photoURL: p.photoURL || p.avatar || p.profilePicture,
                });
              }
            }
          })
        );
        if (isMounted) {
          setGroupMembers(formatList());
        }
      }
    };

    loadMembers();

    return () => {
      isMounted = false;
    };
  }, [conversationId, groupId, currentUserId, storeUserId, currentUser]);

  const [groupName, setGroupName] = useState(rawGroupName);

  const handleEditGroupName = () => {
    if (Platform.OS === 'ios') {
      Alert.prompt(
        'Change Group Name',
        'Enter a new name for this group chat:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save',
            onPress: (text) => {
              if (text && text.trim()) {
                const updated = text.trim();
                setGroupName(updated);
                const targetId = groupId || conversationId;
                if (targetId) {
                  apiService.put(`/conversations/${targetId}`, { name: updated, groupName: updated }).catch(() => {});
                }
              }
            },
          },
        ],
        'plain-text',
        groupName
      );
    } else {
      Alert.alert('Group Name', `Current group name: "${groupName}". Name updates sync automatically across all members.`);
    }
  };

  // Calculate if current user is admin
  const isAdmin = useMemo(() => {
    if (!currentUserId && myIds.size === 0) return false;
    if (adminId && myIds.has(String(adminId).toLowerCase())) return true;
    if (adminId && currentUserId && String(adminId).toLowerCase() === String(currentUserId).toLowerCase()) return true;
    if (groupMembers.length > 0) {
      const firstMember = groupMembers[0];
      if (checkIsSelf(firstMember)) return true;
    }
    return false;
  }, [currentUserId, adminId, groupMembers, myIds]);

  return (
    <SafeAreaView style={styles.container}>
      {/* Navigation Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => safeRouterBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color="#000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Details</Text>
        <TouchableOpacity
          onPress={() => setShowOptionsModal(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ width: 40, alignItems: 'flex-end', justifyContent: 'center' }}
        >
          <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Group Profile Hero Header */}
        <View style={styles.heroSection}>
          <View style={styles.avatarWrap}>
            <ExpoImage
              source={{ uri: groupAvatarUri }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
          </View>
          <Text style={styles.groupName}>{groupName}</Text>
          <TouchableOpacity onPress={handleEditGroupName} style={{ paddingVertical: 4 }}>
            <Text style={styles.changeBtnText}>Change name & photo</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Action Circular Buttons (Mute, Add [Admin Only], Search, Options) */}
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionItem} onPress={() => toggleMuteMessages(!isMutedMessages)}>
            <View style={[styles.iconCircle, isMutedMessages && styles.iconCircleActive]}>
              <Ionicons
                name={isMutedMessages ? "notifications-off" : "notifications-outline"}
                size={22}
                color={isMutedMessages ? (COLORS.primary || "#FF6B00") : "#000"}
              />
            </View>
            <Text style={[styles.actionLabel, isMutedMessages && { color: (COLORS.primary || '#FF6B00') }]}>
              {isMutedMessages ? "Muted" : "Mute"}
            </Text>
          </TouchableOpacity>

          {isAdmin ? (
            <TouchableOpacity style={styles.actionItem} onPress={() => router.push('/new-group')}>
              <View style={styles.iconCircle}>
                <Ionicons name="person-add-outline" size={22} color="#000" />
              </View>
              <Text style={styles.actionLabel}>Add</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.actionItem}
            onPress={() => {
              router.push({
                pathname: '/dm',
                params: {
                  conversationId: conversationId || groupId || '',
                  groupId: groupId || conversationId || '',
                  groupName,
                  isGroup: '1',
                  searchMode: '1',
                }
              } as any);
            }}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="search-outline" size={22} color="#000" />
            </View>
            <Text style={styles.actionLabel}>Search</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionItem}
            activeOpacity={0.7}
            onPress={() => setShowOptionsModal(true)}
          >
            <View style={styles.iconCircle}>
              <Ionicons name="ellipsis-horizontal" size={22} color="#000" />
            </View>
            <Text style={styles.actionLabel}>Options</Text>
          </TouchableOpacity>
        </View>

        {/* Members Section */}
        <View style={{ paddingHorizontal: 16 }}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            <Text style={styles.sectionCount}>{groupMembers.length}</Text>
          </View>

          {/* Member Rows */}
          {loading ? (
            <ActivityIndicator size="small" color={COLORS.primary || "#FF6B00"} style={{ marginVertical: 20 }} />
          ) : (
            groupMembers.map((item, index) => {
              const targetUid = item.uid || item._id || item.id;
              const isSelf = checkIsSelf(item);
              const isItemAdmin = adminId
                ? (String(targetUid).toLowerCase() === String(adminId).toLowerCase() ||
                   String(item.userName || '').toLowerCase() === String(adminId).toLowerCase())
                : index === 0;
              return (
                <TouchableOpacity
                  key={targetUid || String(index)}
                  style={styles.memberRow}
                  onPress={() => {
                    if (targetUid) {
                      router.push({ pathname: '/user-profile', params: { uid: targetUid } } as any);
                    }
                  }}
                >
                  <UserAvatar
                    uri={item.photoURL || item.avatar || item.profilePicture}
                    name={item.displayName || item.userName || item.name}
                    size={44}
                    style={{ marginRight: 12 }}
                  />
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={styles.memberName}>
                        {item.displayName || item.userName || item.name || 'User'}
                        {isSelf ? <Text style={styles.selfTag}> (You)</Text> : null}
                      </Text>
                    </View>
                    {item.userName ? (
                      <Text style={styles.memberUsername}>@{item.userName}</Text>
                    ) : null}
                  </View>

                  {isItemAdmin ? (
                    <View style={styles.adminPill}>
                      <Text style={styles.adminPillText}>Admin</Text>
                    </View>
                  ) : null}

                  <Feather name="chevron-right" size={18} color="#ccc" />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Instagram 3-Tab Shared Content Section */}
        <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
          {/* Tab Header Bar: Gallery Media, Posts/Reels, Links */}
          <View style={styles.tabHeaderContainer}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'media' && styles.tabButtonActive]}
              onPress={() => setActiveTab('media')}
              activeOpacity={0.7}
            >
              <Ionicons
                name="images-outline"
                size={24}
                color={activeTab === 'media' ? '#000000' : '#8E8E93'}
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
                color={activeTab === 'posts' ? '#000000' : '#8E8E93'}
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
                color={activeTab === 'links' ? '#000000' : '#8E8E93'}
              />
            </TouchableOpacity>
          </View>

          {/* Tab Content Display */}
          {loadingMedia ? (
            <ActivityIndicator size="small" color={COLORS.primary || "#FF6B00"} style={{ marginVertical: 24 }} />
          ) : activeTab === 'media' ? (
            mediaList.length > 0 ? (
              <View style={styles.tabMediaGrid}>
                {mediaList.map((item, index) => (
                  <TouchableOpacity
                    key={item.id || String(index)}
                    style={styles.tabMediaThumbWrap}
                    onPress={() => setSelectedMediaItem(item)}
                    activeOpacity={0.8}
                  >
                    <ExpoImage
                      source={{ uri: getMediaThumbnail(item) }}
                      style={styles.tabMediaThumb}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                    />
                    {item.isVideo ? (
                      <View style={styles.playBadge}>
                        <Ionicons name="play" size={14} color="#FFFFFF" />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyTabState}>
                <Ionicons name="images-outline" size={32} color="#C7C7CC" />
                <Text style={styles.emptyTabTitle}>No Photos or Videos</Text>
                <Text style={styles.emptyTabSub}>Photos and videos shared in this group chat will appear here.</Text>
              </View>
            )
          ) : activeTab === 'posts' ? (
            postList.filter(i => !i.isUnavailable).length > 0 ? (
              <View style={styles.tabMediaGrid}>
                {postList.filter(i => !i.isUnavailable).map((item, index) => {
                  const thumb = getMediaThumbnail(item);
                  const postObj = item.raw?.sharedPost || item.raw?.sharedStory || item.raw?.postMetadata || item.raw || {};
                  const captionText = postObj.caption || postObj.text || item.raw?.text || '';

                  return (
                    <TouchableOpacity
                      key={item.id || String(index)}
                      style={styles.tabMediaThumbWrap}
                      onPress={() => handlePressPostItem(item)}
                      activeOpacity={0.8}
                    >
                      {thumb ? (
                        <ExpoImage
                          source={{ uri: thumb }}
                          style={styles.tabMediaThumb}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                      ) : (
                        <View style={styles.textPostThumbContainer}>
                          <Ionicons name="document-text-outline" size={22} color={COLORS.primary || "#FF6B00"} style={{ marginBottom: 4 }} />
                          <Text style={styles.textPostThumbCaption} numberOfLines={3}>
                            {captionText || 'Shared Post'}
                          </Text>
                        </View>
                      )}
                      {item.isVideo ? (
                        <View style={styles.playBadge}>
                          <Ionicons name="play" size={14} color="#FFFFFF" />
                        </View>
                      ) : (
                        <View style={styles.postBadge}>
                          <Ionicons name="repeat" size={12} color="#FFFFFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyTabState}>
                <Ionicons name="repeat-outline" size={32} color="#C7C7CC" />
                <Text style={styles.emptyTabTitle}>No Shared Posts</Text>
                <Text style={styles.emptyTabSub}>Posts and reels shared in this group chat will appear here.</Text>
              </View>
            )
          ) : (
            linkList.length > 0 ? (
              <View style={styles.linksContainer}>
                {linkList.map((item, index) => (
                  <TouchableOpacity
                    key={item.id || String(index)}
                    style={styles.linkRow}
                    onPress={() => handleOpenLink(item.url)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.linkIconCircle}>
                      <Ionicons name="link" size={18} color={COLORS.primary || "#FF6B00"} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.linkDomain} numberOfLines={1}>
                        {item.domain}
                      </Text>
                      <Text style={styles.linkUrl} numberOfLines={1}>
                        {item.url}
                      </Text>
                    </View>
                    <Ionicons name="open-outline" size={16} color="#8E8E93" />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyTabState}>
                <Ionicons name="link-outline" size={32} color="#C7C7CC" />
                <Text style={styles.emptyTabTitle}>No Shared Links</Text>
                <Text style={styles.emptyTabSub}>Web links shared in this group chat will appear here.</Text>
              </View>
            )
          )}
        </View>
      </ScrollView>

      {/* Fullscreen Media Viewer Modal */}
      <Modal
        visible={!!selectedMediaItem}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setSelectedMediaItem(null)}
        statusBarTranslucent
      >
        <View style={styles.fullMediaOverlay}>
          {/* Top Floating Close Button */}
          <SafeAreaView style={styles.fullMediaHeader}>
            <TouchableOpacity
              onPress={() => setSelectedMediaItem(null)}
              style={styles.closeFullMediaBtn}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </SafeAreaView>

          {/* Tap anywhere on backdrop to close */}
          <Pressable style={styles.fullMediaBackdrop} onPress={() => setSelectedMediaItem(null)}>
            {selectedMediaItem ? (
              <View style={styles.fullMediaContentWrap} onStartShouldSetResponder={() => true}>
                {selectedMediaItem.isVideo ? (
                  <Video
                    source={{ uri: resolveAvatarUrl(selectedMediaItem.mediaUrl) }}
                    style={styles.fullMediaVideo}
                    useNativeControls
                    resizeMode={ResizeMode.CONTAIN}
                    shouldPlay
                  />
                ) : (
                  <ExpoImage
                    source={{ uri: resolveAvatarUrl(selectedMediaItem.mediaUrl) }}
                    style={styles.fullMediaImage}
                    contentFit="contain"
                  />
                )}
              </View>
            ) : null}
          </Pressable>
        </View>
      </Modal>

      {/* 3-Dots Privacy & Support Modal Sheet */}
      <Modal visible={showOptionsModal} transparent animationType="fade" onRequestClose={() => setShowOptionsModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowOptionsModal(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalSheetTitle}>Privacy & Support</Text>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => handleClearChat()}>
              <Ionicons name="trash-outline" size={20} color="#ef4444" style={{ marginRight: 12 }} />
              <Text style={[styles.sheetBtnText, { color: '#ef4444' }]}>Clear chat history</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sheetBtn} onPress={() => handleLeaveChat()}>
              <Ionicons name="log-out-outline" size={20} color="#ef4444" style={{ marginRight: 12 }} />
              <Text style={[styles.sheetBtnText, { color: '#ef4444' }]}>Leave chat</Text>
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
  container: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#000',
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  avatarWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    marginBottom: 14,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  groupName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
    textAlign: 'center',
  },
  changeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary || '#FF6B00',
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 36,
    paddingVertical: 14,
    marginBottom: 16,
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
    color: '#000',
    fontWeight: '500',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  sectionCount: {
    fontSize: 14,
    color: '#8e8e93',
    fontWeight: '500',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  selfTag: {
    fontSize: 13,
    color: '#8e8e93',
    fontWeight: '500',
  },
  memberUsername: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 1,
  },
  adminPill: {
    backgroundColor: '#f2f2f2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 8,
  },
  adminPillText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  settingsSection: {
    marginTop: 24,
    paddingTop: 16,
    paddingHorizontal: 16,
  },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  leaveBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF3B30',
  },
  tabHeaderContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#000000',
  },
  tabMediaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
  },
  tabMediaThumbWrap: {
    width: '32.5%',
    aspectRatio: 1,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
    position: 'relative',
  },
  tabMediaThumb: {
    width: '100%',
    height: '100%',
  },
  playBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTabState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
  },
  emptyTabTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#262626',
    marginTop: 8,
  },
  emptyTabSub: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
  },
  linksContainer: {
    paddingHorizontal: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#F0F0F0',
  },
  linkIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFF0E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  linkDomain: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  linkUrl: {
    fontSize: 12,
    color: COLORS.primary || '#FF6B00',
    marginTop: 2,
  },
  fullMediaOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  fullMediaHeader: {
    position: 'absolute',
    top: 40,
    right: 16,
    zIndex: 9999,
    alignItems: 'flex-end',
  },
  closeFullMediaBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullMediaBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  fullMediaContentWrap: {
    width: '100%',
    height: '82%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullMediaImage: {
    width: '100%',
    height: '100%',
  },
  fullMediaVideo: {
    width: '100%',
    height: '100%',
  },
  textPostThumbContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F2F4F7',
    borderRadius: 6,
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EAECF0',
  },
  textPostThumbCaption: {
    fontSize: 10,
    fontWeight: '600',
    color: '#344054',
    textAlign: 'center',
    lineHeight: 13,
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
    color: '#000000',
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
    color: '#1f2937',
    textAlign: 'center',
  },
});
