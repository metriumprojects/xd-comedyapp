import { Feather, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, FlatList, Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View, Pressable, useWindowDimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ExpoImage } from 'expo-image';
import { Audio } from 'expo-av';
import AsyncStorage from '@/lib/storage';
import * as FileSystem from 'expo-file-system';
import {
    addNotification,
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
import {
  toTimestampMs,
  normalizeMessage,
  mergeMessages,
  createTempId,
  dedupeById,
  getMessageId,
} from '../src/_services/dmHelpers';
import { apiService } from '../src/_services/apiService';
import { useAppStore } from '@/store/useAppStore';
import DMHeader from '../src/_components/dm/DMHeader';
import DMInput from '../src/_components/dm/DMInput';

import * as ImagePicker from 'expo-image-picker';
import { DEFAULT_AVATAR_URL } from '@/lib/api';
import { useAppDialog } from '@/src/_components/AppDialogProvider';
import { useOfflineBanner } from '../hooks/useOffline';
import { useDM } from '../hooks/useDM';
import { useDMMedia } from '../hooks/useDMMedia';
import { normalizeMediaUrl, normalizeAvatarUrl } from '../lib/utils/media';
import { toDate, getRelativeTime } from '../lib/utils/date';
import { OfflineBanner } from '@/src/_components/OfflineBanner';
import COLORS from '@/src/theme/colors';
import { 
  subscribeToMessages as socketSubscribeToMessages,
  initializeSocket,
  sendTypingIndicator,
  stopTypingIndicator,
  subscribeToTyping
} from '../src/_services/socketService';

import MessageBubble from '../src/_components/MessageBubble';
import ShareModal from '../src/_components/ShareModal';
import StoriesViewer from '../src/_components/StoriesViewer';
import EmojiPicker from 'rn-emoji-keyboard';

const REACTIONS = ['❤️', '🙌', '🔥', '👏', '😢', '😍', '😮'];

/** Simple hook to fetch peer profile */
function useUserProfile(uid: string | null) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!uid) return;
    setLoading(true);
    getUserProfile(uid).then(res => {
      if (res?.success) setProfile(res.data);
    }).finally(() => setLoading(false));
  }, [uid]);
  return { profile, loading };
}

// Missing exports from messaging helpers that were used in dm.tsx
import { 
  uploadMedia, 
  sendMediaMessage as sendMediaMessageApi,
  extensionFromFileUri 
} from '../lib/firebaseHelpers/messages';

import { 
  subscribeToUserStatus as socketSubscribeToUserStatus,
  requestUserStatus
} from '../src/_services/socketService';

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
const ChatItem = React.memo(({ item, currentUserId, displayName, avatarUri, activeSoundId, formatTime, onReaction, onLongPress, onPressPost, onPressStory, onPressImage, onPressShare, onPlayStart }: any) => {
  if (item.type === 'date') return <View style={styles.dateWrap}><Text style={styles.dateText}>{item.date}</Text></View>;
  
  return (
    <MessageBubble
      {...item}
      id={getMessageId(item) || item.id}
      isSelf={item.senderId === currentUserId}
      formatTime={formatTime}
      username={displayName}
      currentUserId={currentUserId!}
      avatarUrl={avatarUri}
      onReaction={(emoji: string) => onReaction(item, emoji)}
      reactions={item.reactions}
      onLongPress={() => onLongPress(item)}
      onPressPost={onPressPost}
      onPressStory={onPressStory}
      onPressImage={onPressImage}
      onPressShare={() => onPressShare(item)}
      activeSoundId={activeSoundId}
      onPlayStart={onPlayStart}
      sent={item.sent !== false}
      delivered={item.delivered || !!item.readAt}
      read={!!item.readAt}
    />
  );
});

