const { Expo } = require('expo-server-sdk');
const logger = require('../src/utils/logger');

// Create a new Expo SDK client
const expo = new Expo();

/**
 * Validate data payload size for Expo (max 4KB)
 */
function validateDataSize(data) {
  try {
    const size = Buffer.byteLength(JSON.stringify(data));
    if (size > 4000) {
      logger.warn('⚠️ Push notification data too large (%d bytes), trimming...', size);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Send push notification to a single device
 */
async function sendPushNotification(pushToken, title, body, data = {}) {
  if (!pushToken || typeof pushToken !== 'string') {
    return { success: false, error: 'No push token provided' };
  }

  // Expo / FCM / APNs require string values in `data`
  const stringData = {};
  if (data && typeof data === 'object') {
    for (const [k, v] of Object.entries(data)) {
      if (v == null) continue;
      stringData[k] = typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    }
  }

  if (!Expo.isExpoPushToken(pushToken)) {
    // Attempt fallback via Firebase Cloud Messaging if it's a native FCM / APNs device token
    try {
      const admin = require('firebase-admin');
      if (admin.apps && admin.apps.length > 0) {
        const fcmMessage = {
          token: pushToken,
          notification: { title, body },
          data: stringData,
          android: { priority: 'high', notification: { sound: 'default', channelId: 'default' } },
          apns: { payload: { aps: { sound: 'default', ...(data?.badge != null ? { badge: Number(data.badge) } : {}) } } }
        };
        const res = await admin.messaging().send(fcmMessage);
        logger.info('✅ Native FCM Push notification sent: %s', res);
        return { success: true, messageId: res };
      }
    } catch (fcmErr) {
      logger.warn('⚠️ Native FCM Push fallback error for %s: %s', pushToken, fcmErr.message);
    }
    return { success: false, error: 'Invalid push token format' };
  }

  validateDataSize(stringData);

  const message = {
    to: pushToken,
    sound: 'default',
    title: title,
    body: body,
    data: stringData,
    priority: 'high',
    channelId: 'default',
    ttl: 0,
    _displayInForeground: true,
    ...(data?.badge != null ? { badge: Number(data.badge) } : {}),
  };

  try {
    const start = Date.now();
    const ticketChunk = await expo.sendPushNotificationsAsync([message]);
    const duration = Date.now() - start;
    
    logger.info('✅ Push notification sent in %dms to %s (ticket: %j)', duration, pushToken, ticketChunk[0]);
    
    return { 
      success: true, 
      ticket: ticketChunk[0],
      message: 'Push notification sent successfully'
    };
  } catch (error) {
    logger.error('❌ Push notification error for %s: %s', pushToken, error.message);
    return { 
      success: false, 
      error: error.message || 'Failed to send push notification'
    };
  }
}

/**
 * Send push notifications to multiple devices (handles chunking automatically)
 */
async function sendBulkPushNotifications(notifications) {
  const messages = [];
  
  for (const notif of notifications) {
    if (!Expo.isExpoPushToken(notif.pushToken)) {
      logger.warn(`⚠️ Skipping invalid token: ${notif.pushToken}`);
      continue;
    }

    const stringData = {};
    if (notif.data && typeof notif.data === 'object') {
      for (const [k, v] of Object.entries(notif.data)) {
        if (v == null) continue;
        stringData[k] = typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v) : String(v));
      }
    }
    
    messages.push({
      to: notif.pushToken,
      sound: 'default',
      title: notif.title,
      body: notif.body,
      data: stringData,
      priority: 'high',
      channelId: 'default',
      ttl: 0,
      _displayInForeground: true,
      ...(notif.badge != null ? { badge: Number(notif.badge) } : {}),
    });
  }

  if (messages.length === 0) return { success: true, count: 0 };

  try {
    logger.info(`📤 Sending ${messages.length} bulk push notifications`);
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    
    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      } catch (error) {
        logger.error('❌ Error sending push notification chunk: %s', error.message);
      }
    }
    
    logger.info(`✅ Successfully processed ${tickets.length} push notification tickets`);
    
    return { 
      success: true, 
      tickets: tickets,
      count: tickets.length
    };
  } catch (error) {
    logger.error('❌ Bulk push notification fatal error: %s', error.message);
    return { 
      success: false, 
      error: error.message || 'Failed to send bulk notifications'
    };
  }
}

/**
 * Send notification based on event type
 */
async function sendEventNotification({ type, recipientToken, senderName, data = {} }) {
  let title, body;
  
  const truncatedComment = (text) => (text && text.length > 50 ? text.substring(0, 47) + '...' : text);

  switch (type) {
    case 'like':
      title = '❤️ New Like';
      body = `${senderName} liked your post`;
      break;
    case 'comment':
      title = '💬 New Comment';
      body = `${senderName} commented: ${truncatedComment(data.comment) || ''}`;
      break;
    case 'follow':
      title = '👥 New Follower';
      body = `${senderName} started following you`;
      break;
    case 'message':
      title = `💌 ${senderName}`;
      body = data.message || 'Sent you a message';
      break;
    case 'story':
    case 'newStory':
    case 'new_story':
    case 'new-story':
      title = '📸 Story Update';
      body = `${senderName} posted a new story`;
      break;
    case 'story_share':
    case 'story-share':
    case 'storyShare':
      title = '📸 Story Shared';
      body = `${senderName} shared your story to their story`;
      break;
    case 'post_story_share':
    case 'postStoryShare':
    case 'post-story-share':
      title = '📸 Post Shared to Story';
      body = `${senderName} shared your post to their story`;
      break;
    case 'story_like':
    case 'storyLike':
    case 'story-like':
      title = '❤️ Story Like';
      body = `${senderName} liked your story`;
      break;
    case 'story_comment':
    case 'storyComment':
    case 'story-comment':
      title = '💬 Story Comment';
      body = (data?.comment || data?.text) ? `${senderName} commented: ${(data.comment || data.text).substring(0, 50)}` : `${senderName} commented on your story`;
      break;
    case 'live':
      title = '🔴 Live Now';
      body = `${senderName} is live!`;
      break;
    case 'mention':
      title = '🔔 Mention';
      body = `${senderName} mentioned you`;
      break;
    default:
      title = 'New Notification';
      body = `${senderName} interacted with you`;
  }
  
  return await sendPushNotification(recipientToken, title, body, { type, ...data });
}

module.exports = {
  sendPushNotification,
  sendBulkPushNotifications,
  sendEventNotification,
  sendExpoPushToUser: (...args) => require('../src/services/notificationService').sendExpoPushToUser(...args),
};

