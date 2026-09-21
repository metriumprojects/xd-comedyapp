import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@/lib/storage';
import { apiService } from './apiService';
import { uploadMedia } from '../../lib/firebaseHelpers/messages';
import { feedEventEmitter } from '../../lib/feedEventEmitter';
import { patchInboxLastMessage } from './inboxCache';

export interface OutboxMessage {
  tempId: string;
  conversationId: string;
  currentUserId: string;
  otherUserId?: string;
  text?: string;
  mediaType?: 'text' | 'image' | 'video' | 'audio';
  mediaUri?: string;
  replyTo?: any;
  extra?: any;
  createdAt: number;
  status: 'pending' | 'sending' | 'failed';
}

const STORAGE_KEY = '@dm_offline_outbox';
let isProcessingQueue = false;
let cachedIsOnline = true;

NetInfo.fetch().then((state) => {
  cachedIsOnline = state.isConnected !== false && state.isInternetReachable !== false;
}).catch(() => {});

export function getCachedIsOnline(): boolean {
  return cachedIsOnline;
}

export function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = String(err?.message || err?.error || err || '').toLowerCase();
  return (
    msg.includes('network error') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused') ||
    msg.includes('econnreset') ||
    msg.includes('offline') ||
    msg.includes('socket') ||
    msg.includes('internet') ||
    err?.code === 'ECONNABORTED' ||
    err?.code === 'ERR_NETWORK'
  );
}

export async function getOfflineOutbox(conversationId?: string): Promise<OutboxMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: OutboxMessage[] = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    if (conversationId) {
      const cid = String(conversationId);
      return parsed.filter((m) => String(m.conversationId) === cid);
    }
    return parsed;
  } catch {
    return [];
  }
}