export default function DM() {
  const insets = useSafeAreaInsets();
  const { showSuccess } = useAppDialog();
  const { showBanner } = useOfflineBanner();
  const params = useLocalSearchParams();
  const router = useRouter();
  const rawParamConversationId = params.conversationId as unknown;
  const paramConversationId: string | null = Array.isArray(rawParamConversationId)
    ? (rawParamConversationId[0] as string) || null
    : (typeof rawParamConversationId === 'string' ? rawParamConversationId : null);
  const isGroupParam = String((params as any)?.isGroup || '') === '1';
  
  const otherUserId: string | null = (() => {
    const raw = (params.otherUserId ?? params.id) as unknown;
    if (Array.isArray(raw)) return (raw[0] as string) || null;
    return typeof raw === 'string' ? raw : null;
  })();

  const seedPeerDisplayName = useMemo(() => {
    const raw = (params as any)?.user as unknown;
    const s = Array.isArray(raw) ? String(raw[0] ?? '') : typeof raw === 'string' ? raw : '';
    return s.trim();
  }, [(params as any)?.user]);

  const storeUserId = useAppStore((s) => s.userId);
  const [currentUserId, setCurrentUserId] = useState<string | null>(storeUserId);

  useEffect(() => {
    if (!currentUserId && storeUserId) {
      setCurrentUserId(storeUserId);
    } else if (!currentUserId) {
      // Emergency recovery from storage
      AsyncStorage.getItem('userId').then(id => {
        if (id) setCurrentUserId(id);
      });
    }
  }, [storeUserId, currentUserId]);
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
    // Only scroll if it's from the other person or if we are near bottom
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
  const [replyingTo, setReplyingTo] = useState<{ id: string; text: string; senderId: string } | null>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [activeSoundId, setActiveSoundId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showOptionsModal, setShowOptionsModal] = useState(false);
  const [sharePostItem, setSharePostItem] = useState<any>(null);
  const [viewerImage, setViewerImage] = useState<string | null>(null);
  const [storyViewerData, setStoryViewerData] = useState<{ stories: any[]; visible: boolean }>({ stories: [], visible: false });
  const [otherUserPresence, setOtherUserPresence] = useState<any | null>(null);

  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTempIdsRef = useRef<Set<string>>(new Set());

  const handleInputChange = (text: string) => {
    setInput(text);
    if (!conversationId || !currentUserId || !otherUserId) return;
    sendTypingIndicator({ conversationId, userId: currentUserId, recipientId: otherUserId });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      stopTypingIndicator({ conversationId, userId: currentUserId, recipientId: otherUserId });
    }, 2000);
  };

  const messagesWithSeparators = useMemo(() => {
    // Deduplicate messages by ID (multiple fetch strategies can return overlapping results)
    const seen = new Set<string>();
    const unique = messages.filter(msg => {
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
  }, [messages]);

  const { profile: otherUserProfile } = useUserProfile(otherUserId);
  const isGroupConversation = isGroupParam || !!conversationMeta?.isGroup;

  const displayName = useMemo(() => {
    if (isGroupConversation) {
      return conversationMeta?.groupName || seedPeerDisplayName || 'Group';
    }
    const fromApi = (otherUserProfile?.displayName && String(otherUserProfile.displayName).trim()) || (otherUserProfile?.name && String(otherUserProfile.name).trim()) || (otherUserProfile?.username && String(otherUserProfile.username).trim()) || '';
    return fromApi || seedPeerDisplayName || 'User';
  }, [conversationMeta?.groupName, isGroupConversation, otherUserProfile, seedPeerDisplayName]);

  const avatarUri = isGroupConversation ? (conversationMeta?.groupAvatar || DEFAULT_AVATAR_URL) : (otherUserProfile?.avatar || otherUserProfile?.photoURL || DEFAULT_AVATAR_URL);



  useEffect(() => {
    if (!conversationId || !currentUserId || isGroupConversation) return;
    const unsub = subscribeToUserPresence(otherUserId!, (p) => setOtherUserPresence(p));
    return () => unsub();
  }, [conversationId, currentUserId, otherUserId, isGroupConversation]);

  const handleStopRecordingWrapper = async () => {
    const res = await stopRecording();
    if (res?.uri) {
      sendMediaMessage('audio', res.uri, { audioDuration: res.duration });
    }
  };

  const sendMediaMessage = async (type: string, uri: string, extra: any = {}) => {
    if (!conversationId || !currentUserId) return;
    const tempId = createTempId(`temp_${type}`);
    const sentAtMs = Date.now();
    const tempMsg = {
      id: tempId,
      senderId: currentUserId,
      mediaType: type,
      mediaUrl: uri,
      createdAt: new Date(sentAtMs).toISOString(),
      __ts: sentAtMs,
      sent: false,
      tempOrigin: true,
      ...extra
    };
    
    setMessages(prev => [...prev, tempMsg]);

    try {
      let uploadRes: any;
      const isLocalUri = typeof uri === 'string' && (
        uri.startsWith('file://') ||
        uri.startsWith('ph://') ||
        uri.startsWith('assets-library://') ||
        uri.startsWith('content://') ||
        uri.startsWith('/')
      );
      let finalUri = uri;
      if (isLocalUri) {
        try {
          const { compressVideoSafe, compressImageSafe } = require('../lib/mediaUtils');
          if (type === 'video') {
            if (__DEV__) console.log('[DM] Compressing local video:', uri);
            finalUri = await compressVideoSafe(uri);
          } else if (type === 'image') {
            if (__DEV__) console.log('[DM] Compressing local image:', uri);
            finalUri = await compressImageSafe(uri);
          }
        } catch (compressErr) {
          console.warn('[DM] Media compression failed:', compressErr);
        }
      }

      if (isLocalUri) {
        uploadRes = await uploadMedia(finalUri, type as any);
      } else if (typeof uri === 'string' && (uri.startsWith('http://') || uri.startsWith('https://'))) {
        // Remote URI — uploadMedia handles downloading/re-uploading
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
          const finalMsg = normalizeMessage((res as any).data || (res as any).message);
          setMessages(prev => prev.map(m => m.id === tempId ? { ...finalMsg, sent: true } : m));
          return;
        }
      }
      // Instead of filtering out, mark as failed
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, failed: true } : m));
    } catch (e) {
      console.error('Media send error:', e);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, failed: true } : m));
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    if (!currentUserId) {
      Alert.alert('Error', 'User ID not found. Please log in again.');
      return;
    }
    if (sending) return;
    
    // We can proceed even if conversationId is null
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
          setInput("");
        }
      } catch (e) {
        Alert.alert('Error', 'Failed to edit message');
      } finally {
        setSending(false);
      }
      return;
    }
    const replyData = replyingTo;
    setInput("");
    setReplyingTo(null);
    setSending(true);
    const tempId = createTempId('temp_text');
    const sentAtMs = Date.now();
    const tempMsg = normalizeMessage({ id: tempId, senderId: currentUserId, text: msgText, createdAt: new Date(sentAtMs).toISOString(), __ts: sentAtMs, sent: false, tempOrigin: true, replyTo: replyData });
    setMessages(prev => [tempMsg, ...prev]);
    
    // Scroll to bottom (offset 0 in inverted list)
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    }, 100);

    try {
      const validCId = (conversationId && conversationId !== 'null' && conversationId !== 'undefined') ? conversationId : null;

      const res = await sendMessage(validCId as any, String(currentUserId), msgText, otherUserId || undefined, replyData, tempId);

      if (res?.success && ((res as any).message || (res as any).data)) {
        const backendMsg = (res as any).message || (res as any).data;
        // Force the same timestamp as temp message to avoid jumping around
        const finalized = normalizeMessage({ 
          ...backendMsg, 
          timestamp: backendMsg.timestamp || new Date(sentAtMs).toISOString(),
          sent: true 
        });

        
        setMessages(prev => {
          // Remove temp, add final, then dedupe and sort
          const filtered = prev.filter(m => String(m.id) !== String(tempId) && String(m.id) !== String(finalized.id));
          return mergeMessages(filtered, [finalized]);
        });
      } else {
        if (__DEV__) console.warn('[DM] Send failed: no message object in response');
        // Mark as failed instead of removing, so it doesn't "disappear"
        setMessages(prev => prev.map(m => String(m.id) === String(tempId) ? { ...m, failed: true, sent: false } : m));
        Alert.alert('Send Failed', res?.error || 'Server did not accept the message');
      }
    } catch (e: any) {
      if (__DEV__) console.error('[DM] Send exception:', e?.message);
      // NEVER filter it out, just mark as failed so it stays on screen!
      setMessages(prev => prev.map(m => String(m.id) === String(tempId) ? { ...m, failed: true, sent: false } : m));
      Alert.alert('Error', 'Failed to send message: ' + (e?.message || 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  const handlePickImageWrapper = async () => {
    const res = await handlePickImage();
    if (res) {
      const mType = (res.type === 'video' || (res as any).mediaType === 'video') ? 'video' : 'image';
      await sendMediaMessage(mType, res.uri);
    }
  };

  const handleLaunchCameraWrapper = async () => {
    const res = await handleLaunchCamera();
    if (res) await sendMediaMessage('image', res.uri);
  };

  const handleReaction = async (itemOrEmoji: any, emojiStr?: string) => {
    const targetMsg = emojiStr ? itemOrEmoji : selectedMessage;
    const emoji = (emojiStr || itemOrEmoji) as string;
    if (!conversationId || !targetMsg || !currentUserId) return;

    setMessages(prev => {
      const updated = prev.map(m => {
        if (getMessageId(m) === getMessageId(targetMsg)) {
          const currentReactions = { ...(m.reactions || {}) };
          const userList = [...(currentReactions[emoji] || [])];
          if (userList.includes(currentUserId)) {
            currentReactions[emoji] = userList.filter(id => id !== currentUserId);
            if (currentReactions[emoji].length === 0) delete currentReactions[emoji];
          } else {
            currentReactions[emoji] = [...userList, currentUserId];
          }
          return { ...m, reactions: currentReactions };
        }
        return m;
      });
      return updated;
    });

    await reactToMessage(conversationId as string, getMessageId(targetMsg), currentUserId as string, emoji);
    setShowMessageMenu(false);
    setSelectedMessage(null);
  };

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
            // Optimistically remove from state
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

  const handleClearChat = async () => {
    if (!conversationId) return;
    setShowOptionsModal(false);
    Alert.alert("Clear Chat?", "Wipe message history for you?", [
      { text: "Cancel", style: "cancel" },
      { text: "Clear", style: "destructive", onPress: async () => {
        const res = await clearConversation(conversationId);
        if (res?.success) {
          setMessages([]);
          // Clear memory cache in Zustand store for all possible variant cache keys
          try {
            useAppStore.getState().setCachedMessages(conversationId, []);
            if (otherUserId && currentUserId) {
              const concatId1 = `${currentUserId}_${otherUserId}`;
              const concatId2 = `${otherUserId}_${currentUserId}`;
              useAppStore.getState().setCachedMessages(concatId1, []);
              useAppStore.getState().setCachedMessages(concatId2, []);
              AsyncStorage.removeItem(`messages_cache_${concatId1}`).catch(() => {});
              AsyncStorage.removeItem(`messages_cache_${concatId2}`).catch(() => {});
            }
          } catch (err) {
            console.warn('[handleClearChat] Zustand clear failed:', err);
          }
          // Clear AsyncStorage disk cache for current key
          AsyncStorage.removeItem(`messages_cache_${conversationId}`).catch(() => {});
          showSuccess("Chat cleared successfully!");
        } else {
          Alert.alert("Error", res?.error || "Failed to clear chat on server.");
        }
      }}
    ]);
  };

  const formatTimeForBubble = useCallback((t: any) => {
    const date = new Date(t);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, []);

  const renderChatItem = useCallback(({ item }: { item: any }) => (
    <ChatItem
      item={item}
      currentUserId={currentUserId}
      displayName={displayName}
      avatarUri={avatarUri}
      activeSoundId={activeSoundId}
      formatTime={formatTimeForBubble}
      onReaction={handleReaction}
      onLongPress={(msg: any) => {
        setSelectedMessage(msg);
        setShowMessageMenu(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      }}
      onPressPost={(post: any) => {
        const resolved = post?.sharedPost || post;
        const pid = resolved?.id || resolved?._id || resolved?.postId;
        if (pid) router.push({ pathname: '/post-detail', params: { id: String(pid) } } as any);
      }}
      onPressStory={(story: any) => {
         const sid = story?.id || story?._id || story?.storyId;
         if (!sid) return;
         const mediaUrl = story?.mediaUrl || story?.imageUrl || story?.videoUrl || story?.image || story?.video;
         if (mediaUrl) {
           setStoryViewerData({ stories: [{ ...story, id: sid, videoUrl: story.videoUrl || (story.mediaType === 'video' ? mediaUrl : null), imageUrl: story.imageUrl || (story.mediaType !== 'video' ? mediaUrl : null) }], visible: true });
         }
      }}
      onPressImage={(url: string) => setViewerImage(url)}
      onPressShare={(msg: any) => {
        const kind = String(msg?.mediaType || '').toLowerCase();
        if (kind === 'post' || kind === 'story') {
          setSharePostItem({ shareType: kind, data: msg.sharedPost || msg.sharedStory });
          setShowShareModal(true);
        } else if (kind === 'image' || kind === 'video') {
          setSharePostItem({ shareType: kind, mediaUrl: msg.mediaUrl, thumbnailUrl: msg.thumbnailUrl });
          setShowShareModal(true);
        }
      }}
      onPlayStart={(id: string) => setActiveSoundId(id)}    />
  ), [currentUserId, displayName, avatarUri, activeSoundId, formatTimeForBubble]);

  const renderContent = () => {
    // Only show global loader if we have NO messages and are loading.
    // This allows cached messages to show instantly like Instagram.
    if (loading && messages.length === 0) {
      return <View style={styles.centered}><ActivityIndicator size="large" color={COLORS.primary} /></View>;
    }
    
    if (!conversationId && !loading) {
       return (
         <View style={styles.centered}>
           <Text style={{ color: '#94a3b8', marginBottom: 12 }}>Could not start chat</Text>
           <TouchableOpacity onPress={() => router.back()} style={{ backgroundColor: COLORS.primary, padding: 10, borderRadius: 8 }}>
             <Text style={{ color: COLORS.textLight }}>Go Back</Text>
           </TouchableOpacity>
         </View>
       );
    }

    return (
      <FlatList
        ref={flatListRef}
        style={{ flex: 1 }}
        data={messagesWithSeparators}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderChatItem}
        inverted
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        extraData={messages}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 16 }}
        keyboardShouldPersistTaps="handled"
      />
    );
  };
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}>
        <DMHeader
          displayName={displayName}
          avatarUri={avatarUri}
          isGroup={isGroupConversation}
          statusText={isOtherTyping ? 'typing...' : (otherUserPresence?.status === 'online' ? 'Online' : '')}
          onBack={() => safeRouterBack()}
          onInfo={() => setShowOptionsModal(true)}
          onTitlePress={() => {
            if (isGroupConversation) {
              setShowOptionsModal(true);
            } else if (otherUserId) {
              router.push({
                pathname: '/user-profile',
                params: { uid: otherUserId }
              } as any);
            }
          }}
        />
        <View style={{ flex: 1 }}>
          {renderContent()}
        </View>
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
          sending={sending}
        />
      </KeyboardAvoidingView>

      <ShareModal 
        visible={showShareModal}
        currentUserId={currentUserId!}
        modalVariant="chat"
        sharePayload={sharePostItem}
        onClose={() => setShowShareModal(false)}
        onSend={async (userIds) => {
          setShowShareModal(false);
          // Optimistic UI: add shared post message immediately to the current DM
          if (sharePostItem && conversationId && currentUserId) {
            const kind = String(sharePostItem?.shareType || 'post').toLowerCase();
            const data = sharePostItem?.data ?? sharePostItem;
            const tempId = createTempId('temp_share');
            const sentAtMs = Date.now();
            const tempMsg = normalizeMessage({
              id: tempId,
              senderId: currentUserId,
              mediaType: kind,
              createdAt: new Date(sentAtMs).toISOString(),
              __ts: sentAtMs,
              sent: false,
              tempOrigin: true,
              ...(kind === 'post' ? { sharedPost: data } : { sharedStory: data }),
            });
            setMessages(prev => [tempMsg, ...prev]);
            setTimeout(() => {
              flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
            }, 100);
          }
        }}
      />

      <EmojiPicker 
        onEmojiSelected={(emoji) => setInput(prev => prev + emoji.emoji)}
        open={showEmojiPicker}
        onClose={() => setShowEmojiPicker(false)}
      />

      <Modal visible={showOptionsModal} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowOptionsModal(false)}>
          <View style={styles.optionsContainer}>
            <View style={styles.optionsHandle} />
            <Text style={styles.optionsTitle}>Chat Settings</Text>
            <TouchableOpacity style={styles.optionsItem} onPress={handleClearChat}>
              <Ionicons name="trash-outline" size={24} color={COLORS.danger} />
              <Text style={[styles.optionsLabel, { color: COLORS.danger }]}>Clear Chat</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* Full Screen Image Viewer */}
      <Modal visible={!!viewerImage} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center' }}>
          <TouchableOpacity style={{ position: 'absolute', top: 50, right: 20, zIndex: 10 }} onPress={() => setViewerImage(null)}>
            <Ionicons name="close" size={32} color={COLORS.textLight} />
          </TouchableOpacity>
          <Image source={{ uri: viewerImage! }} style={{ width: '100%', height: '80%', resizeMode: 'contain' }} />
        </View>
      </Modal>

      {storyViewerData.visible && <Modal visible={true} transparent={false} animationType="slide">
        <StoriesViewer stories={storyViewerData.stories} onClose={() => setStoryViewerData({ stories: [], visible: false })} />
      </Modal>}

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
             <TouchableOpacity style={styles.instaMenuItem} onPress={() => { setReplyingTo(selectedMessage); setShowMessageMenu(false); }}>
               <Text style={styles.instaMenuLabel}>Reply</Text>
               <Ionicons name="arrow-undo-outline" size={22} color={COLORS.black} />
             </TouchableOpacity>
             {(selectedMessage?.senderId === currentUserId || selectedMessage?.isSelf) && (!selectedMessage?.mediaType || selectedMessage?.mediaType === 'text') && (
               <TouchableOpacity style={styles.instaMenuItem} onPress={() => { setEditingMessage(selectedMessage); setInput(selectedMessage.text); setShowMessageMenu(false); }}>
                 <Text style={styles.instaMenuLabel}>Edit</Text>
                 <Ionicons name="create-outline" size={22} color={COLORS.black} />
               </TouchableOpacity>
             )}
             {(selectedMessage?.senderId === currentUserId || selectedMessage?.isSelf) && (
               <TouchableOpacity style={styles.instaMenuItem} onPress={() => handleDeleteMessage(selectedMessage)}>
                 <Text style={[styles.instaMenuLabel, { color: COLORS.danger }]}>Delete Message</Text>
                 <Ionicons name="trash-outline" size={22} color={COLORS.danger} />
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
  dateText: { fontSize: 12, color: COLORS.textMuted, fontWeight: '500' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  optionsContainer: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, paddingBottom: 40, paddingHorizontal: 20 },
  optionsHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  optionsTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginBottom: 20, color: COLORS.textPrimary },
  optionsItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  optionsLabel: { marginLeft: 15, fontSize: 16, fontWeight: '500', color: COLORS.textPrimary },
  instaMenuOptions: { backgroundColor: COLORS.card, borderRadius: 15, overflow: 'hidden', marginHorizontal: 20, marginBottom: 20 },
  instaMenuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 0.5, borderTopColor: COLORS.border },
  instaMenuLabel: { fontSize: 16, fontWeight: '500', color: COLORS.textPrimary },
  reactionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 8, gap: 4 },
  reactionBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  reactionEmoji: { fontSize: 24 },
  reactionBtnPlus: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.inputBg, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
});
