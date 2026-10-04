/**
 * Setup notification listeners
 * Safely handles notification initialization with error handling
 */
export function setupNotificationListeners() {
  try {
    // Dynamically import Notifications to avoid early load issues
    const Notifications = require('expo-notifications');
    const { router } = require('expo-router');
    
    if (!Notifications || !Notifications.addNotificationReceivedListener) {
      console.warn('[NotificationHandler] Notifications API not available');
      return;
    }

    // Handle notification received while app is foregrounded
    Notifications.addNotificationReceivedListener((notification: any) => {
      console.log('📬 Notification received:', notification);
    });

    const safeStr = (v: any) => {
      if (v == null) return '';
      const raw = Array.isArray(v) ? String(v[0] || '') : String(v);
      const str = raw.trim();
      if (str === 'undefined' || str === 'null' || str === '[object Object]' || str === '0' || str === 'false') return '';
      return str;
    };

    const handledNotifResponsesSet = new Set<string>();

    const getNotificationResponseId = (response: any): string => {
      const data = response?.notification?.request?.content?.data || {};
      const id =
        response?.notification?.request?.identifier ||
        [
          data?.type,
          data?.postId || data?.post_id,
          data?.storyId || data?.story_id,
          data?.conversationId || data?.conversation_id,
          data?.senderId,
          response?.notification?.date,
        ]
          .filter((x: any) => x != null && String(x).trim() !== '')
          .join('_');
      return String(id || '').trim();
    };

    const handleNotificationResponse = async (response: any) => {
      try {
        const notifId = getNotificationResponseId(response);
        if (notifId) {
          if (handledNotifResponsesSet.has(notifId)) {
            console.log('[NotificationHandler] Notification response already handled in memory:', notifId);
            return;
          }
          handledNotifResponsesSet.add(notifId);
          try {
            const AsyncStorage = require('@/lib/storage').default;
            await AsyncStorage.setItem(`handled_notif_resp_${notifId}`, 'true');
          } catch {}
        } else {
          const fallbackKey = `anon_${Date.now()}`;
          if (handledNotifResponsesSet.has('anon_recent')) return;
          handledNotifResponsesSet.add('anon_recent');
          setTimeout(() => handledNotifResponsesSet.delete('anon_recent'), 2500);
          handledNotifResponsesSet.add(fallbackKey);
        }

        console.log('☝️ Notification response:', JSON.stringify(response, null, 2));
        
        const data = response?.notification?.request?.content?.data;
        console.log('📦 Notification data:', JSON.stringify(data, null, 2));
        
        const type = safeStr(data?.type).toLowerCase();
        const screenHint = safeStr(data?.screen).toLowerCase();
        const senderId = safeStr(data?.senderId || data?.sender?._id || data?.sender?.id || data?.fromUserId || data?.userId);
        const postId = safeStr(data?.postId || data?.post_id || data?.post?._id);
        const storyId = safeStr(data?.storyId || data?.story_id || data?.targetId);
        const conversationId = safeStr(data?.conversationId || data?.conversation_id);
        const senderName = safeStr(data?.senderName || data?.sender?.displayName || data?.userName || 'User');

        setTimeout(() => {
          try {
            if (!type && !screenHint && !postId && !storyId && !conversationId && !senderId) {
              return;
            }

            const isMessageType = (
              type === 'message' ||
              type === 'dm' ||
              type === 'chat' ||
              type === 'new_message' ||
              type === 'new-message' ||
              type === 'chat_message' ||
              type === 'chat-message' ||
              type === 'group_message' ||
              type === 'conversation' ||
              screenHint === 'dm' ||
              screenHint === 'chat' ||
              (!type && (conversationId || data?.groupId || data?.chatId))
            );

            if (isMessageType) {
              const targetCId = conversationId || safeStr(data?.groupId || data?.chatId);
              const targetPeer = senderId || safeStr(data?.otherUserId || data?.peerId);
              const qs = `conversationId=${encodeURIComponent(targetCId)}&otherUserId=${encodeURIComponent(targetPeer)}&user=${encodeURIComponent(senderName)}`;
              router.push((targetCId || targetPeer ? `/dm?${qs}` : `/inbox`) as any);
              return;
            }

            if (type === 'passport' || type === 'passport_suggestion' || screenHint === 'passport') {
              router.push('/passport');
              return;
            }

            if (type === 'follow' || type === 'new-follower' || type === 'follow-request' || type === 'follow-approved') {
              if (senderId) router.push((`/user-profile?id=${encodeURIComponent(senderId)}`) as any);
              return;
            }

            if (type === 'like' || type === 'post-like' || type === 'comment' || type === 'post-comment' || type === 'comment-reply' || type === 'comment-like' || type === 'mention' || type === 'tag') {
              const isComment = type.includes('comment');
              if (postId) {
                router.push((`/post-detail?id=${encodeURIComponent(postId)}${isComment ? '&openComments=true' : ''}`) as any);
              } else if (senderId) {
                router.push((`/user-profile?id=${encodeURIComponent(senderId)}`) as any);
              }
              return;
            }

            if (type.startsWith('story')) {
              if (senderId) {
                router.push((`/user-profile?id=${encodeURIComponent(senderId)}&openStory=true${storyId ? '&storyId=' + encodeURIComponent(storyId) : ''}`) as any);
              } else {
                router.push('/(tabs)/home');
              }
              return;
            }
          } catch (error) {
            console.error('❌ Navigation from notification failed:', error);
          }
        }, 300);
      } catch (e) {
        console.error('[NotificationHandler] Error handling notification response:', e);
      }
    };

    // Handle notification tapped
    Notifications.addNotificationResponseReceivedListener(handleNotificationResponse);

    // Handle cold start from notification tap
    Notifications.getLastNotificationResponseAsync().then(async (response: any) => {
      if (!response) return;
      try {
        const notifId = getNotificationResponseId(response);
        if (notifId) {
          const AsyncStorage = require('@/lib/storage').default;
          const alreadyHandled = await AsyncStorage.getItem(`handled_notif_resp_${notifId}`);
          if (alreadyHandled === 'true') {
            console.log('[NotificationHandler] Stale cold-start notification already handled, skipping:', notifId);
            return;
          }
        }
        console.log('[NotificationHandler] Found notification tap response on boot, handling navigation');
        handleNotificationResponse(response);
      } catch (err) {
        console.warn('[NotificationHandler] Error checking cold start response:', err);
      }
    }).catch((err: any) => {
      console.warn('[NotificationHandler] Failed to get last notification response:', err);
    });

    // --- PUSH TOKEN REGISTRATION ---
    (async () => {
      try {
        const { resolveCanonicalUserId } = require('../lib/currentUser');
        const userId = await resolveCanonicalUserId();
        if (!userId) return;

        const { requestNotificationPermissions, getPushNotificationToken, savePushToken } = require('./notificationService');

        const permRes = await requestNotificationPermissions();
        if (!permRes?.success) {
          console.warn('[NotificationHandler] Permission not granted for push notifications');
          return;
        }

        const tokenRes = await getPushNotificationToken();
        if (tokenRes?.success && tokenRes?.token) {
          console.log('🎫 Push Token obtained');
          await savePushToken(userId, tokenRes.token);
          console.log('✅ Push token registered with backend');
        } else {
          console.warn('[NotificationHandler] Could not retrieve push token:', tokenRes?.error);
        }
      } catch (err: any) {
        console.error('[NotificationHandler] Token registration failed:', err?.message || err);
      }
    })();

  } catch (e) {
    console.warn('[NotificationHandler] Failed to setup notification listeners:', e);
  }
}

/**
 * Clear all notifications
 */
export async function clearAllNotifications() {
  try {
    const Notifications = require('expo-notifications');
    if (Notifications && Notifications.dismissAllNotificationsAsync) {
      await Notifications.dismissAllNotificationsAsync();
    }
  } catch (e) {
    console.warn('[NotificationHandler] Failed to clear notifications:', e);
  }
}

