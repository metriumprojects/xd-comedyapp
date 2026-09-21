import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import AsyncStorage from '@/lib/storage';
import { 
  fetchMessages, 
  getOrCreateConversation, 
  getUserProfile, 
  sendMessage, 
  editMessage,
  deleteMessage,
  reactToMessage
} from '../lib/firebaseHelpers/index';
import { 
  subscribeToMessages, 
  subscribeToMessageDeleted,
  subscribeToMessageEdited,
  sendTypingIndicator, 
  stopTypingIndicator, 
  subscribeToTyping,
  initializeSocket
} from '../src/_services/socketService';
import { 
  normalizeMessage, 
  mergeMessages, 
  createTempId, 
  getMessageId 
} from '../src/_services/dmHelpers';
import { apiService } from '../src/_services/apiService';
import { feedEventEmitter } from '../lib/feedEventEmitter';
import { patchListAvatars, readProfileUpdatePayload } from '../src/utils/patchUserAvatar';
import { useAppStore } from '@/store/useAppStore';

const globalConvoMetaMap = new Map<string, any>();

export function getCachedConvoMeta(convoId?: string | null): any | null {
  if (!convoId) return null;
  return globalConvoMetaMap.get(String(convoId)) || null;
}

export function cacheConvoMeta(convoId: string, meta: any) {
  if (!convoId || !meta) return;
  const key = String(convoId);
  const existing = globalConvoMetaMap.get(key) || {};
  const merged = { ...existing, ...meta };
  globalConvoMetaMap.set(key, merged);
  AsyncStorage.setItem(`convo_meta_${key}`, JSON.stringify(merged)).catch(() => {});
}

