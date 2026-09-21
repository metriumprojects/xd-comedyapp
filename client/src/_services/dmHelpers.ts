import { DEFAULT_AVATAR_URL } from '@/lib/api';

export const toTimestampMs = (raw: any): number => {
  if (!raw || raw === 'null' || raw === 'undefined') return Date.now();
  if (raw instanceof Date) return raw.getTime();

  if (typeof raw === 'object') {
    const anyRaw: any = raw;
    if (typeof anyRaw?.toDate === 'function') {
      try {
        const d = anyRaw.toDate();
        if (d instanceof Date) return d.getTime();
      } catch { }
    }
    const s = anyRaw?.seconds ?? anyRaw?._seconds;
    const ns = anyRaw?.nanoseconds ?? anyRaw?._nanoseconds ?? 0;
    if (typeof s === 'number' && Number.isFinite(s)) {
      const extra = typeof ns === 'number' && Number.isFinite(ns) ? Math.floor(ns / 1_000_000) : 0;
      return s * 1000 + extra;
    }
  }

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw > 0 && raw < 10_000_000_000) return raw * 1000;
    return raw;
  }

  const parsed = Date.parse(String(raw));
  return Number.isFinite(parsed) ? parsed : Date.now();
};

export const normalizeMessage = (m: any): any => {
  if (!m) return m;

  // Extract raw document from Mongoose wrapper if present
  const raw = m._doc || m;
  
  // Safe deep copy to strip non-serializable fields & circular references
  let clean: any = {};
  try {
    clean = JSON.parse(JSON.stringify(raw));
  } catch (e) {
    const keys = [
      'id', '_id', 'conversationId', 'senderId', 'recipientId', 'text', 
      'mediaType', 'mediaUrl', 'mediaUrls', 'audioUrl', 'audioDuration', 
      'thumbnailUrl', 'sharedPost', 'sharedStory', 'replyTo', 'reactions', 
      'readBy', 'read', 'delivered', 'timestamp', 'createdAt', 'tempId',
      'editedAt', 'isEdited'
    ];
    keys.forEach(k => {
      if (raw[k] !== undefined) {
        if (typeof raw[k] === 'object' && raw[k] !== null) {
          try {
            clean[k] = JSON.parse(JSON.stringify(raw[k]));
          } catch {
            clean[k] = {};
          }
        } else {
          clean[k] = raw[k];
        }
      }
    });
  }

  // Preserve reactions if raw was a Map (JSON.stringify converts Map to {})
  if (raw?.reactions instanceof Map) {
    const mapObj: Record<string, string[]> = {};
    raw.reactions.forEach((val: any, key: any) => {
      if (Array.isArray(val) && val.length > 0) mapObj[String(key)] = val.map(String);
    });
    clean.reactions = mapObj;
  }

  const source = clean;

  const rawText = typeof source?.text === 'string' ? source.text : '';
  const trimmedText = rawText.trim();
  const legacyStoryMatch = rawText.match(/story[:;]\/\/([A-Za-z0-9_-]+)|Shared a story:\s*([A-Za-z0-9_-]+)/i);
  const legacyStoryId = legacyStoryMatch?.[1] || legacyStoryMatch?.[2] || '';

  const normalizedMediaType = source?.mediaType || source?.type || source?.messageType
    || (source?.audioUrl ? 'audio' : undefined)
    || ((source?.audioDuration || source?.duration) && !trimmedText ? 'audio' : undefined)
    || (source?.sharedStory ? 'story' : undefined)
    || (legacyStoryId ? 'story' : undefined)
    || (typeof (source?.mediaUrl || source?.url || source?.fileUrl) === 'string' && /\.(m4a|aac|mp3|wav|ogg)(\?|$)/i.test(String(source?.mediaUrl || source?.url || source?.fileUrl)) ? 'audio' : undefined)
    || (typeof (source?.mediaUrl || source?.url || source?.fileUrl) === 'string' && /\.(mp4|mov|webm)(\?|$)/i.test(String(source?.mediaUrl || source?.url || source?.fileUrl)) ? 'video' : undefined)
    || (typeof (source?.mediaUrl || source?.url || source?.fileUrl) === 'string' && /\.(jpe?g|png|gif|webp)(\?|$)/i.test(String(source?.mediaUrl || source?.url || source?.fileUrl)) ? 'image' : undefined)
    || (source?.imageUrl ? 'image' : undefined)
    || (source?.sharedPost ? 'post' : undefined);

  const normalizedMediaUrl = source?.mediaUrl || source?.url || source?.fileUrl || source?.attachmentUrl || source?.media?.url || source?.imageUrl;
  const normalizedAudioUrl = source?.audioUrl || (normalizedMediaType === 'audio' ? normalizedMediaUrl : undefined);
  const normalizedAudioDuration = source?.audioDuration || source?.duration;

  const id = source?.id || source?._id || source?.messageId || `local_${Date.now()}`;
  
  const rootCreatedAt = source?.createdAt;
  const rootTimestamp = source?.timestamp;
  const resolvedCreatedAt = rootCreatedAt || rootTimestamp || new Date().toISOString();
  const resolvedTimestamp = rootTimestamp || rootCreatedAt || new Date().toISOString();
  
  const base = {
    ...source,
    id: String(id),
    createdAt: resolvedCreatedAt,
    timestamp: resolvedTimestamp,
    mediaType: normalizedMediaType,
    ...(source?.editedAt ? { editedAt: source.editedAt, isEdited: true } : (source?.isEdited ? { isEdited: true } : {})),
    ...(legacyStoryId && !source?.sharedStory
      ? {
          sharedStory: {
            storyId: legacyStoryId,
            id: legacyStoryId,
            userId: source?.senderId,
            userName: 'Story',
            userAvatar: DEFAULT_AVATAR_URL,
          }
        }
      : {}),
    ...(normalizedMediaUrl ? { mediaUrl: normalizedMediaUrl } : {}),
    ...(normalizedAudioUrl ? { audioUrl: normalizedAudioUrl } : {}),
    ...(normalizedAudioDuration ? { audioDuration: normalizedAudioDuration } : {}),
  };

  const t = toTimestampMs(resolvedCreatedAt);
  return { ...base, __ts: t };
};

