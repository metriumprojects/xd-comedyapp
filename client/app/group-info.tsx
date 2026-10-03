import React, { useEffect, useState, useMemo, useCallback } from 'react';
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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image as ExpoImage } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { safeRouterBack } from '@/lib/safeRouterBack';
import { resolveAvatarUrl, isMissingOrDefaultAvatar } from '@/lib/utils/avatar';
import { DEFAULT_AVATAR_URL, getCdnUrl } from '@/lib/api';
import { uploadImage } from '@/lib/firebaseHelpers';
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

  useEffect(() => {
    if (!currentUserId) {
      AsyncStorage.getItem('userId').then(id => {
        if (id) setCurrentUserId(id);
      }).catch(() => {});
    }
  }, [currentUserId]);

  const [myIds, setMyIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (storeUserId) s.add(String(storeUserId).trim().toLowerCase());
    if (storeUserProfile?.id) s.add(String(storeUserProfile.id).trim().toLowerCase());
    if (storeUserProfile?._id) s.add(String(storeUserProfile._id).trim().toLowerCase());
    if (storeUserProfile?.uid) s.add(String(storeUserProfile.uid).trim().toLowerCase());
    if (storeUserProfile?.userId) s.add(String(storeUserProfile.userId).trim().toLowerCase());
    if (storeUserProfile?.username) s.add(String(storeUserProfile.username).trim().toLowerCase());
    if (storeUserProfile?.userName) s.add(String(storeUserProfile.userName).trim().toLowerCase());
    return s;
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = new Set<string>();
      if (storeUserId) ids.add(String(storeUserId).trim().toLowerCase());
      if (currentUserId) ids.add(String(currentUserId).trim().toLowerCase());
      if (currentUser?.id) ids.add(String(currentUser.id).trim().toLowerCase());
      if (currentUser?._id) ids.add(String(currentUser._id).trim().toLowerCase());
      if (currentUser?.uid) ids.add(String(currentUser.uid).trim().toLowerCase());
      if (currentUser?.userId) ids.add(String(currentUser.userId).trim().toLowerCase());
      if (currentUser?.username) ids.add(String(currentUser.username).trim().toLowerCase());
      if (currentUser?.userName) ids.add(String(currentUser.userName).trim().toLowerCase());

      try {
        const [uid, userId, token, userStr] = await Promise.all([
          AsyncStorage.getItem('uid'),
          AsyncStorage.getItem('userId'),
          AsyncStorage.getItem('token'),
          AsyncStorage.getItem('user'),
        ]);
        if (uid) ids.add(String(uid).trim().toLowerCase());
        if (userId) ids.add(String(userId).trim().toLowerCase());
        if (token) {
          try {
            const parts = String(token).split('.');
            if (parts.length >= 2) {
              const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              const json = typeof atob === 'function' ? JSON.parse(atob(b64)) : null;
              if (json?.userId) ids.add(String(json.userId).trim().toLowerCase());
              if (json?.firebaseUid) ids.add(String(json.firebaseUid).trim().toLowerCase());
              if (json?.uid) ids.add(String(json.uid).trim().toLowerCase());
            }
          } catch {}
        }
        if (userStr) {
          try {
            const u = JSON.parse(userStr);
            if (u?._id) ids.add(String(u._id).trim().toLowerCase());
            if (u?.id) ids.add(String(u.id).trim().toLowerCase());
            if (u?.uid) ids.add(String(u.uid).trim().toLowerCase());
            if (u?.firebaseUid) ids.add(String(u.firebaseUid).trim().toLowerCase());
            if (u?.username) ids.add(String(u.username).trim().toLowerCase());
            if (u?.userName) ids.add(String(u.userName).trim().toLowerCase());
          } catch {}
        }
        try {
          const canon = await resolveCanonicalUserId();
          if (canon) ids.add(String(canon).trim().toLowerCase());
        } catch {}
      } catch {}

      if (!cancelled && ids.size > 0) {
        setMyIds(prev => {
          const next = new Set(prev);
          ids.forEach(id => next.add(id));
          return next;
        });
      }
    })();
    return () => { cancelled = true; };
  }, [storeUserId, currentUserId, currentUser]);

  const checkIsSelf = useCallback((item: any): boolean => {
    if (!item) return false;
    if (item.isSelf === true) return true;
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
  }, [myIds]);

  const conversationId = String((params as any)?.conversationId || '').trim();
  const groupId = String((params as any)?.groupId || '').trim();
  const rawGroupName = String((params as any)?.groupName || (params as any)?.name || (params as any)?.title || 'Group Chat').trim();
  const rawAvatar = String((params as any)?.avatar || (params as any)?.groupAvatar || '').trim();

  const [groupAvatar, setGroupAvatar] = useState(rawAvatar);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [editGroupNameInput, setEditGroupNameInput] = useState(rawGroupName);
  const [savingGroupName, setSavingGroupName] = useState(false);

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

  const [adminIds, setAdminIds] = useState<Set<string>>(() => {
    const s = new Set<string>();
    const pAdmin = (params as any)?.adminId || (params as any)?.createdBy;
    if (pAdmin) s.add(String(pAdmin).toLowerCase());
    try {
      const parsedAdmins = (params as any)?.groupAdminIds ? JSON.parse((params as any).groupAdminIds) : null;
      if (Array.isArray(parsedAdmins)) {
        parsedAdmins.forEach((id: any) => id && s.add(String(id).toLowerCase()));
      }
    } catch {}
    return s;
  });

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
    if (groupAvatar && !isMissingOrDefaultAvatar(groupAvatar)) {
      return resolveAvatarUrl(groupAvatar);
    }
    return DEFAULT_AVATAR_URL;
  }, [groupAvatar]);

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

        const isCandidateSelf = Boolean(
          m?.isSelf ||
          checkIsSelf(m) ||
          (rawUid && myIds.has(rawUid.toLowerCase())) ||
          (rawId && myIds.has(rawId.toLowerCase())) ||
          (rawUsername && myIds.has(rawUsername.toLowerCase()))
        );

        if (!rawUid && !rawId && !rawUsername && !isCandidateSelf) {
          return;
        }

        const rawName = typeof m === 'object' ? (m.displayName || m.name || m.userDisplayName || m.senderDisplayName || obj.displayName || obj.name) : null;
        const cleanedName = rawName ? sanitizeString(rawName) : null;
        const avatar = typeof m === 'object' ? (m.photoURL || m.avatar || m.profilePicture || m.senderAvatar || m.userAvatar || obj.photoURL || obj.avatar || obj.profilePicture) : null;

        let matchedKey: string | null = null;
        if (isCandidateSelf) {
          matchedKey = 'self';
        } else {
          if (rawUid && uidToKeyMap.has(rawUid.toLowerCase())) matchedKey = uidToKeyMap.get(rawUid.toLowerCase())!;
          if (!matchedKey && rawId && uidToKeyMap.has(rawId.toLowerCase())) matchedKey = uidToKeyMap.get(rawId.toLowerCase())!;
          if (!matchedKey && rawUsername && usernameToKeyMap.has(rawUsername.toLowerCase())) matchedKey = usernameToKeyMap.get(rawUsername.toLowerCase())!;
        }

        const canonicalKey = matchedKey || (rawUid ? `uid:${rawUid.toLowerCase()}` : (rawId ? `id:${rawId.toLowerCase()}` : `user:${rawUsername.toLowerCase()}`));

        const existing = candidateMap.get(canonicalKey) || {};

        const mergedUid = existing.uid || rawUid || rawId || (isCandidateSelf ? (currentUserId || 'self') : null);
        const mergedUsername = existing.userName || rawUsername || null;
        const mergedName = (cleanedName && cleanedName !== 'User' && cleanedName !== 'Unknown') ? cleanedName : (existing.displayName || cleanedName || null);
        const mergedAvatar = (avatar && !isMissingOrDefaultAvatar(avatar)) ? avatar : (existing.photoURL || existing.avatar || avatar || null);

        const updatedCandidate = {
          uid: mergedUid,
          displayName: mergedName,
          userName: mergedUsername,
          photoURL: mergedAvatar,
          avatar: mergedAvatar,
          isSelf: isCandidateSelf || existing.isSelf || false,
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

      // 2. Fetch group chat / conversation details from API
      const targetGroupId = groupId || conversationId;
      if (targetGroupId) {
        try {
          const res: any = await apiService.get(`/conversations/${targetGroupId}`).catch(() => null);
          const data: any = res?.data || res;
          const apiMembers = data?.members || data?.participants || data?.userIds;
          if (Array.isArray(apiMembers)) {
            apiMembers.forEach(addCandidate);
          }
          if (Array.isArray(data?.groupAdminIds) && data.groupAdminIds.length > 0) {
            setAdminIds((prev) => {
              const next = new Set(prev);
              data.groupAdminIds.forEach((aid: any) => aid && next.add(String(aid).toLowerCase()));
              return next;
            });
            setAdminId(String(data.groupAdminIds[0]));
          } else if (data?.createdBy) {
            setAdminId(String(data.createdBy));
            setAdminIds((prev) => new Set([...prev, String(data.createdBy).toLowerCase()]));
          }
          if (data?.groupAvatar || data?.avatar) {
            setGroupAvatar(data.groupAvatar || data.avatar);
          }
          if (data?.groupName) {
            setGroupName(data.groupName);
            setEditGroupNameInput(data.groupName);
          }
        } catch {}
      }

      // 3. Ensure current user is present in group members
      const resolvedMyId = currentUserId || storeUserId || (await resolveCanonicalUserId().catch(() => null));
      const myProfile = currentUser || storeUserProfile || (resolvedMyId ? getCachedUserProfile(resolvedMyId) : null);
      addCandidate({
        uid: resolvedMyId || myProfile?.uid || myProfile?._id,
        _id: resolvedMyId || myProfile?._id || myProfile?.id,
        displayName: myProfile?.displayName || myProfile?.name || 'You',
        userName: myProfile?.userName || myProfile?.username,
        photoURL: myProfile?.photoURL || myProfile?.avatar || myProfile?.profilePicture,
        avatar: myProfile?.photoURL || myProfile?.avatar || myProfile?.profilePicture,
        isSelf: true,
      });

      // Format initial list
      const formatList = () => {
        const formattedMap = new Map<string, any>();
        Array.from(candidateMap.values()).forEach((candidate) => {
          const cleanUid = sanitizeString(candidate.uid);
          let cleanUname = sanitizeString(candidate.userName);

          const isSelf = Boolean(
            candidate.isSelf ||
            checkIsSelf(candidate) ||
            (cleanUid && myIds.has(cleanUid.toLowerCase())) ||
            (cleanUname && myIds.has(cleanUname.toLowerCase()))
          );

          if (!isSelf && !isValidUserToken(cleanUid) && !isValidUserToken(cleanUname)) {
            return;
          }

          if (cleanUname && !isValidUserToken(cleanUname)) {
            cleanUname = '';
          }

          const cached = cleanUid ? getCachedUserProfile(cleanUid) : null;

          let resolvedName = candidate.displayName || (cached?.name !== 'User' && cached?.name !== 'Unknown' ? (cached?.name || cached?.displayName) : null);
          if (isSelf && (!resolvedName || resolvedName === 'User' || resolvedName === 'Unknown')) {
            resolvedName = currentUser?.displayName || currentUser?.name || storeUserProfile?.displayName || storeUserProfile?.name || 'You';
          }
          if (resolvedName) resolvedName = sanitizeString(resolvedName);

          const resolvedAvatar = candidate.photoURL || (cached?.avatar && !isMissingOrDefaultAvatar(cached.avatar) ? cached.avatar : null) || (cached?.photoURL && !isMissingOrDefaultAvatar(cached.photoURL) ? cached.photoURL : null) || (isSelf ? (currentUser?.avatar || currentUser?.photoURL) : null);
          const resolvedUsername = cleanUname || sanitizeString(cached?.username) || (isSelf ? (currentUser?.username || currentUser?.userName) : '');

          const finalUsername = (resolvedUsername && isValidUserToken(resolvedUsername)) ? resolvedUsername : undefined;

          const item = {
            uid: cleanUid || (isSelf ? (currentUserId || 'self') : (finalUsername || String(Math.random()))),
            displayName: resolvedName || (isSelf ? 'You' : (finalUsername ? `@${finalUsername}` : 'User')),
            userName: finalUsername,
            photoURL: resolvedAvatar || DEFAULT_AVATAR_URL,
            avatar: resolvedAvatar || DEFAULT_AVATAR_URL,
            isSelf,
          };

          const finalKey = isSelf
            ? 'self'
            : (cleanUid ? `uid:${cleanUid.toLowerCase()}` : (finalUsername ? `user:${finalUsername.toLowerCase()}` : `item:${Math.random()}`));

          if (formattedMap.has(finalKey)) {
            const existing = formattedMap.get(finalKey);
            formattedMap.set(finalKey, {
              ...existing,
              ...item,
              displayName: (existing.displayName && existing.displayName !== 'User' && existing.displayName !== 'You') ? existing.displayName : item.displayName,
              photoURL: (existing.photoURL && existing.photoURL !== DEFAULT_AVATAR_URL) ? existing.photoURL : item.photoURL,
              avatar: (existing.avatar && existing.avatar !== DEFAULT_AVATAR_URL) ? existing.avatar : item.avatar,
              isSelf: existing.isSelf || isSelf,
            });
          } else {
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
            const isSelf = Boolean(m?.isSelf || checkIsSelf(m));
            const cached = getCachedUserProfile(uid);
            if (cached && cached.name !== 'User' && !isMissingOrDefaultAvatar(cached.avatar)) {
              addCandidate({ ...cached, isSelf });
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
                  isSelf,
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
  }, [conversationId, groupId, currentUserId, storeUserId, currentUser, myIds, checkIsSelf]);

  // Sync member updates from /group-members screen
  useEffect(() => {
    const handleMembersUpdated = (data: any) => {
      const targetId = groupId || conversationId;
      if (
        data?.conversationId &&
        (data.conversationId === targetId ||
          data.conversationId === groupId ||
          data.conversationId === conversationId)
      ) {
        if (Array.isArray(data.members)) {
          setGroupMembers(data.members);
        }
        if (Array.isArray(data.adminIds)) {
          setAdminIds(new Set(data.adminIds.map((x: any) => String(x).toLowerCase())));
          if (data.adminIds.length > 0) setAdminId(String(data.adminIds[0]));
        }
      }
    };

    const sub = (feedEventEmitter as any).addListener('groupMembersUpdated', handleMembersUpdated);
    return () => {
      if (typeof sub?.remove === 'function') sub.remove();
      else (feedEventEmitter as any).removeListener?.('groupMembersUpdated', handleMembersUpdated);
    };
  }, [groupId, conversationId]);

  const [groupName, setGroupName] = useState(rawGroupName);

  // Pick group photo from gallery or camera
  const handlePickPhoto = async (fromCamera = false) => {
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only group admins can change the group photo.');
      return;
    }

    try {
      const permission = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permission Required', `Please allow access to your ${fromCamera ? 'camera' : 'photos'} to change group picture.`);
        return;
      }

      const result = fromCamera
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.85,
          });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const localUri = result.assets[0].uri;
        setGroupAvatar(localUri); // Instant local preview
        setUploadingAvatar(true);
        setShowEditGroupModal(false);

        const targetId = groupId || conversationId;
        const uploadResult = await uploadImage(localUri, `groups/${targetId || 'avatar'}`);

        if (uploadResult && uploadResult.success && uploadResult.url) {
          const remoteUrl = uploadResult.url;
          setGroupAvatar(remoteUrl);

          if (targetId) {
            await apiService.put(`/conversations/${targetId}`, {
              groupAvatar: remoteUrl,
              avatar: remoteUrl,
            }).catch(() => {});

            feedEventEmitter.emit('groupDetailsUpdated', {
              conversationId: targetId,
              groupAvatar: remoteUrl,
              groupName,
            });
            (feedEventEmitter as any).emit('feedUpdated');
          }

          Alert.alert('Success', 'Group photo updated successfully!');
        } else {
          throw new Error(uploadResult?.error || 'Failed to upload photo');
        }
      }
    } catch (err: any) {
      console.warn('[group-info] Photo picker error:', err);
      Alert.alert('Error', err?.message || 'Could not update group photo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Save new group name
  const handleSaveGroupName = async () => {
    const trimmed = editGroupNameInput.trim();
    if (!trimmed) {
      Alert.alert('Invalid Name', 'Group name cannot be empty.');
      return;
    }
    if (!isAdmin) {
      Alert.alert('Permission Denied', 'Only group admins can change the group name.');
      return;
    }

    setSavingGroupName(true);
    const targetId = groupId || conversationId;
    try {
      if (targetId) {
        await apiService.put(`/conversations/${targetId}`, {
          name: trimmed,
          groupName: trimmed,
        });

        setGroupName(trimmed);
        setShowEditGroupModal(false);

        feedEventEmitter.emit('groupDetailsUpdated', {
          conversationId: targetId,
          groupAvatar,
          groupName: trimmed,
        });
        (feedEventEmitter as any).emit('feedUpdated');

        Alert.alert('Success', 'Group name updated successfully!');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || err?.message || 'Failed to update group name.');
    } finally {
      setSavingGroupName(false);
    }
  };

  // Calculate if current user is admin
  const isAdmin = useMemo(() => {
    if (!currentUserId && myIds.size === 0) return false;
    for (const myId of myIds) {
      if (adminIds.has(myId)) return true;
    }
    if (adminId && myIds.has(String(adminId).toLowerCase())) return true;
    if (adminId && currentUserId && String(adminId).toLowerCase() === String(currentUserId).toLowerCase()) return true;
    return false;
  }, [currentUserId, adminId, adminIds, myIds]);

  const sortedMembers = useMemo(() => {
    return [...groupMembers].sort((a, b) => {
      const aSelf = Boolean(a.isSelf || checkIsSelf(a));
      const bSelf = Boolean(b.isSelf || checkIsSelf(b));
      if (aSelf && !bSelf) return -1;
      if (!aSelf && bSelf) return 1;
      return 0;
    });
  }, [groupMembers, checkIsSelf]);

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
        {/* Spacer to keep Details centered without duplicate 3-dots menu */}
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Group Profile Hero Header */}
        <View style={styles.heroSection}>
          <TouchableOpacity
            style={styles.avatarWrap}
            activeOpacity={isAdmin ? 0.7 : 1}
            onPress={isAdmin ? () => {
              setEditGroupNameInput(groupName);
              setShowEditGroupModal(true);
            } : undefined}
          >
            <ExpoImage
              source={{ uri: groupAvatarUri }}
              style={styles.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            {uploadingAvatar ? (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            ) : isAdmin ? (
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={15} color="#FFFFFF" />
              </View>
            ) : null}
          </TouchableOpacity>

          <Text style={styles.groupName}>{groupName}</Text>
          {isAdmin ? (
            <TouchableOpacity
              onPress={() => {
                setEditGroupNameInput(groupName);
                setShowEditGroupModal(true);
              }}
              style={{ paddingVertical: 4 }}
            >
              <Text style={styles.changeBtnText}>Change name & photo</Text>
            </TouchableOpacity>
          ) : null}
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

        {/* Members Bar Row (Navigates to dedicated /group-members screen) */}
        <View style={{ paddingHorizontal: 16, marginTop: 8, marginBottom: 12 }}>
          <TouchableOpacity
            style={styles.membersBarCard}
            activeOpacity={0.7}
            onPress={() => {
              router.push({
                pathname: '/group-members',
                params: {
                  conversationId: conversationId || groupId || '',
                  groupId: groupId || conversationId || '',
                  groupName,
                  adminId: adminId || '',
                  groupAdminIds: JSON.stringify(Array.from(adminIds)),
                  members: JSON.stringify(groupMembers),
                  isAdmin: isAdmin ? '1' : '0',
                },
              } as any);
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.membersBarIconWrap}>
                <Ionicons name="people" size={20} color="#000" />
              </View>
              <Text style={styles.membersBarTitle}>Members</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.membersBarCountText}>
                {loading ? '...' : `${sortedMembers.length} ${sortedMembers.length === 1 ? 'member' : 'members'}`}
              </Text>
              <Feather name="chevron-right" size={20} color="#8E8E93" style={{ marginLeft: 6 }} />
            </View>
          </TouchableOpacity>
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

      {/* Edit Group Name & Photo Modal Sheet */}
      <Modal
        visible={showEditGroupModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEditGroupModal(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowEditGroupModal(false)}>
          <Pressable style={styles.modalSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHandle} />
            <Text style={styles.editModalTitle}>Edit Group</Text>

            {/* Photo preview & actions */}
            <View style={styles.editAvatarSection}>
              <View style={styles.editAvatarWrap}>
                <ExpoImage
                  source={{ uri: groupAvatarUri }}
                  style={styles.editAvatarImg}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                {uploadingAvatar && (
                  <View style={styles.avatarLoadingOverlay}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  </View>
                )}
              </View>

              <View style={styles.photoActionButtonsRow}>
                <TouchableOpacity
                  style={styles.photoActionBtn}
                  onPress={() => handlePickPhoto(false)}
                  disabled={uploadingAvatar}
                >
                  <Ionicons name="images-outline" size={18} color="#000" style={{ marginRight: 6 }} />
                  <Text style={styles.photoActionBtnText}>Choose Photo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.photoActionBtn}
                  onPress={() => handlePickPhoto(true)}
                  disabled={uploadingAvatar}
                >
                  <Ionicons name="camera-outline" size={18} color="#000" style={{ marginRight: 6 }} />
                  <Text style={styles.photoActionBtnText}>Take Photo</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.editModalDivider} />

            {/* Group Name Field */}
            <Text style={styles.editFieldLabel}>Group Name</Text>
            <View style={styles.editInputWrap}>
              <TextInput
                style={styles.editTextInput}
                value={editGroupNameInput}
                onChangeText={setEditGroupNameInput}
                placeholder="Enter group name"
                placeholderTextColor="#8E8E93"
                maxLength={50}
              />
              {editGroupNameInput ? (
                <TouchableOpacity onPress={() => setEditGroupNameInput('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={18} color="#8E8E93" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Save Button */}
            <TouchableOpacity
              style={[styles.editSaveBtn, savingGroupName && { opacity: 0.7 }]}
              onPress={handleSaveGroupName}
              disabled={savingGroupName}
            >
              {savingGroupName ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.editSaveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.editCancelBtn}
              onPress={() => setShowEditGroupModal(false)}
            >
              <Text style={styles.editCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
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
    width: 88,
    height: 88,
    borderRadius: 44,
    marginBottom: 14,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primary || '#FF6B00',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 44,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editModalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 16,
  },
  editAvatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  editAvatarWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
    backgroundColor: '#F0F0F0',
    marginBottom: 14,
    position: 'relative',
  },
  editAvatarImg: {
    width: 90,
    height: 90,
  },
  photoActionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  photoActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 18,
  },
  photoActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },
  editModalDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginVertical: 14,
  },
  editFieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginBottom: 18,
  },
  editTextInput: {
    flex: 1,
    fontSize: 16,
    color: '#000000',
    paddingVertical: 0,
  },
  editSaveBtn: {
    backgroundColor: COLORS.primary || '#FF6B00',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  editSaveBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  editCancelBtn: {
    backgroundColor: '#F2F2F7',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  editCancelBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
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
  membersBarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F9FA',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ECECEC',
  },
  membersBarIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EAEAEA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  membersBarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  membersBarCountText: {
    fontSize: 14,
    color: '#8E8E93',
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
