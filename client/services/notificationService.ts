import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { API_BASE_URL } from '../lib/api';
import AsyncStorage from '@/lib/storage';
import { apiService } from '../src/_services/apiService';

// Configure notification handler with per-chat mute support
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    try {
      const data = notification?.request?.content?.data;
      const conversationId = String(data?.conversationId || data?.groupId || data?.chatId || '').trim();
      if (conversationId) {
        const isMuted = await AsyncStorage.getItem(`mute_chat_${conversationId}`);
        if (isMuted === 'true') {
          return {
            shouldShowAlert: false,
            shouldPlaySound: false,
            shouldSetBadge: true,
            shouldShowBanner: false,
            shouldShowList: false,
          };
        }
      }
    } catch {}

    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    };
  },
});

/**
 * Request notification permissions and setup high-priority channels
 */
export async function requestNotificationPermissions() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
        sound: 'default',
        showBadge: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('[notificationService] Notification permission denied');
      return { success: false, error: 'Permission denied' };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[notificationService] Error requesting notification permissions:', error?.message || error);
    return { success: false, error };
  }
}

/**
 * Get push notification token (Expo token with native FCM/APNS device token fallback)
 */
export async function getPushNotificationToken() {
  try {
    if (Platform.OS === 'web') {
      console.log('[notificationService] Push notifications not available on web');
      return { success: false, error: 'Not available on web' };
    }

    let projectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId;
    if (!projectId && (Constants as any)?.easConfig?.projectId) {
      projectId = (Constants as any)?.easConfig?.projectId;
    }

    try {
      const expoTokenObj = projectId
        ? await Notifications.getExpoPushTokenAsync({ projectId })
        : await Notifications.getExpoPushTokenAsync();

      if (expoTokenObj?.data) {
        console.log('[notificationService] Obtained Expo Push Token:', expoTokenObj.data.substring(0, 20) + '...');
        return { success: true, token: expoTokenObj.data };
      }
    } catch (expoErr: any) {
      console.warn('[notificationService] Expo push token fetch warning:', expoErr?.message || expoErr);
    }

    // Fallback to native FCM/APNS device push token if Expo push token generation fails
    try {
      const deviceTokenObj = await Notifications.getDevicePushTokenAsync();
      if (deviceTokenObj?.data) {
        const rawToken = typeof deviceTokenObj.data === 'string' ? deviceTokenObj.data : JSON.stringify(deviceTokenObj.data);
        console.log('[notificationService] Obtained Native Device Push Token:', rawToken.substring(0, 20) + '...');
        return { success: true, token: rawToken };
      }
    } catch (deviceErr: any) {
      console.warn('[notificationService] Native device token fetch warning:', deviceErr?.message || deviceErr);
    }

    return { success: false, error: 'Failed to retrieve push token' };
  } catch (error: any) {
    console.error('[notificationService] Error getting push token:', error?.message || error);
    return { success: false, error: error?.message || error };
  }
}

// In-flight deduplication map to prevent parallel duplicate calls
const inFlightTokenMap = new Map<string, Promise<{ success: boolean; cached?: boolean; error?: any }>>();

/**
 * Save push token to user profile
 */
export async function savePushToken(userId: string, token: string) {
  if (!userId || !token) {
    return { success: false, error: 'Missing userId or token' };
  }

  const cacheKey = `last_saved_push_token_${userId}`;

  // 1. Check local cache to avoid redundant network calls on app boot
  try {
    const cachedToken = await AsyncStorage.getItem(cacheKey);
    if (cachedToken === token) {
      return { success: true, cached: true };
    }
  } catch (err) {
    // Ignore cache read failures and proceed
  }

  // 2. In-flight request deduplication
  const inFlightKey = `${userId}:${token}`;
  if (inFlightTokenMap.has(inFlightKey)) {
    return inFlightTokenMap.get(inFlightKey)!;
  }

  const promise = (async () => {
    try {
      // apiService handles base URL, auth headers, and 401 clearing automatically
      const result = await apiService.put(`/users/${userId}/push-token`, { pushToken: token });

      if (result?.success) {
        console.log('✅ Push token saved to backend');
        try {
          await AsyncStorage.setItem(cacheKey, token);
        } catch { }
        return { success: true };
      } else {
        throw new Error(result?.error || 'Failed to save push token');
      }
    } catch (error: any) {
      console.warn('⚠️ Could not save push token to backend:', error?.message || error);
      return { success: false, error };
    } finally {
      inFlightTokenMap.delete(inFlightKey);
    }
  })();

  inFlightTokenMap.set(inFlightKey, promise);
  return promise;
}

/**
 * Send local notification
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: any
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Show immediately
    });
    return { success: true };
  } catch (error) {
    console.error('Error sending local notification:', error);
    return { success: false, error };
  }
}

/**
 * Schedule notification for later
 */
export async function scheduleNotification(
  title: string,
  body: string,
  seconds: number,
  data?: any
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: { seconds } as Notifications.TimeIntervalTriggerInput,
    });
    return { success: true };
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return { success: false, error };
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return { success: true };
  } catch (error) {
    console.error('Error canceling notifications:', error);
    return { success: false, error };
  }
}

/**
 * Get badge count
 */
export async function getBadgeCount() {
  try {
    const count = await Notifications.getBadgeCountAsync();
    return { success: true, count };
  } catch (error) {
    console.error('Error getting badge count:', error);
    return { success: false, error };
  }
}

/**
 * Set badge count
 */
export async function setBadgeCount(count: number) {
  try {
    await Notifications.setBadgeCountAsync(count);
    return { success: true };
  } catch (error) {
    console.error('Error setting badge count:', error);
    return { success: false, error };
  }
}

/**
 * Handle notification types and create appropriate messages
 */
export function getNotificationMessage(type: string, data: any) {
  switch (type) {
    case 'like':
      return {
        title: '❤️ New Like',
        body: `${data.userName} liked your post`,
      };
    case 'comment':
      return {
        title: '💬 New Comment',
        body: `${data.userName} commented: ${data.commentText?.substring(0, 50)}`,
      };
    case 'follow':
      return {
        title: '👤 New Follower',
        body: `${data.userName} started following you`,
      };
    case 'message':
      return {
        title: `💌 ${data.userName}`,
        body: data.messageText?.substring(0, 100) || 'Sent you a message',
      };
    case 'mention':
      return {
        title: '📢 You were mentioned',
        body: `${data.userName} mentioned you in a ${data.postType || 'post'}`,
      };
    case 'tag':
      return {
        title: '🏷️ Tagged in post',
        body: `${data.userName} tagged you in a post`,
      };
    default:
      return {
        title: 'Notification',
        body: data.message || 'You have a new notification',
      };
  }
}

/**
 * Setup notification listeners
 */
export function setupNotificationListeners(
  onNotificationReceived?: (notification: Notifications.Notification) => void,
  onNotificationTapped?: (response: Notifications.NotificationResponse) => void
) {
  // Listener for when notification is received while app is open
  const receivedListener = Notifications.addNotificationReceivedListener((notification) => {
    console.log('Notification received:', notification);
    onNotificationReceived?.(notification);
  });

  // Listener for when notification is tapped
  const responseListener = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('Notification tapped:', response);
    onNotificationTapped?.(response);
  });

  // Return cleanup function
  return () => {
    receivedListener?.remove();
    responseListener?.remove();
  };
}
