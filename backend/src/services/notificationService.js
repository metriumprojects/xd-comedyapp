const mongoose = require('mongoose');
const admin = require('firebase-admin');
const { Expo } = require('expo-server-sdk');
const expo = new Expo();

async function sendExpoPushToUser(recipientId, message) {
  try {
    if (!recipientId) return { success: false, error: 'missing recipientId' };
    const User = mongoose.model('User');

    const rid = String(recipientId);
    const query = {
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(rid) ? new mongoose.Types.ObjectId(rid) : null },
        { firebaseUid: rid },
        { uid: rid },
      ],
    };
    const user = await User.findOne(query);
    const pushToken = user?.pushToken;
    
    if (process.env.NODE_ENV !== 'production' || __DEV__) {
      console.log(`[push] Resolving token for ${rid}:`, {
        foundUser: !!user,
        hasToken: !!pushToken,
        tokenPrefix: pushToken ? pushToken.substring(0, 15) : 'none'
      });
    }

    if (!pushToken || typeof pushToken !== 'string') {
      console.warn(`[push] No pushToken for user ${rid}`);
      return { success: false, error: 'no pushToken' };
    }
    
    // Check if it's an Expo token
    if (Expo.isExpoPushToken(pushToken)) {
      const msg = {
        to: pushToken,
        sound: 'default',
        priority: 'high',
        channelId: 'default',
        ttl: 0,
        _displayInForeground: true,
        badge: 1,
        ...message,
      };

      console.log(`[push] Sending via Expo to ${rid} (${pushToken.substring(0, 10)}...): ${message.title}`);

      const chunks = expo.chunkPushNotifications([msg]);
      for (const chunk of chunks) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          console.log('[push] Expo tickets received:', tickets);
          for (const ticket of tickets) {
            if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
              console.warn(`[push] Unsetting invalid token for ${rid}`);
              await User.updateOne({ _id: user._id }, { $unset: { pushToken: "" } });
            }
          }
        } catch (e) {
          console.warn('[push] Expo send error:', e?.message || e);
        }
      }
      return { success: true };
    } else {
      // Try sending via FCM (Firebase Cloud Messaging)
      console.log(`[push] Sending via FCM to ${rid} (${pushToken.substring(0, 10)}...): ${message.title}`);
      
      try {
        const stringData = {};
        if (message.data && typeof message.data === 'object') {
          for (const [k, v] of Object.entries(message.data)) {
            if (v == null) continue;
            stringData[k] = typeof v === 'string' ? v : (typeof v === 'object' ? JSON.stringify(v) : String(v));
          }
        }

        const fcmMessage = {
          token: pushToken,
          notification: {
            title: message.title,
            body: message.body,
          },
          data: stringData,
          android: {
            priority: 'high',
            notification: {
              sound: 'default',
              channelId: 'default',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              },
            },
          },
        };

        const response = await admin.messaging().send(fcmMessage);
        console.log('[push] FCM message sent successfully:', response);
        return { success: true };
      } catch (fcmError) {
        console.warn('[push] FCM send error:', fcmError?.message || fcmError);
        return { success: false, error: `FCM error: ${fcmError.message}` };
      }
    }
  } catch (e) {
    console.warn('[push] push service failed:', e?.message || e);
    return { success: false, error: e?.message || String(e) };
  }
}

module.exports = {
  sendExpoPushToUser
};

