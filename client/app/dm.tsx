import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@/lib/storage';
import * as FileSystem from 'expo-file-system';
import {
  deleteMessage,
  editMessage,
  fetchMessages,
  getOrCreateConversation,
  getUserProfile,
  markConversationAsRead,
  reactToMessage,
  sendMessage,
  clearConversation,
} from '../lib/firebaseHelpers/index';
import { safeRouterBack } from '@/lib/safeRouterBack';
import { cacheUserProfile, getCachedUserProfile, useUserProfile } from '@/hooks/useUserProfile';
import { resolveAvatarUrl, isMissingOrDefaultAvatar } from '@/lib/utils/avatar';
import {
  toTimestampMs,
  normalizeMessage,
  mergeMessages,
  createTempId,
  dedupeById,
  getMessageId,
  clearConversationCaches,
} from '../src/_services/dmHelpers';
import { apiService } from '../src/_services/apiService';
import { useAppStore } from '@/store/useAppStore';
import DMHeader from '../src/_components/dm/DMHeader';
import DMInput from '../src/_components/dm/DMInput';
import SwipeableMessageRow from '../src/_components/dm/SwipeableMessageRow';
import DMMediaPreviewModal from '../src/_components/dm/DMMediaPreviewModal';
import DMImageViewerModal from '../src/_components/dm/DMImageViewerModal';
import DMReactionsModal from '../src/_components/dm/DMReactionsModal';
import { isUserBlockedLocally, fetchBlockedUserIds, removeBlockedUserId, addBlockedUserId } from '@/services/moderation';
import { feedEventEmitter } from '../lib/feedEventEmitter';
import { patchInboxLastMessage } from '../src/_services/inboxCache';
import NetInfo from '@react-native-community/netinfo';
import {
  enqueueOfflineMessage,
  isNetworkError,
  processOfflineQueue,
  getOfflineOutbox,
  getCachedIsOnline,
} from '../src/_services/dmOfflineQueue';
import { userService } from '@/lib/userService';
import { resolveCanonicalUserId } from '@/lib/currentUser';
import { compressVideoSafe, compressImageSafe } from '../lib/mediaUtils';
import { DEFAULT_AVATAR_URL } from '@/lib/api';
import { useAppDialog } from '@/src/_components/AppDialogProvider';
import { useDM } from '../hooks/useDM';
import { useDMMedia } from '../hooks/useDMMedia';
import { normalizeMediaUrl } from '../lib/utils/media';
import COLORS from '@/src/theme/colors';
import {
  subscribeToMessages as socketSubscribeToMessages,
  sendTypingIndicator,
  stopTypingIndicator,
} from '../src/_services/socketService';

import MessageBubble from '../src/_components/MessageBubble';

// Heavy surfaces: lazy-loaded so DM first paint stays ultra fast
const ShareModal = React.lazy(() => import('../src/_components/ShareModal'));
const StoriesViewer = React.lazy(() => import('../src/_components/StoriesViewer'));
const EmojiPicker = React.lazy(() => import('rn-emoji-keyboard').then((m) => ({ default: m.default || m })));

// Missing exports from messaging helpers that were used in dm.tsx
import {
  uploadMedia,
  sendMediaMessage as sendMediaMessageApi,
} from '../lib/firebaseHelpers/messages';

import {
  subscribeToUserStatus as socketSubscribeToUserStatus,
  requestUserStatus,
} from '../src/_services/socketService';

// Comedy branding reactions (Laugh, Tomato, Fire, Clap, Heart, Laugh-cry, Wow)
const REACTIONS = ['😂', '🍅', '🔥', '👏', '❤️', '🤣', '😮'];

const isOwnMessage = (
  msg: any,
  myId: string | null | undefined,
  opts?: { peerId?: string | null; isGroup?: boolean; myIds?: Set<string> | string[] }
) => {
  if (!msg) return false;
  if (msg.fromSelf === true || msg.isSelf === true) return true;

  const sid = String(
    msg.senderId || msg.userId || msg.sender?._id || msg.sender?.id || msg.sender?.uid || ''
  ).trim();

  const mine = new Set<string>();
  if (myId) mine.add(String(myId));
  if (opts?.myIds) {
    for (const id of opts.myIds) {
      if (id) mine.add(String(id));
    }
  }
  if (sid && mine.has(sid)) return true;

  // 1:1: if recipient is the peer, we sent it (works even when senderId id-space differs)
  if (!opts?.isGroup && opts?.peerId) {
    const peer = String(opts.peerId).trim();
    const rid = String(msg.recipientId || msg.receiverId || '').trim();
    if (peer && rid && rid === peer && !mine.has(peer)) return true;
    if (sid && peer && !mine.has(peer)) {
      if (sid === peer) return false;
      if (mine.size > 0) return true;
    }
  }

  return false;
};

const canEditMessage = (msg: any) => {
  if (!msg) return false;
  const text = String(msg.text ?? msg.caption ?? '').trim();
  if (!text) return false;
  // Backend often stores empty sharedPost shells like { mediaUrls: [] } — those are NOT shares
  const hasRealSharedPost = Boolean(
    msg.sharedPost?.postId ||
    msg.sharedPost?.id ||
    msg.sharedPost?.imageUrl ||
    msg.sharedPost?.videoUrl ||
    (typeof msg.sharedPost?.caption === 'string' && msg.sharedPost.caption.trim()) ||
    (typeof msg.sharedPost?.text === 'string' && msg.sharedPost.text.trim())
  );
  const hasRealSharedStory = Boolean(
    msg.sharedStory?.storyId ||
    msg.sharedStory?.id ||
    msg.sharedStory?.mediaUrl
  );
  if (hasRealSharedPost || hasRealSharedStory) return false;
  const mType = String(msg.mediaType || '').toLowerCase();
  if (!mType || mType === 'text' || mType === 'message') return true;
  if (['image', 'video', 'audio', 'post', 'story'].includes(mType)) return false;
  return !msg.mediaUrl && !msg.audioUrl && !msg.imageUrl && !msg.videoUrl;
};

const subscribeToUserPresence = (uid: string, callback: (presence: any) => void) => {
  if (!uid) return () => {};
  requestUserStatus(uid);
  return socketSubscribeToUserStatus((data) => {
    if (String(data.userId) === String(uid)) {
      callback(data);
    }
  });
};

// --- Sub-components ---
const ChatItem = ({
  item,
  currentUserId,
  otherUserId,
  isGroup,
  displayName,
  avatarUri,
  groupMemberAvatarMap,
  activeSoundId,
  formatTime,
  onReaction,
  onLongPress,
  onPressPost,
  onPressStory,
  onPressImage,
  onPressShare,
  onPlayStart,
  onSwipeReply,
  onDoubleTapHeart,
  onPressReactionsBadge,
  onRetry,
  isSearchMatch,
  isCurrentSearchMatch,
  myIds,
}: any) => {
  if (item.type === 'date') return <View style={styles.dateWrap}><Text style={styles.dateText}>{item.date}</Text></View>;

  const senderId = String(item.senderId || item.sender?._id || item.sender?.id || item.userId || '');
  const memberAvatar = senderId ? groupMemberAvatarMap?.get(senderId) : null;
  const resolvedAvatar = item.senderAvatar || item.userAvatar || item.sender?.avatar || item.sender?.photoURL || item.sender?.profilePicture || memberAvatar || (!isGroup ? avatarUri : undefined);
  const own =
    item.fromSelf === true ||
    item.isSelf === true ||
    isOwnMessage(item, currentUserId, { peerId: otherUserId, isGroup, myIds });

  return (
    <SwipeableMessageRow
      onSwipeReply={() => onSwipeReply?.({ ...item, fromSelf: own, isSelf: own })}
      onDoubleTap={() => onDoubleTapHeart?.(item)}
      isSelf={own}
      enabled={!item.failed}
    >
      <Pressable
        onLongPress={() => onLongPress({ ...item, fromSelf: own, isSelf: own })}
        delayLongPress={200}
        style={{ width: '100%' }}
      >
        <MessageBubble
          {...item}
          id={getMessageId(item) || item.id}
          isSelf={own}
          formatTime={formatTime}
          username={displayName}
          currentUserId={currentUserId!}
          avatarUrl={resolvedAvatar}
          onReaction={(emoji: string) => onReaction(item, emoji)}
          reactions={item.reactions}
          onLongPress={() => onLongPress({ ...item, fromSelf: own, isSelf: own })}
          onPressPost={onPressPost}
          onPressStory={onPressStory}
          onPressImage={onPressImage}
          onPressShare={() => onPressShare(item)}
          activeSoundId={activeSoundId}
          onPlayStart={onPlayStart}
          onPressReactionsBadge={onPressReactionsBadge}
          onRetry={onRetry}
          isSearchMatch={isSearchMatch}
          isCurrentSearchMatch={isCurrentSearchMatch}
          sent={item.pending ? false : item.sent !== false}
          delivered={item.pending ? false : (item.delivered || !!item.readAt)}
          read={item.pending ? false : !!item.readAt}
          failed={!!item.failed}
        />
      </Pressable>
    </SwipeableMessageRow>
  );
};