export function useDM(conversationIdParam: string | null, otherUserId: string | null, currentUserId: string | null, onMessageReceived?: (msg: any) => void) {
  const { messageCache, setCachedMessages, convoMap } = useAppStore();
  
  // Canonical & Pair Key Aliases
  const canonicalPairKey = useMemo(() => {
    if (currentUserId && otherUserId) {
      return [String(currentUserId), String(otherUserId)].sort().join('_');
    }
    return null;
  }, [currentUserId, otherUserId]);

  const directPairKey = useMemo(() => {
    if (currentUserId && otherUserId) return `${currentUserId}_${otherUserId}`;
    return null;
  }, [currentUserId, otherUserId]);

  const reversePairKey = useMemo(() => {
    if (currentUserId && otherUserId) return `${otherUserId}_${currentUserId}`;
    return null;
  }, [currentUserId, otherUserId]);

  // Resolve conversationId from param or global map
  const normalizedParamId = (conversationIdParam && conversationIdParam !== 'null' && conversationIdParam !== 'undefined')
    ? conversationIdParam
    : null;
  const resolvedConvoId = normalizedParamId || (otherUserId ? convoMap[otherUserId] : null);
  
  const [conversationId, setConversationId] = useState<string | null>(resolvedConvoId);
  
  const conversationIdRef = useRef<string | null>(resolvedConvoId);
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  // Helper to get all valid cache key aliases
  const getAllCacheKeys = useCallback(() => {
    return Array.from(new Set([
      conversationIdRef.current,
      conversationId,
      resolvedConvoId,
      canonicalPairKey,
      directPairKey,
      reversePairKey,
      otherUserId ? convoMap[otherUserId] : null
    ].filter(Boolean) as string[]));
  }, [conversationId, resolvedConvoId, canonicalPairKey, directPairKey, reversePairKey, otherUserId, convoMap]);

  // Initialize from memory cache across ALL key aliases for 0ms instant UI
  const [messages, setMessagesRaw] = useState<any[]>(() => {
    const keysToTry = [
      conversationIdParam,
      resolvedConvoId,
      canonicalPairKey,
      directPairKey,
      reversePairKey,
      otherUserId ? convoMap[otherUserId] : null
    ].filter(Boolean) as string[];

    for (const k of keysToTry) {
      if (Array.isArray(messageCache[k]) && messageCache[k].length > 0) {
        return messageCache[k];
      }
    }
    return [];
  });

  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistRef = useRef<{ keys: string[]; messages: any[] } | null>(null);

  const setMessages = useCallback((val: any[] | ((prev: any[]) => any[])) => {
    setMessagesRaw((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      if (Array.isArray(next)) {
        const keys = getAllCacheKeys();
        // Memory cache: sync (instant reopen deferred out of render updater)
        setTimeout(() => {
          keys.forEach((k) => setCachedMessages(k, next.slice(0, 40)));
        }, 0);
        // Disk: debounced write
        pendingPersistRef.current = { keys, messages: next.slice(0, 50) };
        if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
        persistTimerRef.current = setTimeout(() => {
          const pending = pendingPersistRef.current;
          pendingPersistRef.current = null;
          if (!pending) return;
          const payload = JSON.stringify(pending.messages);
          pending.keys.forEach((k) => {
            AsyncStorage.setItem(`messages_cache_${k}`, payload).catch(() => {});
          });
        }, 450);
      }
      return next;
    });
  }, [getAllCacheKeys, setCachedMessages]);

  const [loading, setLoading] = useState(() => {
    if (conversationIdParam || resolvedConvoId) return false;
    const keysToTry = [resolvedConvoId, canonicalPairKey, directPairKey, reversePairKey].filter(Boolean) as string[];
    const hasAnyMemoryCache = keysToTry.some(k => messageCache[k] !== undefined);
    return !hasAnyMemoryCache;
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [skip, setSkip] = useState(0);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [conversationMeta, setConversationMetaRaw] = useState<any | null>(() => {
    const keysToTry = [conversationIdParam, resolvedConvoId, canonicalPairKey, directPairKey].filter(Boolean) as string[];
    for (const k of keysToTry) {
      const cached = getCachedConvoMeta(k);
      if (cached) return cached;
    }
    return null;
  });

  const setConversationMeta = useCallback((meta: any) => {
    setConversationMetaRaw((prev: any) => {
      const merged = prev ? { ...prev, ...meta } : meta;
      const keys = getAllCacheKeys();
      keys.forEach(k => cacheConvoMeta(k, merged));
      return merged;
    });
  }, [getAllCacheKeys]);

  const LIMIT = 40;
  const isNearBottomRef = useRef(true);
  const preloadKeyRef = useRef<string>('');
  const hasPreloadedMessagesRef = useRef<boolean>(false);

  // Initialize/Resolve Conversation
  useEffect(() => {
    if (!currentUserId || !otherUserId || conversationId) return;
    
    const resolveTimeout = setTimeout(() => {
      setLoading(false);
    }, 5000);

    getOrCreateConversation(currentUserId, otherUserId)
      .then((res) => {
        clearTimeout(resolveTimeout);
        if (res?.success && res.conversationId) {
          setConversationId(res.conversationId);
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        clearTimeout(resolveTimeout);
        setLoading(false);
      });

    return () => clearTimeout(resolveTimeout);
  }, [currentUserId, otherUserId, conversationId]);

  // Global Safety Timeout for Loading
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      setLoading(false);
    }, 5000);
    return () => clearTimeout(t);
  }, [loading]);

  // Warm Start Cache Loading from Disk Across All Key Aliases
  useEffect(() => {
    const keysToTry = getAllCacheKeys();
    if (keysToTry.length === 0) return;
    
    let mounted = true;

    const loadCache = async () => {
      try {
        const metaKeys = keysToTry.map((k) => `convo_meta_${k}`);
        const msgKeys = keysToTry.map((k) => `messages_cache_${k}`);
        const [metaPairs, msgPairs] = await Promise.all([
          AsyncStorage.multiGet(metaKeys),
          AsyncStorage.multiGet(msgKeys),
        ]);
        if (!mounted) return;

        for (const [, metaRaw] of metaPairs) {
          if (!metaRaw) continue;
          try {
            const metaParsed = JSON.parse(metaRaw);
            if (metaParsed && typeof metaParsed === 'object') {
              setConversationMeta(metaParsed);
              break;
            }
          } catch {}
        }

        for (const [, raw] of msgPairs) {
          if (!raw) continue;
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(prev => mergeMessages(prev, parsed));
              break;
            }
          } catch {}
        }
        hasPreloadedMessagesRef.current = true;
        setLoading(false);
      } catch (e) {
        hasPreloadedMessagesRef.current = true;
        setLoading(false);
      }
    };

    loadCache();
    return () => { mounted = false; };
  }, [conversationId, getAllCacheKeys, setMessages]);

  // Listen for real-time CHAT_CLEARED events to wipe messages state immediately
  useEffect(() => {
    const unsub = feedEventEmitter.onFeedUpdate((event: any) => {
      if (event?.type === 'CHAT_CLEARED') {
        const clearedId = String(event.data?.conversationId || event.conversationId || '').trim();
        const clearedUser = String(event.userId || event.data?.otherUserId || '').trim();
        const keys = getAllCacheKeys();
        
        const isMatch = (clearedId && keys.some(k => k === clearedId || clearedId.includes(k) || k.includes(clearedId)))
          || (clearedUser && otherUserId && String(otherUserId) === clearedUser);

        if (isMatch) {
          setMessagesRaw([]);
          keys.forEach(k => {
            setCachedMessages(k, []);
            AsyncStorage.removeItem(`messages_cache_${k}`).catch(() => {});
          });
        }
      }
    });
    return () => unsub();
  }, [getAllCacheKeys, setCachedMessages, otherUserId]);

  // Load Messages & Setup Socket — Parallel Multi-Strategy Fetching
  useEffect(() => {
    if (!conversationId && !otherUserId) return;
    if (!currentUserId) return;
    
    let cancelled = false;
    const extractMessages = (res: any): any[] => {
      if (!res) return [];
      const raw = res?.data || res?.messages || (Array.isArray(res) ? res : []);
      return Array.isArray(raw) ? raw : [];
    };
    
    const fetchAll = async () => {
      try {
        const primaryKey = conversationId || canonicalPairKey || resolvedConvoId || directPairKey;
        if (!primaryKey) return;

        // Query primary key first
        let res = await fetchMessages(primaryKey).catch(() => null);
        const primaryFailed = res == null;
        let list = extractMessages(res);
        let usedSuccessfulEmpty = !primaryFailed && list.length === 0;

        // Fallback to canonical pair key only if primary key returned empty
        if (list.length === 0 && canonicalPairKey && primaryKey !== canonicalPairKey) {
          const fallbackRes = await fetchMessages(canonicalPairKey).catch(() => null);
          if (fallbackRes != null) {
            const fallbackList = extractMessages(fallbackRes);
            if (fallbackList.length > 0) {
              list = fallbackList;
              usedSuccessfulEmpty = false;
            } else {
              usedSuccessfulEmpty = true;
            }
          }
        }

        if (!cancelled) {
          if (list.length > 0) {
            const normalized = list.map((m: any) => normalizeMessage(m));
            setMessages(prev => mergeMessages(prev, normalized));
          } else if (usedSuccessfulEmpty && !primaryFailed) {
            setMessagesRaw((prev: any[]) => {
              if (Array.isArray(prev) && prev.length > 0) return prev;
              const keys = getAllCacheKeys();
              keys.forEach(k => {
                setCachedMessages(k, []);
                AsyncStorage.removeItem(`messages_cache_${k}`).catch(() => {});
              });
              return [];
            });
          }
        }
      } catch (error) {
        console.error('[DM] Fetch error:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
      
      if (conversationId) {
        apiService.get(`/conversations/${conversationId}`).then(res => {
          if (!cancelled && res?.success) setConversationMeta(res.data);
        }).catch(() => {});
      }
    };

    const memoryHot = (() => {
      try {
        const keys = getAllCacheKeys();
        for (const k of keys) {
          const cached = messageCache?.[k];
          if (Array.isArray(cached) && cached.length > 0) return true;
        }
      } catch {}
      return false;
    })();

    let unsub = () => {};
    let unsubTyping = () => {};

    const startNetwork = () => {
      if (cancelled) return;
      fetchAll();
    };

    if (memoryHot) {
      const { InteractionManager } = require('react-native');
      InteractionManager.runAfterInteractions(() => {
        setTimeout(startNetwork, 50);
      });
    } else {
      startNetwork();
    }

    if (conversationId) {
      unsub = subscribeToMessages(conversationId, (msg) => {
        if (cancelled) return;
        const incoming = normalizeMessage(msg);
        setMessages(prev => mergeMessages(prev, [incoming]));
        if (onMessageReceived) onMessageReceived(incoming);
      }, (reactionData) => {
        // Dedicated reaction handler — patches only .reactions, preserves __ts/sort position
        if (cancelled || !reactionData?.messageId) return;
        const targetId = String(reactionData.messageId);
        setMessages((prev: any[]) =>
          prev.map((m: any) => {
            const mId = String(m.id || m._id || m.messageId || '');
            if (mId === targetId) {
              return { ...m, reactions: reactionData.reactions || {} };
            }
            return m;
          })
        );
      });

      unsubTyping = subscribeToTyping(conversationId, 
        (data) => { if (String(data.userId) === String(otherUserId)) setIsOtherTyping(true); },
        (data) => { if (String(data.userId) === String(otherUserId)) setIsOtherTyping(false); }
      );
    }

    return () => {
      cancelled = true;
      unsub();
      unsubTyping();
    };
  }, [conversationId, currentUserId, otherUserId]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !conversationId) return;
    setLoadingMore(true);
    try {
      const res = await fetchMessages(conversationId, { skip: skip + LIMIT, limit: LIMIT });
      const incoming = Array.isArray(res?.messages) ? res.messages : [];
      if (incoming.length > 0) {
        setMessages(prev => mergeMessages(prev, incoming));
        setSkip(prev => prev + LIMIT);
        setHasMore(res.pagination?.hasMore ?? incoming.length === LIMIT);
      } else {
        setHasMore(false);
      }
    } catch (e) {
      console.warn('Load more error', e);
    } finally {
      setLoadingMore(false);
    }
  }, [conversationId, hasMore, loadingMore, skip]);

  useEffect(() => {
    // @ts-ignore
    const sub = feedEventEmitter.addListener('USER_PROFILE_UPDATED', (data: any) => {
      const payload = readProfileUpdatePayload(data);
      if (!payload) return;
      setMessages((prev) => patchListAvatars(prev, payload.uid, payload.avatar, payload.displayName, payload.username));
    });
    return () => sub.remove();
  }, [setMessages]);

  // Pin open-thread media into durable mirror for offline DM library
  useEffect(() => {
    if (!Array.isArray(messages) || messages.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        const { pinMediaMany, collectMessageMediaUrls } = await import('../src/media/mediaMirror');
        if (cancelled) return;
        const urls = messages.slice(-40).flatMap((m) => collectMessageMediaUrls(m));
        await pinMediaMany(urls, 30);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, [messages]);

  return {
    conversationId,
    messages,
    loading,
    loadingMore,
    hasMore,
    isOtherTyping,
    conversationMeta,
    loadMore,
    clearMessages: () => setMessages([]),
    setLoading,
    setMessages,
    isNearBottomRef
  };
}