export const mergeMessages = (existing: any[], incoming: any[]): any[] => {
  const map = new Map<string, any>();
  const tempIdToKeyMap = new Map<string, string>();

  existing.forEach((m) => {
    const key = String(m.id || m._id || m.messageId || '');
    if (!key) return;
    map.set(key, m);
    if (m.tempId) {
      tempIdToKeyMap.set(String(m.tempId), key);
    }
    if (key.startsWith('temp_') || m.tempOrigin) {
      tempIdToKeyMap.set(key, key);
    }
  });

  incoming.forEach((m) => {
    const n = normalizeMessage(m);
    const nId = String(n.id || n._id || n.messageId || '');
    if (!nId) return;

    // Check if incoming matches an existing temp/optimistic message
    let matchingTempKey: string | undefined = undefined;
    if (n.tempId && tempIdToKeyMap.has(String(n.tempId))) {
      matchingTempKey = tempIdToKeyMap.get(String(n.tempId));
    } else if (tempIdToKeyMap.has(nId)) {
      matchingTempKey = tempIdToKeyMap.get(nId);
    } else {
      // Fallback: match by unconfirmed sender message with same content sent within 15 seconds
      const existingList = Array.from(map.values());
      const fuzzyMatch = existingList.find((ex) => {
        if (ex.sent === true || (!ex.tempOrigin && !String(ex.id).startsWith('temp_'))) return false;
        if (String(ex.senderId) !== String(n.senderId)) return false;
        const exText = String(ex.text || ex.caption || '').trim();
        const nText = String(n.text || n.caption || '').trim();
        if (exText && nText && exText !== nText) return false;
        const timeDiff = Math.abs((ex.__ts || 0) - (n.__ts || 0));
        return timeDiff < 15000;
      });
      if (fuzzyMatch) {
        matchingTempKey = String(fuzzyMatch.id || fuzzyMatch._id || fuzzyMatch.messageId);
      }
    }

    if (matchingTempKey && map.has(matchingTempKey)) {
      const prev = map.get(matchingTempKey);
      if (matchingTempKey !== nId) {
        map.delete(matchingTempKey);
      }
      map.set(nId, {
        ...prev,
        ...n,
        id: nId,
        tempId: prev.tempId || n.tempId || matchingTempKey,
        sent: true,
        failed: false,
        reactions: { ...(prev.reactions || {}), ...(n.reactions || {}) },
      });
      if (prev.tempId) tempIdToKeyMap.set(String(prev.tempId), nId);
      tempIdToKeyMap.set(matchingTempKey, nId);
    } else {
      const prev = map.get(nId) || {};
      map.set(nId, {
        ...prev,
        ...n,
        tempId: prev.tempId || n.tempId,
        reactions: { ...(prev.reactions || {}), ...(n.reactions || {}) },
      });
    }
  });

  return Array.from(map.values()).sort((a, b) => (b.__ts || 0) - (a.__ts || 0));
};

export const createTempId = (prefix: string = 'temp') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

export const dedupeById = (messages: any[]): any[] => {
  const seen = new Set();
  return messages.filter(m => {
    const id = m.id || m._id || m.messageId;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export const getMessageId = (m: any): string => String(m?.id || m?._id || m?.messageId || '');

export const getFormattedActiveStatus = (presence: any): string => {
  if (!presence) return 'Active';
  if (presence.online) return 'Online';
  if (!presence.lastActive) return 'Active';
  
  const lastActive = toTimestampMs(presence.lastActive);
  const diff = Date.now() - lastActive;
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return 'Active';
};

export const clearConversationCaches = (convoId?: string | null, otherUserId?: string | null, currentUserId?: string | null) => {
  const keysToClear = new Set<string>();
  if (convoId) keysToClear.add(String(convoId));
  if (otherUserId) keysToClear.add(String(otherUserId));
  if (currentUserId && otherUserId) {
    keysToClear.add([String(currentUserId), String(otherUserId)].sort().join('_'));
    keysToClear.add(`${currentUserId}_${otherUserId}`);
    keysToClear.add(`${otherUserId}_${currentUserId}`);
  }

  try {
    const { useAppStore } = require('@/store/useAppStore');
    const AsyncStorage = require('@/lib/storage').default;
    const { feedEventEmitter } = require('@/lib/feedEventEmitter');

    keysToClear.forEach((key) => {
      try {
        useAppStore.getState().setCachedMessages(key, []);
      } catch {}
      AsyncStorage.removeItem(`messages_cache_${key}`).catch(() => {});
      AsyncStorage.removeItem(`convo_meta_${key}`).catch(() => {});
    });

    feedEventEmitter.emitFeedUpdate({
      type: 'CHAT_CLEARED',
      userId: otherUserId ? String(otherUserId) : undefined,
      blockedUserId: otherUserId ? String(otherUserId) : undefined,
      data: { conversationId: convoId, otherUserId },
    });
  } catch (err) {
    console.warn('[clearConversationCaches] Error clearing caches:', err);
  }
};