const normalizeReactionsMap = (raw: any): Record<string, string[]> => {
  const result: Record<string, string[]> = {};
  if (!raw) return result;
  if (raw instanceof Map) {
    raw.forEach((val: any, key: any) => {
      if (Array.isArray(val) && val.length > 0) {
        result[String(key)] = val.map(String);
      }
    });
  } else if (typeof raw === 'object') {
    Object.keys(raw).forEach((key) => {
      const val = raw[key];
      if (Array.isArray(val) && val.length > 0) {
        result[String(key)] = val.map(String);
      }
    });
  }
  return result;
};

export default function DM() {
  const insets = useSafeAreaInsets();
  const { showSuccess } = useAppDialog();
  const params = useLocalSearchParams();
  const router = useRouter();
  const rawParamConversationId = params.conversationId as unknown;
  const paramConversationId: string | null = Array.isArray(rawParamConversationId)
    ? (rawParamConversationId[0] as string) || null
    : (typeof rawParamConversationId === 'string' ? rawParamConversationId : null);
  const isGroupParam = String((params as any)?.isGroup || '') === '1';

  const otherUserId: string | null = (() => {
    const p = params as any;
    if (isGroupParam || String(p?.isGroup || '').toLowerCase() === '1' || String(p?.isGroup || '').toLowerCase() === 'true') {
      return null;
    }
    const raw = p?.otherUserId ?? p?.peerId ?? p?.recipientId ?? p?.userId ?? p?.uid;
    if (Array.isArray(raw)) return (raw[0] as string) || null;
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  })();

  const seedPeerDisplayName = useMemo(() => {
    const p = params as any;
    const raw = p?.user ?? p?.displayName ?? p?.name ?? p?.username ?? p?.userName ?? p?.otherUserName ?? p?.title;
    const s = Array.isArray(raw) ? String(raw[0] ?? '') : typeof raw === 'string' ? raw : '';
    return s.trim();
  }, [params]);

  const seedPeerAvatar = useMemo(() => {
    const p = params as any;
    const raw = p?.avatar ?? p?.userAvatar ?? p?.photoURL ?? p?.avatarUrl ?? p?.profilePicture ?? p?.photoUrl;
    const s = Array.isArray(raw) ? String(raw[0] ?? '') : typeof raw === 'string' ? raw : '';
    return s.trim();
  }, [params]);

  const storeUserId = useAppStore((s) => s.userId);
  const convoMap = useAppStore((s) => s.convoMap);
  const [currentUserId, setCurrentUserId] = useState<string | null>(storeUserId);
  const [myIds, setMyIds] = useState<string[]>(() => (storeUserId ? [String(storeUserId)] : []));

  useEffect(() => {
    if (!currentUserId && storeUserId) {
      setCurrentUserId(storeUserId);
    } else if (!currentUserId) {
      AsyncStorage.getItem('userId').then(id => {
        if (id) setCurrentUserId(id);
      });
    }
  }, [storeUserId, currentUserId]);

  // Collect all identity variants so Edit/Delete show for own messages (mongo vs firebase)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ids = new Set<string>();
      if (currentUserId) ids.add(String(currentUserId));
      if (storeUserId) ids.add(String(storeUserId));
      try {
        const [uid, userId, token] = await Promise.all([
          AsyncStorage.getItem('uid'),
          AsyncStorage.getItem('userId'),
          AsyncStorage.getItem('token'),
        ]);
        if (uid) ids.add(String(uid));
        if (userId) ids.add(String(userId));
        if (token) {
          try {
            const parts = String(token).split('.');
            if (parts.length >= 2) {
              const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
              const json = typeof atob === 'function' ? JSON.parse(atob(b64)) : null;
              if (json?.userId) ids.add(String(json.userId));
              if (json?.firebaseUid) ids.add(String(json.firebaseUid));
            }
          } catch {}
        }
        try {
          const canon = await resolveCanonicalUserId();
          if (canon) ids.add(String(canon));
        } catch {}
      } catch {}
      if (!cancelled) setMyIds(Array.from(ids));
    })();
    return () => { cancelled = true; };
  }, [currentUserId, storeUserId]);

  const flatListRef = useRef<FlatList>(null);

  const {
    conversationId,
    messages,
    loading,
    loadingMore,
    hasMore,
    isOtherTyping,
    conversationMeta,
    loadMore,
    setMessages,
    setLoading,
    isNearBottomRef
  } = useDM(paramConversationId || null, otherUserId, currentUserId, (msg) => {
    if (msg.senderId !== currentUserId) {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      if (conversationId && currentUserId) {
        markConversationAsRead(conversationId, currentUserId).catch(() => {});
      }
    }
  });

  // Mark conversation as read when entering the chat
  useEffect(() => {
    if (conversationId && currentUserId) {
      markConversationAsRead(conversationId, currentUserId).catch(() => {});
    }
  }, [conversationId, currentUserId]);

  // Listen for background offline queue transmissions
  useEffect(() => {
    const unsub = feedEventEmitter.onFeedUpdate((evt: any) => {
      if (evt?.type === 'DM_MESSAGE_SENT') {
        const cId = String(evt.conversationId || evt.data?.conversationId || '').trim();
        const activeCId = String(conversationId || paramConversationId || '').trim();
        const matchesConvo = !activeCId || !cId || cId === activeCId || cId.includes(activeCId) || activeCId.includes(cId);
        if (matchesConvo && evt.data) {
          const finalized = normalizeMessage({ ...evt.data, tempId: evt.messageId, sent: true });
          setMessages(prev => mergeMessages(prev, [finalized]));
        }
      } else if (evt?.type === 'DM_MESSAGE_FAILED') {
        const tempId = String(evt.messageId || '').trim();
        if (tempId) {
          setMessages(prev => prev.map(m => (String(m.id) === tempId || String(m.tempId) === tempId) ? { ...m, failed: true, sent: false } : m));
        }
      }
    });
    return () => unsub?.();
  }, [conversationId, paramConversationId, setMessages]);

  // Check offline outbox on enter and trigger background flush
  useEffect(() => {
    if (!conversationId && !otherUserId) return;
    processOfflineQueue().catch(() => {});
    const targetCId = conversationId || paramConversationId;
    if (targetCId) {
      getOfflineOutbox(targetCId).then((pending) => {
        if (Array.isArray(pending) && pending.length > 0) {
          const restored = pending.map(p => normalizeMessage({
            id: p.tempId,
            tempId: p.tempId,
            senderId: p.currentUserId,
            text: p.text,
            mediaType: p.mediaType,
            mediaUrl: p.mediaUri,
            createdAt: new Date(p.createdAt).toISOString(),
            __ts: p.createdAt,
            sent: false,
            failed: p.status === 'failed',
            tempOrigin: true,
            replyTo: p.replyTo,
          }));
          setMessages(prev => mergeMessages(prev, restored));
        }
      }).catch(() => {});
    }
  }, [conversationId, otherUserId, paramConversationId, setMessages]);

  const {
    recording,
    recordingDuration,
    micPulseAnim,
    handlePickImage,
    handleLaunchCamera,
    startRecording,
    stopRecording
  } = useDMMedia();

  const [sending, setSending] = useState(false);
  const [input, setInput] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [showMessageMenu, setShowMessageMenu] = useState(false);
  const [menuIsOwn, setMenuIsOwn] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string; senderId: string; username?: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [activeSoundId, setActiveSoundId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [sharePostItem, setSharePostItem] = useState<any>(null);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [reactionsModalData, setReactionsModalData] = useState<{ visible: boolean; messageId: string; reactions: any } | null>(null);
  const [pendingMediaPreview, setPendingMediaPreview] = useState<{ uri: string; type: 'image' | 'video' } | null>(null);
  const [storyViewerData, setStoryViewerData] = useState<{ stories: any[]; visible: boolean }>({ stories: [], visible: false });
  const [otherUserPresence, setOtherUserPresence] = useState<any | null>(null);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHandlingStoryPressRef = useRef(false);
  const lastReactionCallRef = useRef<{ id: string; emoji: string; time: number }>({ id: '', emoji: '', time: 0 });

  const handleInputChange = (text: string) => {
    setInput(text);
    if (!conversationId || !currentUserId || !otherUserId) return;
    sendTypingIndicator({ conversationId, userId: currentUserId, recipientId: otherUserId });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      stopTypingIndicator({ conversationId, userId: currentUserId, recipientId: otherUserId });
    }, 2000);
  };

  const [inChatSearchQuery, setInChatSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [activeSearchMatchIndex, setActiveSearchMatchIndex] = useState(0);

  const handleCloseSearch = useCallback(() => {
    setIsSearchActive(false);
    setInChatSearchQuery('');
    setActiveSearchMatchIndex(0);
    try {
      router.setParams({ searchMode: '', focusSearch: '' } as any);
    } catch {}
  }, [router]);

  useEffect(() => {
    const sMode = String((params as any)?.searchMode || '');
    const fSearch = String((params as any)?.focusSearch || '');
    if (sMode === '1' || fSearch === '1') {
      setIsSearchActive(true);
    }
  }, [(params as any)?.searchMode, (params as any)?.focusSearch]);

  const searchMatchingIds = useMemo(() => {
    if (!isSearchActive || !inChatSearchQuery.trim()) return [];
    const q = inChatSearchQuery.trim().toLowerCase();
    return messages
      .filter((m) => {
        const text = String(m.text || m.caption || m.sharedPost?.caption || m.sharedPost?.text || '').toLowerCase();
        return text.includes(q);
      })
      .map((m) => String(m.id || m._id || m.messageId || ''))
      .filter(Boolean);
  }, [isSearchActive, inChatSearchQuery, messages]);

  useEffect(() => {
    setActiveSearchMatchIndex(0);
  }, [searchMatchingIds]);

  const currentSearchMatchId = searchMatchingIds[activeSearchMatchIndex] || null;

  const messagesWithSeparators = useMemo(() => {
    const seen = new Set<string>();
    const pool = messages; // Keep all messages visible in thread!

    const unique = pool.filter(msg => {
      const key = String(msg.id || msg._id || msg.messageId || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const sorted = [...unique].sort((a, b) => (a.__ts || 0) - (b.__ts || 0));
    const list: any[] = [];
    let lastDateKey: string | null = null;

    sorted.forEach((msg) => {
      const ms = msg.__ts || Date.now();
      const dateObj = new Date(ms > Date.now() ? Date.now() : ms);
      const dateKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;

      if (dateKey !== lastDateKey) {
        const now = new Date();
        const diffDays = (now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24);
        let formattedDate = "";
        const timeStr = dateObj.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toUpperCase();

        if (dateKey === `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`) {
          formattedDate = timeStr;
        } else if (diffDays < 7) {
          const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
          formattedDate = `${days[dateObj.getDay()]} ${timeStr}`;
        } else if (dateObj.getFullYear() === now.getFullYear()) {
          const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
          formattedDate = `${months[dateObj.getMonth()]} ${dateObj.getDate()}, ${timeStr}`;
        } else {
          const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
          formattedDate = `${months[dateObj.getMonth()]} ${dateObj.getDate()}, ${dateObj.getFullYear()}, ${timeStr}`;
        }

        list.push({ type: 'date', date: formattedDate, id: `date_${dateKey}` });
        lastDateKey = dateKey;
      }
      list.push(msg);
    });
    return list.reverse();
  }, [messages, isSearchActive, inChatSearchQuery]);

  const scrollToMatchId = useCallback((targetId: string) => {
    if (!targetId || !flatListRef.current) return;
    const index = messagesWithSeparators.findIndex((item) => String(item.id || item._id || item.messageId) === targetId);
    if (index >= 0) {
      try {
        flatListRef.current.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      } catch {
        flatListRef.current.scrollToOffset({ offset: Math.max(0, index * 70), animated: true });
      }
    }
  }, [messagesWithSeparators]);

  const handleNextSearchMatch = useCallback(() => {
    if (searchMatchingIds.length === 0) return;
    const nextIndex = (activeSearchMatchIndex + 1) % searchMatchingIds.length;
    setActiveSearchMatchIndex(nextIndex);
    scrollToMatchId(searchMatchingIds[nextIndex]);
  }, [activeSearchMatchIndex, searchMatchingIds, scrollToMatchId]);

  const handlePrevSearchMatch = useCallback(() => {
    if (searchMatchingIds.length === 0) return;
    const prevIndex = (activeSearchMatchIndex - 1 + searchMatchingIds.length) % searchMatchingIds.length;
    setActiveSearchMatchIndex(prevIndex);
    scrollToMatchId(searchMatchingIds[prevIndex]);
  }, [activeSearchMatchIndex, searchMatchingIds, scrollToMatchId]);

  const resolvedOtherUserId = useMemo(() => {
    const isMe = (id: any) => {
      const s = String(id || '').trim();
      if (!s) return false;
      if (currentUserId && s === String(currentUserId)) return true;
      return myIds.some((m) => String(m) === s);
    };

    if (otherUserId && !isMe(otherUserId)) return otherUserId;
    if (conversationMeta) {
      if (conversationMeta.otherUserId && !isMe(conversationMeta.otherUserId)) {
        return String(conversationMeta.otherUserId);
      }
      if (conversationMeta.peerId && !isMe(conversationMeta.peerId)) {
        return String(conversationMeta.peerId);
      }
      if (conversationMeta.recipientId && !isMe(conversationMeta.recipientId)) {
        return String(conversationMeta.recipientId);
      }
      if (Array.isArray(conversationMeta.participants)) {
        const found = conversationMeta.participants.find((id: any) => !isMe(id));
        if (found) return String(found);
      }
      if (Array.isArray(conversationMeta.members) && conversationMeta.members.length === 2) {
        const found = conversationMeta.members.find((m: any) => {
          const uid = typeof m === 'object' ? (m.uid || m._id || m.id) : m;
          return !isMe(uid);
        });
        if (found) {
          return typeof found === 'object' ? String(found.uid || found._id || found.id) : String(found);
        }
      }
    }
    if (otherUserId) return otherUserId;
    return null;
  }, [otherUserId, conversationMeta, currentUserId, myIds]);

  const isGroupConversation = useMemo(() => {
    const p = params as any;
    const isExplicitGroup = isGroupParam ||
      String(p?.isGroup ?? '').toLowerCase() === '1' ||
      String(p?.isGroup ?? '').toLowerCase() === 'true' ||
      String(p?.type ?? '').toLowerCase() === 'group' ||
      (p?.groupId && String(p.groupId).trim().length > 0 && !resolvedOtherUserId);

    if (isExplicitGroup) return true;

    if (conversationMeta) {
      if (conversationMeta.isGroup === true || String(conversationMeta.isGroup).toLowerCase() === 'true' || String(conversationMeta.isGroup) === '1') {
        return true;
      }
      if (String(conversationMeta.type || '').toLowerCase() === 'group') {
        return true;
      }
      if (Array.isArray(conversationMeta.participants) && conversationMeta.participants.length > 2) {
        return true;
      }
      if (Array.isArray(conversationMeta.members) && conversationMeta.members.length > 2) {
        return true;
      }
    }

    return false;
  }, [params, isGroupParam, conversationMeta, resolvedOtherUserId]);

  const targetPeerId = isGroupConversation ? null : (resolvedOtherUserId || otherUserId);
  const { profile: otherUserProfile } = useUserProfile(targetPeerId);

  const cachedPeer = useMemo(() => {
    if (!targetPeerId) return null;
    return getCachedUserProfile(targetPeerId);
  }, [targetPeerId]);

  const displayName = useMemo(() => {
    if (isGroupConversation) {
      return conversationMeta?.groupName || (params as any)?.groupName || seedPeerDisplayName || 'Group';
    }
    const fromApi = (otherUserProfile?.displayName && String(otherUserProfile.displayName).trim()) ||
      (otherUserProfile?.name && String(otherUserProfile.name).trim()) ||
      (otherUserProfile?.username && String(otherUserProfile.username).trim()) || '';
    const fromCache = (cachedPeer?.displayName && String(cachedPeer.displayName).trim()) ||
      (cachedPeer?.name && String(cachedPeer.name).trim()) ||
      (cachedPeer?.username && String(cachedPeer.username).trim()) || '';
    const fromMeta = (conversationMeta?.peerName && String(conversationMeta.peerName).trim()) ||
      (conversationMeta?.otherUserName && String(conversationMeta.otherUserName).trim()) ||
      (conversationMeta?.userName && String(conversationMeta.userName).trim()) ||
      (conversationMeta?.name && String(conversationMeta.name).trim()) ||
      (conversationMeta?.displayName && String(conversationMeta.displayName).trim()) || '';

    const isPlaceholder = (val: string) => !val || ['user', 'unknown'].includes(val.toLowerCase());

    if (!isPlaceholder(fromApi)) return fromApi;
    if (!isPlaceholder(fromCache)) return fromCache;
    if (!isPlaceholder(fromMeta)) return fromMeta;
    if (!isPlaceholder(seedPeerDisplayName)) return seedPeerDisplayName;

    return fromApi || fromCache || fromMeta || seedPeerDisplayName || 'User';
  }, [conversationMeta, isGroupConversation, otherUserProfile, cachedPeer, seedPeerDisplayName, params]);

  const avatarUri = useMemo(() => {
    const isMissing = (u: any) => typeof isMissingOrDefaultAvatar === 'function' ? isMissingOrDefaultAvatar(u) : !u || String(u).includes('avatardefault');
    if (isGroupConversation) {
      const gAv = conversationMeta?.groupAvatar || (params as any)?.groupAvatar || (params as any)?.avatar;
      return (gAv && !isMissing(gAv)) ? resolveAvatarUrl(gAv) : DEFAULT_AVATAR_URL;
    }
    const apiAv = otherUserProfile?.avatar || otherUserProfile?.photoURL;
    if (apiAv && !isMissing(apiAv)) return resolveAvatarUrl(apiAv);

    const cacheAv = cachedPeer?.avatar || cachedPeer?.photoURL;
    if (cacheAv && !isMissing(cacheAv)) return resolveAvatarUrl(cacheAv);

    if (seedPeerAvatar && !isMissing(seedPeerAvatar)) return resolveAvatarUrl(seedPeerAvatar);

    if (conversationMeta?.peerAvatar || conversationMeta?.avatar || conversationMeta?.otherUserAvatar) {
      const metaAv = conversationMeta.peerAvatar || conversationMeta.avatar || conversationMeta.otherUserAvatar;
      if (!isMissing(metaAv)) return resolveAvatarUrl(metaAv);
    }

    return DEFAULT_AVATAR_URL;
  }, [isGroupConversation, conversationMeta, otherUserProfile, cachedPeer, seedPeerAvatar, params]);

  useEffect(() => {
    if (avatarUri && avatarUri !== DEFAULT_AVATAR_URL) {
      try {
        const resolved = resolveAvatarUrl(avatarUri);
        if (resolved && resolved !== DEFAULT_AVATAR_URL) {
          ExpoImage.prefetch(resolved).catch(() => {});
        }
      } catch {}
    }
  }, [avatarUri]);

  useEffect(() => {
    if (otherUserProfile) {
      cacheUserProfile(otherUserProfile);
    } else if (otherUserId && seedPeerAvatar) {
      cacheUserProfile({
        uid: otherUserId,
        displayName: seedPeerDisplayName,
        avatar: seedPeerAvatar,
      });
    }
  }, [otherUserProfile, otherUserId, seedPeerAvatar, seedPeerDisplayName]);

  useEffect(() => {
    if (!conversationId || !currentUserId || isGroupConversation) return;
    const unsub = subscribeToUserPresence(otherUserId!, (p) => setOtherUserPresence(p));
    return () => unsub();
  }, [conversationId, currentUserId, otherUserId, isGroupConversation]);

  const [isTargetBlocked, setIsTargetBlocked] = useState<boolean>(() =>
    !isGroupConversation && !!otherUserId ? isUserBlockedLocally(otherUserId, currentUserId || undefined) : false
  );

  useEffect(() => {
    if (!currentUserId || !otherUserId || isGroupConversation) return;
    fetchBlockedUserIds(currentUserId).then((blockedSet) => {
      if (blockedSet.has(String(otherUserId))) {
        setIsTargetBlocked(true);
      }
    }).catch(() => {});
  }, [currentUserId, otherUserId, isGroupConversation]);

  useEffect(() => {
    const unsub = feedEventEmitter.onFeedUpdate((evt: any) => {
      if (evt.type === 'USER_BLOCKED' && String(evt.userId || evt.blockedUserId) === String(otherUserId)) {
        setIsTargetBlocked(true);
      }
      if (evt.type === 'USER_UNBLOCKED' && String(evt.userId || evt.blockedUserId) === String(otherUserId)) {
        setIsTargetBlocked(false);
      }
    });
    return () => unsub?.();
  }, [otherUserId]);

  const handleUnblockTarget = async () => {
    const activeUserId = currentUserId || (await resolveCanonicalUserId());
    if (!activeUserId || !otherUserId) return;
    try {
      removeBlockedUserId(activeUserId, otherUserId);
      setIsTargetBlocked(false);
      feedEventEmitter.emit('feedUpdated', { type: 'USER_UNBLOCKED', userId: otherUserId, blockedUserId: otherUserId });
      await userService.unblockUser(activeUserId, otherUserId);
      Alert.alert('Unblocked', `${displayName} has been unblocked.`);
    } catch {
      Alert.alert('Error', 'Failed to unblock user.');
    }
  };

  const handleStopRecordingWrapper = async () => {
    const res = await stopRecording();
    if (res?.uri) {
      sendMediaMessage('audio', res.uri, { audioDuration: res.duration });
    }
  };

  const sendMediaMessage = async (type: string, uri: string, extra: any = {}) => {
    if (!conversationId || !currentUserId) return;
    const isOnline = getCachedIsOnline();
    const tempId = createTempId(`temp_${type}`);
    const sentAtMs = Date.now();
    const msgCaption = String(extra?.text || extra?.caption || '').trim();
    const tempMsg = {
      id: tempId,
      tempId,
      senderId: currentUserId,
      mediaType: type,
      mediaUrl: uri,
      text: msgCaption,
      createdAt: new Date(sentAtMs).toISOString(),
      __ts: sentAtMs,
      sent: isOnline,
      offline: !isOnline,
      tempOrigin: true,
      ...extra
    };

    setMessages(prev => [normalizeMessage(tempMsg), ...prev]);

    if (!isOnline) {
      await enqueueOfflineMessage({
        tempId,
        conversationId,
        currentUserId,
        otherUserId: otherUserId || undefined,
        text: msgCaption,
        mediaType: type as any,
        mediaUri: uri,
        extra,
        createdAt: sentAtMs,
        status: 'pending',
      });
      return;
    }

    (async () => {
      let finalUri = uri;
      try {
        let uploadRes: any;
        const isLocalUri = typeof uri === 'string' && (
          uri.startsWith('file://') ||
          uri.startsWith('ph://') ||
          uri.startsWith('assets-library://') ||
          uri.startsWith('content://') ||
          uri.startsWith('/')
        );

        if (isLocalUri) {
          try {
            if (type === 'video') {
              finalUri = await compressVideoSafe(uri);
            } else if (type === 'image') {
              finalUri = await compressImageSafe(uri);
            }
          } catch (compressErr) {
            console.warn('[DM] Media compression failed:', compressErr);
          }
          uploadRes = await uploadMedia(finalUri, type as any);
        } else if (typeof uri === 'string' && (uri.startsWith('http://') || uri.startsWith('https://'))) {
          uploadRes = await uploadMedia(uri, type as any);
        } else {
          const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          const mime = type === 'audio' ? 'audio/x-m4a' : (type === 'video' ? 'video/mp4' : 'image/jpeg');
          uploadRes = await uploadMedia(`data:${mime};base64,${base64}`, type as any);
        }

        if (uploadRes?.success) {
          const uploadedUrl = uploadRes?.url || uploadRes?.data?.url || uploadRes?.secureUrl;
          const res = await sendMediaMessageApi(
            conversationId,
            currentUserId,
            uploadedUrl,
            type as any,
            {
              recipientId: otherUserId || undefined,
              thumbnailUrl: uploadRes?.thumbnailUrl || uploadRes?.data?.thumbnailUrl,
              ...extra,
              tempId
            }
          );
          if (res?.success) {
            const finalMsg = normalizeMessage({
              ...((res as any).data || (res as any).message),
              tempId,
              sent: true
            });
            setMessages(prev => mergeMessages(prev, [finalMsg]));
            const previewText = msgCaption || (type === 'audio' ? 'Voice note' : (type === 'video' ? 'Video' : 'Photo'));
            patchInboxLastMessage(conversationId, previewText);
            return;
          }
        }
        
        if (isNetworkError(uploadRes?.error)) {
          await enqueueOfflineMessage({
            tempId,
            conversationId,
            currentUserId,
            otherUserId: otherUserId || undefined,
            text: msgCaption,
            mediaType: type as any,
            mediaUri: uri,
            extra,
            createdAt: sentAtMs,
            status: 'pending',
          });
        } else {
          setMessages(prev => prev.map(m => (m.id === tempId || m.tempId === tempId) ? { ...m, failed: true } : m));
        }
      } catch (e: any) {
        if (isNetworkError(e)) {
          await enqueueOfflineMessage({
            tempId,
            conversationId,
            currentUserId,
            otherUserId: otherUserId || undefined,
            text: msgCaption,
            mediaType: type as any,
            mediaUri: uri,
            extra,
            createdAt: sentAtMs,
            status: 'pending',
          });
        } else {
          console.error('Media send error:', e);
          setMessages(prev => prev.map(m => (m.id === tempId || m.tempId === tempId) ? { ...m, failed: true } : m));
        }
      }
    })();
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!currentUserId) {
      Alert.alert('Error', 'User ID not found. Please log in again.');
      return;
    }
    if (sending) return;

    const msgText = input.trim();
    if (conversationId && currentUserId && otherUserId) {
      stopTypingIndicator({ conversationId, userId: currentUserId, recipientId: otherUserId });
    }

    if (editingMessage) {
      const targetId = getMessageId(editingMessage);
      setSending(true);
      try {
        const res = await editMessage(String(conversationId), targetId, String(currentUserId), msgText);
        if (res?.success) {
          setMessages(prev => prev.map(m => getMessageId(m) === targetId ? { ...m, text: msgText, editedAt: new Date().toISOString() } : m));
          setEditingMessage(null);
          if (conversationId) {
            patchInboxLastMessage(conversationId, msgText);
          }
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to edit message');
      } finally {
        setSending(false);
      }
      return;
    }

    const isOnline = getCachedIsOnline();
    const replyData = replyingTo;
    setInput("");
    setReplyingTo(null);
    setSending(true);
    const tempId = createTempId('temp_text');
    const sentAtMs = Date.now();
    const tempMsg = normalizeMessage({
      id: tempId,
      tempId,
      senderId: currentUserId,
      text: msgText,
      createdAt: new Date(sentAtMs).toISOString(),
      __ts: sentAtMs,
      sent: isOnline,
      offline: !isOnline,
      tempOrigin: true,
      replyTo: replyData
    });
    setMessages(prev => [tempMsg, ...prev]);

    const validCId = (conversationId && conversationId !== 'null' && conversationId !== 'undefined') ? conversationId : null;

    if (!isOnline) {
      await enqueueOfflineMessage({
        tempId,
        conversationId: validCId || (otherUserId ? `${currentUserId}_${otherUserId}` : ''),
        currentUserId: String(currentUserId),
        otherUserId: otherUserId || undefined,
        text: msgText,
        mediaType: 'text',
        replyTo: replyData,
        createdAt: sentAtMs,
        status: 'pending',
      });
      setSending(false);
      return;
    }

    // If network is slow and message takes > 1800ms, gently transition to clock icon
    const slowNetTimer = setTimeout(() => {
      setMessages(prev =>
        prev.map(m =>
          (String(m.id) === tempId || String(m.tempId) === tempId) && m.tempOrigin && !m.sentConfirmed
            ? { ...m, sent: false, slowNet: true }
            : m
        )
      );
    }, 1800);

    try {
      const res = await sendMessage(validCId as any, String(currentUserId), msgText, otherUserId || undefined, replyData, tempId);
      clearTimeout(slowNetTimer);

      if (res?.success && ((res as any).message || (res as any).data)) {
        const backendMsg = (res as any).message || (res as any).data;
        const finalized = normalizeMessage({
          ...backendMsg,
          tempId,
          timestamp: backendMsg.timestamp || new Date(sentAtMs).toISOString(),
          sent: true,
          sentConfirmed: true
        });

        // mergeMessages replaces tempId smoothly in-place with 0 flicker and 0 duplicate!
        setMessages(prev => mergeMessages(prev, [finalized]));

        if (conversationId) {
          patchInboxLastMessage(conversationId, msgText);
        }
      } else if (isNetworkError(res?.error)) {
        setMessages(prev => prev.map(m => (String(m.id) === String(tempId) || String(m.tempId) === String(tempId)) ? { ...m, sent: false, offline: true } : m));
        await enqueueOfflineMessage({
          tempId,
          conversationId: validCId || '',
          currentUserId: String(currentUserId),
          otherUserId: otherUserId || undefined,
          text: msgText,
          mediaType: 'text',
          replyTo: replyData,
          createdAt: sentAtMs,
          status: 'pending',
        });
      } else {
        setMessages(prev => prev.map(m => (String(m.id) === String(tempId) || String(m.tempId) === String(tempId)) ? { ...m, failed: true, sent: false } : m));
        Alert.alert('Send Failed', res?.error || 'Server did not accept the message');
      }
    } catch (e: any) {
      clearTimeout(slowNetTimer);
      if (isNetworkError(e)) {
        setMessages(prev => prev.map(m => (String(m.id) === String(tempId) || String(m.tempId) === String(tempId)) ? { ...m, sent: false, offline: true } : m));
        await enqueueOfflineMessage({
          tempId,
          conversationId: validCId || '',
          currentUserId: String(currentUserId),
          otherUserId: otherUserId || undefined,
          text: msgText,
          mediaType: 'text',
          replyTo: replyData,
          createdAt: sentAtMs,
          status: 'pending',
        });
      } else {
        setMessages(prev => prev.map(m => (String(m.id) === String(tempId) || String(m.tempId) === String(tempId)) ? { ...m, failed: true, sent: false } : m));
        Alert.alert('Error', 'Failed to send message: ' + (e?.message || 'Unknown error'));
      }
    } finally {
      setSending(false);
    }
  };

  const handlePickImageWrapper = async () => {
    const res = await handlePickImage();
    if (res?.uri) {
      const mType = (res.type === 'video' || (res as any).mediaType === 'video') ? 'video' : 'image';
      setPendingMediaPreview({ uri: res.uri, type: mType });
    }
  };

  const handleLaunchCameraWrapper = async () => {
    const res = await handleLaunchCamera();
    if (res?.uri) {
      setPendingMediaPreview({ uri: res.uri, type: 'image' });
    }
  };

  const handleConfirmSendMedia = useCallback(async (caption: string) => {
    if (!pendingMediaPreview) return;
    const { uri, type } = pendingMediaPreview;
    setPendingMediaPreview(null);
    await sendMediaMessage(type, uri, { text: caption, caption });
  }, [pendingMediaPreview, sendMediaMessage]);

  const handleRetryMessage = useCallback(async (msgId: string) => {
    const target = messages.find(m => String(m.id || m._id || m.messageId) === String(msgId));
    if (!target) return;

    // Reset failed state
    setMessages(prev => prev.map(m => String(m.id || m._id || m.messageId) === String(msgId) ? { ...m, failed: false, sent: false } : m));

    const kind = String(target.mediaType || '').toLowerCase();
    if (['image', 'video', 'audio'].includes(kind)) {
      const mediaUri = target.mediaUrl || target.audioUrl || target.imageUrl;
      if (mediaUri) {
        setMessages(prev => prev.filter(m => String(m.id || m._id || m.messageId) !== String(msgId)));
        sendMediaMessage(kind, mediaUri, {
          text: target.text,
          caption: target.caption,
          audioDuration: target.audioDuration,
        });
      }
    } else if (target.text) {
      try {
        const validCId = (conversationId && conversationId !== 'null' && conversationId !== 'undefined') ? conversationId : null;
        const res = await sendMessage(validCId as any, String(currentUserId), target.text, otherUserId || undefined, target.replyTo, msgId);
        if (res?.success && ((res as any).message || (res as any).data)) {
          const backendMsg = (res as any).message || (res as any).data;
          const finalized = normalizeMessage({ ...backendMsg, sent: true });
          setMessages(prev => prev.map(m => String(m.id || m._id || m.messageId) === String(msgId) ? finalized : m));
          if (conversationId) {
            patchInboxLastMessage(conversationId, target.text);
          }
        } else {
          setMessages(prev => prev.map(m => String(m.id || m._id || m.messageId) === String(msgId) ? { ...m, failed: true, sent: false } : m));
        }
      } catch {
        setMessages(prev => prev.map(m => String(m.id || m._id || m.messageId) === String(msgId) ? { ...m, failed: true, sent: false } : m));
      }
    }
  }, [messages, conversationId, currentUserId, otherUserId, sendMediaMessage]);

  const handleReaction = useCallback(async (itemOrEmoji: any, emojiStr?: string) => {
    const targetMsg = emojiStr ? itemOrEmoji : selectedMessage;
    const emoji = String(emojiStr || itemOrEmoji || '').trim();
    if (!targetMsg || !emoji) return;

    const targetMsgId = String(getMessageId(targetMsg) || targetMsg?.id || targetMsg?._id || '');
    if (!targetMsgId) return;

    // Prevent duplicate rapid toggle from simultaneous events
    const now = Date.now();
    if (
      lastReactionCallRef.current.id === targetMsgId &&
      lastReactionCallRef.current.emoji === emoji &&
      now - lastReactionCallRef.current.time < 350
    ) {
      return;
    }
    lastReactionCallRef.current = { id: targetMsgId, emoji, time: now };

    const activeUserId = String(
      currentUserId ||
      storeUserId ||
      (myIds && myIds[0]) ||
      ''
    );

    const targetConvoId = String(
      conversationId ||
      targetMsg.conversationId ||
      paramConversationId ||
      (otherUserId ? convoMap[otherUserId] : '') ||
      ''
    );

    // Optimistically update message reactions in local state immediately
    setMessages((prev: any[]) => {
      return prev.map((m: any) => {
        const mId = String(getMessageId(m) || m.id || m._id || '');
        if (mId === targetMsgId) {
          const currentReactions = normalizeReactionsMap(m.reactions);
          const userList = currentReactions[emoji] ? [...currentReactions[emoji]] : [];
          const hasReacted = activeUserId
            ? userList.some((id) => String(id) === activeUserId || myIds.includes(String(id)))
            : false;

          if (hasReacted) {
            const filtered = userList.filter((id) => String(id) !== activeUserId && !myIds.includes(String(id)));
            if (filtered.length > 0) {
              currentReactions[emoji] = filtered;
            } else {
              delete currentReactions[emoji];
            }
          } else {
            currentReactions[emoji] = [...userList, activeUserId || 'self'];
          }

          return {
            ...m,
            reactions: { ...currentReactions },
          };
        }
        return m;
      });
    });

    setShowMessageMenu(false);
    setSelectedMessage(null);

    // Persist to backend
    if (targetConvoId && activeUserId) {
      try {
        await reactToMessage(targetConvoId, targetMsgId, activeUserId, emoji);
      } catch (err) {
        console.warn('[handleReaction] API error:', err);
      }
    }
  }, [conversationId, currentUserId, storeUserId, myIds, paramConversationId, otherUserId, convoMap, setMessages, selectedMessage]);

  const handleRemoveReactionFromModal = useCallback((emoji: string) => {
    if (!reactionsModalData?.messageId) return;
    const target = messages.find(m => String(m.id || m._id || m.messageId) === String(reactionsModalData.messageId));
    if (target) {
      handleReaction(target, emoji);
    }
    setReactionsModalData(null);
  }, [reactionsModalData, messages, handleReaction]);

  const handleDeleteMessage = (msgToDelete = selectedMessage) => {
    if (!conversationId || !msgToDelete || !currentUserId) return;
    setShowMessageMenu(false);

    Alert.alert(
      "Delete Message?",
      "Are you sure you want to unsend/delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const targetId = getMessageId(msgToDelete) || msgToDelete.id;
            setMessages((prev) => prev.filter((m) => (getMessageId(m) || m.id) !== targetId));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

            try {
              const res = await deleteMessage(conversationId, targetId, currentUserId);
              if (!res?.success && res?.error) {
                console.warn('[DM] Delete message failed:', res.error);
              }
            } catch (err) {
              console.warn('[DM] Delete message error:', err);
            }
          },
        },
      ]
    );
  };

  const handleMessageLongPress = useCallback((msg: any) => {
    if (!msg || msg.type === 'date') return;
    Keyboard.dismiss();
    const own =
      msg.fromSelf === true ||
      msg.isSelf === true ||
      isOwnMessage(msg, currentUserId, {
        peerId: resolvedOtherUserId || otherUserId,
        isGroup: isGroupConversation,
        myIds,
      });
    setSelectedMessage({ ...msg, fromSelf: own, isSelf: own });
    setMenuIsOwn(!!own);
    setShowMessageMenu(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }, [currentUserId, resolvedOtherUserId, otherUserId, isGroupConversation, myIds]);

  const handleSwipeReply = useCallback((msg: any) => {
    if (!msg || msg.type === 'date') return;
    const msgId = getMessageId(msg) || msg.id;
    const replyText = msg.text || (
      msg.mediaType === 'audio' ? 'Voice note' :
      msg.mediaType === 'video' ? 'Video' :
      msg.mediaType === 'image' ? 'Photo' :
      msg.mediaType === 'post' || msg.sharedPost ? 'Shared post' :
      msg.mediaType === 'story' || msg.sharedStory ? 'Shared story' :
      'Message'
    );
    setReplyingTo({
      id: msgId,
      text: replyText,
      senderId: msg.senderId || (msg.isSelf ? currentUserId : otherUserId),
      username: msg.isSelf ? 'yourself' : (msg.senderName || msg.username || displayName || 'them')
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, [currentUserId, otherUserId, displayName]);

  const handleDoubleTapHeart = useCallback((msg: any) => {
    if (!msg || msg.type === 'date') return;
    handleReaction(msg, '❤️');
  }, [handleReaction]);

  const handleOpenGroupInfo = () => {
    setShowOptionsModal(false);

    const cleanToken = (v: any) => {
      if (!v) return '';
      let s = String(v).trim().replace(/^['"{\[\s]+|['"}\]\s]+$/g, '').replace(/['"}\];,]+$/g, '');
      if (s.startsWith('@')) s = s.slice(1).trim();
      return /^[a-zA-Z0-9_\-\.]{2,128}$/.test(s) ? s : '';
    };

    const rawCandidates = [
      ...(Array.isArray(conversationMeta?.participants) ? conversationMeta.participants : []),
      ...(Array.isArray(conversationMeta?.members) ? conversationMeta.members : []),
      ...(Array.isArray(conversationMeta?.userIds) ? conversationMeta.userIds : []),
      ...((params as any)?.members ? (Array.isArray((params as any).members) ? (params as any).members : [(params as any).members]) : []),
      ...(messages && messages.length > 0
        ? messages.map(m => {
          const uid = cleanToken(m.senderId || m.userId || m.sender?._id);
          const uname = cleanToken(m.senderUsername || m.sender?.username);
          const dname = m.userDisplayName || m.sender?.displayName || m.sender?.name;
          if (!uid && !uname) return null;
          return {
            uid: uid || uname,
            displayName: dname ? String(dname).replace(/['"}\];,]+$/g, '').trim() : undefined,
            avatar: m.senderAvatar || m.userAvatar || m.sender?.avatar,
            userName: uname || undefined,
          };
        }).filter(Boolean)
        : []),
    ];

    const sanitizedMembers = rawCandidates.filter((m: any) => {
      if (!m) return false;
      if (typeof m === 'string') return !!cleanToken(m);
      const uid = cleanToken(m.uid || m._id || m.id || m.userId || m.senderId);
      const uname = cleanToken(m.userName || m.username || m.senderUsername);
      return !!(uid || uname);
    });

    router.push({
      pathname: '/group-info',
      params: {
        conversationId: conversationId || paramConversationId || '',
        groupId: (params as any)?.groupId || conversationMeta?.groupId || '',
        groupName: displayName,
        avatar: avatarUri,
        members: JSON.stringify(sanitizedMembers),
      }
    } as any);
  };

  const handleOpenChatDetails = () => {
    setShowOptionsModal(false);
    if (!targetPeerId) return;
    router.push({
      pathname: '/chat-details',
      params: {
        userId: targetPeerId,
        otherUserId: targetPeerId,
        conversationId: conversationId || paramConversationId || '',
        displayName,
        avatar: avatarUri,
        username: otherUserProfile?.username || cachedPeer?.username || '',
      }
    } as any);
  };

  const formatTimeForBubble = useCallback((t: any) => {
    const date = new Date(t);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const renderChatItem = useCallback(({ item }: { item: any }) => {
    const msgId = String(item?.id || item?._id || item?.messageId || '');
    const isSearchMatch = searchMatchingIds.includes(msgId);
    const isCurrentSearchMatch = currentSearchMatchId === msgId;

    return (
      <ChatItem
        item={item}
        currentUserId={currentUserId}
        otherUserId={resolvedOtherUserId || otherUserId}
        myIds={myIds}
        displayName={displayName}
        avatarUri={avatarUri}
        isGroup={isGroupConversation}
        activeSoundId={activeSoundId}
        formatTime={formatTimeForBubble}
        onReaction={handleReaction}
        onLongPress={handleMessageLongPress}
        onPressPost={(post: any) => {
          const resolved = post?.sharedPost || post;
          const pid = resolved?.id || resolved?._id || resolved?.postId;
          if (pid) {
            router.push({
              pathname: '/post-detail',
              params: {
                id: String(pid),
                postId: String(pid),
                initialData: encodeURIComponent(JSON.stringify(resolved))
              }
            } as any);
          }
        }}
        onPressStory={(story: any) => {
          if (isHandlingStoryPressRef.current) return;
          isHandlingStoryPressRef.current = true;
          const sid = String(story?.id || story?._id || story?.storyId || '').trim();
          const mediaUrl = story?.mediaUrl || story?.imageUrl || story?.videoUrl || story?.image || story?.video;
          if (mediaUrl) {
            setStoryViewerData({
              stories: [{
                ...story,
                id: sid,
                videoUrl: story.videoUrl || (story.mediaType === 'video' ? mediaUrl : null),
                imageUrl: story.imageUrl || (story.mediaType !== 'video' ? mediaUrl : null)
              }],
              visible: true
            });
          }
          setTimeout(() => { isHandlingStoryPressRef.current = false; }, 500);
        }}
        onPressImage={(url: string) => setViewerImage(url)}
        onPressShare={(msg: any) => {
          const kind = String(msg?.mediaType || '').toLowerCase();
          if (kind === 'post' || kind === 'story') {
            setSharePostItem({ shareType: kind, data: msg.sharedPost || msg.sharedStory });
            setShowShareModal(true);
          } else if (kind === 'image' || kind === 'video') {
            setSharePostItem({
              shareType: kind,
              mediaUrl: msg.mediaUrl || msg.imageUrl,
              thumbnailUrl: msg.thumbnailUrl
            });
            setShowShareModal(true);
          }
        }}
        onPlayStart={(id: string) => setActiveSoundId(id)}
        onSwipeReply={handleSwipeReply}
        onDoubleTapHeart={handleDoubleTapHeart}
        onPressReactionsBadge={(mId: string, rx: any) => setReactionsModalData({ visible: true, messageId: mId, reactions: rx })}
        onRetry={handleRetryMessage}
        isSearchMatch={isSearchMatch}
        isCurrentSearchMatch={isCurrentSearchMatch}
      />
    );
  }, [currentUserId, otherUserId, resolvedOtherUserId, myIds, displayName, avatarUri, isGroupConversation, activeSoundId, formatTimeForBubble, handleReaction, handleMessageLongPress, handleSwipeReply, handleDoubleTapHeart, searchMatchingIds, currentSearchMatchId, handleRetryMessage]);

  const renderContent = () => {
    const hasThreadContext = !!(conversationId || otherUserId || paramConversationId || messages.length > 0);
    const isResolving = (otherUserId || paramConversationId) && !conversationId;

    if (!hasThreadContext && (loading || isResolving)) {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
          <ActivityIndicator size="large" color={COLORS.primary || "#FF6B00"} />
        </View>
      );
    }

    if (!conversationId && !loading && !isResolving && !otherUserId && !paramConversationId) {
      return (
        <View style={styles.centered}>
          <Text style={{ color: '#94a3b8', marginBottom: 12 }}>Could not start chat</Text>
          <TouchableOpacity onPress={() => safeRouterBack('/inbox')} style={{ backgroundColor: COLORS.primary || '#FF6B00', padding: 10, borderRadius: 8 }}>
            <Text style={{ color: '#fff' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        {(loading || isResolving) && messages.length === 0 ? (
          <View style={{ position: 'absolute', top: 8, left: 0, right: 0, zIndex: 2, alignItems: 'center' }}>
            <ActivityIndicator size="small" color={COLORS.primary || "#FF6B00"} />
          </View>
        ) : null}
        <FlatList
          ref={flatListRef}
          style={{ flex: 1 }}
          data={messagesWithSeparators}
          keyExtractor={(item) => String(item?.tempId || item?.id || item?._id || item?.messageId || Math.random())}
          renderItem={renderChatItem}
          inverted
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          extraData={messages}
          contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="on-drag"
          removeClippedSubviews={Platform.OS !== 'web'}
          maxToRenderPerBatch={16}
          updateCellsBatchingPeriod={30}
          windowSize={11}
          initialNumToRender={18}
          getItemLayout={undefined}
        />
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {isSearchActive ? (
          <View style={styles.searchBarHeader}>
            <Ionicons name="search-outline" size={20} color="#8e8e93" style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchBarInput}
              placeholder="Search in conversation..."
              placeholderTextColor="#8e8e93"
              value={inChatSearchQuery}
              onChangeText={setInChatSearchQuery}
              autoFocus
            />
            {inChatSearchQuery.trim().length > 0 && (
              <View style={styles.searchMatchControls}>
                <Text style={styles.searchMatchCountText}>
                  {searchMatchingIds.length > 0
                    ? `${activeSearchMatchIndex + 1}/${searchMatchingIds.length}`
                    : '0/0'}
                </Text>
                <TouchableOpacity
                  style={styles.searchArrowBtn}
                  onPress={handlePrevSearchMatch}
                  disabled={searchMatchingIds.length === 0}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel="Previous match"
                >
                  <Ionicons name="chevron-up" size={18} color={searchMatchingIds.length > 0 ? '#1e293b' : '#cbd5e1'} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.searchArrowBtn}
                  onPress={handleNextSearchMatch}
                  disabled={searchMatchingIds.length === 0}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  accessibilityRole="button"
                  accessibilityLabel="Next match"
                >
                  <Ionicons name="chevron-down" size={18} color={searchMatchingIds.length > 0 ? '#1e293b' : '#cbd5e1'} />
                </TouchableOpacity>
              </View>
            )}
            {inChatSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setInChatSearchQuery('')} style={{ padding: 4, marginRight: 4 }}>
                <Ionicons name="close-circle" size={18} color="#8e8e93" />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleCloseSearch} style={{ paddingHorizontal: 8 }}>
              <Text style={styles.searchBarCancel}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <DMHeader
            displayName={displayName}
            avatarUri={avatarUri}
            isGroup={isGroupConversation}
            verified={otherUserProfile?.verified || otherUserProfile?.isVerified}
            statusText={isTargetBlocked ? '' : (isOtherTyping ? 'typing...' : (otherUserPresence?.status === 'online' ? 'Online' : ''))}
            onBack={() => safeRouterBack()}
            onInfo={() => {
              if (isGroupConversation) {
                handleOpenGroupInfo();
              } else {
                handleOpenChatDetails();
              }
            }}
            onTitlePress={() => {
              if (isGroupConversation) {
                handleOpenGroupInfo();
              } else {
                handleOpenChatDetails();
              }
            }}
          />
        )}
        <View style={{ flex: 1 }}>
          {renderContent()}
        </View>

        {isTargetBlocked ? (
          <View style={styles.blockedBarContainer}>
            <Ionicons name="ban-outline" size={24} color="#8e8e8e" style={{ marginBottom: 4 }} />
            <Text style={styles.blockedBarTitle}>You blocked this account</Text>
            <Text style={styles.blockedBarSub}>
              You cannot message {displayName || 'them'} unless you unblock them.
            </Text>
            <TouchableOpacity
              style={styles.blockedUnblockButton}
              activeOpacity={0.8}
              onPress={handleUnblockTarget}
            >
              <Text style={styles.blockedUnblockButtonText}>Unblock</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <DMInput
            input={input}
            setInput={handleInputChange}
            onSend={handleSend}
            onMediaPress={handlePickImageWrapper}
            onCameraPress={handleLaunchCameraWrapper}
            onMicPressIn={startRecording}
            onMicPressOut={handleStopRecordingWrapper}
            recording={recording}
            recordingDuration={recordingDuration}
            micPulseAnim={micPulseAnim}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
            editingMessage={editingMessage}
            onCancelEdit={() => { setEditingMessage(null); setInput(''); }}
            sending={sending}
          />
        )}
      </KeyboardAvoidingView>

      <Suspense fallback={null}>
        {showShareModal ? (
          <ShareModal
            visible={showShareModal}
            currentUserId={currentUserId!}
            modalVariant="chat"
            sharePayload={sharePostItem}
            onClose={() => setShowShareModal(false)}
            onSend={async () => {
              setShowShareModal(false);
            }}
          />
        ) : null}

        {showEmojiPicker ? (
          <EmojiPicker
            onEmojiSelected={(emoji: any) => setInput(prev => prev + emoji.emoji)}
            open={showEmojiPicker}
            onClose={() => setShowEmojiPicker(false)}
          />
        ) : null}
      </Suspense>

      {/* Interactive Full Screen Image Viewer */}
      <DMImageViewerModal
        visible={!!viewerImage}
        imageUrl={viewerImage}
        onClose={() => setViewerImage(null)}
      />

      {/* Reactions Detail Bottom Sheet */}
      <DMReactionsModal
        visible={!!reactionsModalData?.visible}
        reactions={reactionsModalData?.reactions}
        currentUserId={currentUserId}
        myIds={myIds}
        onClose={() => setReactionsModalData(null)}
        onRemoveReaction={handleRemoveReactionFromModal}
        onUserPress={(uid) => {
          router.push({
            pathname: '/user-profile',
            params: { id: uid, userId: uid }
          } as any);
        }}
      />

      {/* Media Preview Before Sending */}
      <DMMediaPreviewModal
        visible={!!pendingMediaPreview}
        media={pendingMediaPreview}
        recipientName={displayName || 'Chat'}
        recipientAvatar={avatarUri}
        onClose={() => setPendingMediaPreview(null)}
        onSend={handleConfirmSendMedia}
      />

      {storyViewerData.visible && (
        <Suspense fallback={null}>
          <Modal visible={true} transparent={false} animationType="slide">
            <StoriesViewer stories={storyViewerData.stories} onClose={() => setStoryViewerData({ stories: [], visible: false })} />
          </Modal>
        </Suspense>
      )}

      {/* Message Options & Reactions Menu */}
      <Modal visible={showMessageMenu} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMessageMenu(false)}>
          <View style={styles.instaMenuOptions}>
            {/* Reaction Bar */}
            <View style={styles.reactionBar}>
              {REACTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionBtn}
                  onPress={() => handleReaction(selectedMessage, emoji)}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.reactionBtnPlus}
                onPress={() => {
                  setShowMessageMenu(false);
                  setTimeout(() => setShowEmojiPicker(true), 300);
                }}
              >
                <Ionicons name="add" size={22} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Action Items */}
            <TouchableOpacity
              style={styles.instaMenuItem}
              onPress={() => {
                setReplyingTo({
                  id: getMessageId(selectedMessage),
                  text: selectedMessage?.text || (selectedMessage?.mediaType === 'audio' ? 'Voice note' : 'Media'),
                  senderId: selectedMessage?.senderId,
                  username: selectedMessage?.username || displayName
                });
                setShowMessageMenu(false);
              }}
            >
              <Text style={styles.instaMenuLabel}>Reply</Text>
              <Ionicons name="arrow-undo-outline" size={22} color="#000" />
            </TouchableOpacity>

            {selectedMessage?.text ? (
              <TouchableOpacity
                style={styles.instaMenuItem}
                onPress={() => {
                  Clipboard.setStringAsync(selectedMessage.text).catch(() => {});
                  setShowMessageMenu(false);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
                }}
              >
                <Text style={styles.instaMenuLabel}>Copy Text</Text>
                <Ionicons name="copy-outline" size={22} color="#000" />
              </TouchableOpacity>
            ) : null}

            {menuIsOwn && canEditMessage(selectedMessage) && (
              <TouchableOpacity
                style={styles.instaMenuItem}
                onPress={() => {
                  setEditingMessage(selectedMessage);
                  setInput(selectedMessage.text || '');
                  setShowMessageMenu(false);
                }}
              >
                <Text style={styles.instaMenuLabel}>Edit</Text>
                <Ionicons name="create-outline" size={22} color="#000" />
              </TouchableOpacity>
            )}

            {menuIsOwn && (
              <TouchableOpacity
                style={styles.instaMenuItem}
                onPress={() => handleDeleteMessage(selectedMessage)}
              >
                <Text style={[styles.instaMenuLabel, { color: COLORS.danger || '#FF3B30' }]}>Delete Message</Text>
                <Ionicons name="trash-outline" size={22} color={COLORS.danger || '#FF3B30'} />
              </TouchableOpacity>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dateWrap: { alignSelf: 'center', marginVertical: 24 },
  dateText: { fontSize: 12, color: COLORS.textMuted || '#8e8e93', fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  searchBarHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 0.5,
    borderBottomColor: '#ebebeb',
  },
  searchBarInput: {
    flex: 1,
    fontSize: 15,
    color: '#000',
    paddingVertical: 8,
  },
  searchBarCancel: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary || '#FF6B00',
  },
  searchMatchControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 6,
    gap: 3,
  },
  searchMatchCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginRight: 4,
  },
  searchArrowBtn: {
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instaMenuOptions: {
    backgroundColor: COLORS.card || '#fff',
    borderRadius: 15,
    overflow: 'hidden',
    marginHorizontal: 20,
    marginBottom: 30,
  },
  instaMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border || '#ebebeb',
  },
  instaMenuLabel: { fontSize: 16, fontWeight: '500', color: COLORS.textPrimary || '#000' },
  reactionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8, gap: 4 },
  reactionBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reactionEmoji: { fontSize: 24 },
  reactionBtnPlus: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.inputBg || '#f2f2f2', alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
  blockedBarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    backgroundColor: COLORS.card || '#fff',
    borderTopWidth: 0.5,
    borderTopColor: COLORS.border || '#ebebeb',
  },
  blockedBarTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary || '#000',
    marginTop: 4,
    marginBottom: 4,
  },
  blockedBarSub: {
    fontSize: 13,
    color: COLORS.textSecondary || '#8e8e93',
    textAlign: 'center',
    marginBottom: 12,
  },
  blockedUnblockButton: {
    backgroundColor: COLORS.primary || '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
  },
  blockedUnblockButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