export async function enqueueOfflineMessage(item: OutboxMessage): Promise<void> {
  try {
    const all = await getOfflineOutbox();
    // Prevent duplicate entries by tempId
    const filtered = all.filter((m) => m.tempId !== item.tempId);
    filtered.push(item);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch (err) {
    console.warn('[dmOfflineQueue] Failed to enqueue message:', err);
  }
}

export async function removeOfflineMessage(tempId: string): Promise<void> {
  try {
    const all = await getOfflineOutbox();
    const next = all.filter((m) => m.tempId !== tempId);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[dmOfflineQueue] Failed to remove message:', err);
  }
}

export async function updateOfflineMessageStatus(
  tempId: string,
  status: 'pending' | 'sending' | 'failed'
): Promise<void> {
  try {
    const all = await getOfflineOutbox();
    const next = all.map((m) => (m.tempId === tempId ? { ...m, status } : m));
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('[dmOfflineQueue] Failed to update status:', err);
  }
}

export async function processOfflineQueue(): Promise<void> {
  if (isProcessingQueue) return;

  const netState = await NetInfo.fetch();
  if (!netState.isConnected || netState.isInternetReachable === false) {
    return;
  }

  isProcessingQueue = true;

  try {
    const outbox = await getOfflineOutbox();
    const pending = outbox
      .filter((m) => m.status === 'pending' || m.status === 'sending')
      .sort((a, b) => a.createdAt - b.createdAt);

    for (const msg of pending) {
      // Re-verify network state before each transmission
      const currentNet = await NetInfo.fetch();
      if (!currentNet.isConnected || currentNet.isInternetReachable === false) {
        break;
      }

      await updateOfflineMessageStatus(msg.tempId, 'sending');

      if (!msg.mediaType || msg.mediaType === 'text') {
        try {
          const payload: any = {
            senderId: msg.currentUserId,
            text: msg.text || '',
            read: false,
            tempId: msg.tempId,
          };
          if (msg.otherUserId) payload.recipientId = msg.otherUserId;
          if (msg.replyTo) {
            payload.replyTo = {
              id: msg.replyTo.id,
              text: msg.replyTo.text,
              senderId: msg.replyTo.senderId,
            };
          }
          const res: any = await apiService.post(`/conversations/${msg.conversationId}/messages`, payload);

          if (res?.success && (res?.message || res?.data)) {
            const backendMsg = res?.message || res?.data;
            await removeOfflineMessage(msg.tempId);
            feedEventEmitter.emitFeedUpdate({
              type: 'DM_MESSAGE_SENT',
              conversationId: msg.conversationId,
              messageId: msg.tempId,
              text: msg.text,
              data: backendMsg,
            });
            if (msg.conversationId && msg.text) {
              patchInboxLastMessage(msg.conversationId, msg.text);
            }
          } else if (isNetworkError(res?.error)) {
            // Keep in queue as pending for next reconnection
            await updateOfflineMessageStatus(msg.tempId, 'pending');
            break;
          } else {
            // Permanent failure (e.g. blocked or validation error)
            await updateOfflineMessageStatus(msg.tempId, 'failed');
            feedEventEmitter.emitFeedUpdate({
              type: 'DM_MESSAGE_FAILED',
              conversationId: msg.conversationId,
              messageId: msg.tempId,
              data: { error: res?.error || 'Send failed' },
            });
          }
        } catch (err: any) {
          if (isNetworkError(err)) {
            await updateOfflineMessageStatus(msg.tempId, 'pending');
            break;
          } else {
            await updateOfflineMessageStatus(msg.tempId, 'failed');
            feedEventEmitter.emitFeedUpdate({
              type: 'DM_MESSAGE_FAILED',
              conversationId: msg.conversationId,
              messageId: msg.tempId,
              data: { error: err?.message || 'Send failed' },
            });
          }
        }
      } else if (msg.mediaUri) {
        try {
          const uploadRes: any = await uploadMedia(msg.mediaUri, msg.mediaType as any);
          if (uploadRes?.success) {
            const uploadedUrl = uploadRes?.url || uploadRes?.data?.url || uploadRes?.secureUrl;
            const mediaPayload: any = {
              senderId: msg.currentUserId,
              mediaUrl: uploadedUrl,
              mediaType: msg.mediaType,
              read: false,
              tempId: msg.tempId,
              ...(msg.extra || {}),
            };
            if (msg.otherUserId) mediaPayload.recipientId = msg.otherUserId;
            if (uploadRes?.thumbnailUrl || uploadRes?.data?.thumbnailUrl) {
              mediaPayload.thumbnailUrl = uploadRes?.thumbnailUrl || uploadRes?.data?.thumbnailUrl;
            }
            const res: any = await apiService.post(`/conversations/${msg.conversationId}/messages/media`, mediaPayload);

            if (res?.success) {
              const backendMsg = res?.data || res?.message;
              await removeOfflineMessage(msg.tempId);
              feedEventEmitter.emitFeedUpdate({
                type: 'DM_MESSAGE_SENT',
                conversationId: msg.conversationId,
                messageId: msg.tempId,
                data: backendMsg,
              });
              const preview = msg.extra?.text || (msg.mediaType === 'audio' ? 'Voice note' : (msg.mediaType === 'video' ? 'Video' : 'Photo'));
              if (msg.conversationId) {
                patchInboxLastMessage(msg.conversationId, preview);
              }
            } else if (isNetworkError(res?.error)) {
              await updateOfflineMessageStatus(msg.tempId, 'pending');
              break;
            } else {
              await updateOfflineMessageStatus(msg.tempId, 'failed');
              feedEventEmitter.emitFeedUpdate({
                type: 'DM_MESSAGE_FAILED',
                conversationId: msg.conversationId,
                messageId: msg.tempId,
                data: { error: res?.error || 'Media send failed' },
              });
            }
          } else if (isNetworkError(uploadRes?.error)) {
            await updateOfflineMessageStatus(msg.tempId, 'pending');
            break;
          } else {
            await updateOfflineMessageStatus(msg.tempId, 'failed');
            feedEventEmitter.emitFeedUpdate({
              type: 'DM_MESSAGE_FAILED',
              conversationId: msg.conversationId,
              messageId: msg.tempId,
              data: { error: uploadRes?.error || 'Upload failed' },
            });
          }
        } catch (err: any) {
          if (isNetworkError(err)) {
            await updateOfflineMessageStatus(msg.tempId, 'pending');
            break;
          } else {
            await updateOfflineMessageStatus(msg.tempId, 'failed');
            feedEventEmitter.emitFeedUpdate({
              type: 'DM_MESSAGE_FAILED',
              conversationId: msg.conversationId,
              messageId: msg.tempId,
              data: { error: err?.message || 'Send failed' },
            });
          }
        }
      }
    }
  } catch (queueErr) {
    console.warn('[dmOfflineQueue] Queue execution error:', queueErr);
  } finally {
    isProcessingQueue = false;
  }
}

// Auto-trigger on connectivity restoration
NetInfo.addEventListener((state) => {
  if (state.isConnected && state.isInternetReachable !== false) {
    processOfflineQueue().catch(() => {});
  }
});

// Auto-trigger when app returns to foreground
AppState.addEventListener('change', (nextState) => {
  if (nextState === 'active') {
    processOfflineQueue().catch(() => {});
  }
});
