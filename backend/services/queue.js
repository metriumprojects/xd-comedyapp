const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const { sendExpoPushToUser } = require('../src/services/notificationService');
const { getRedisConnectionConfig } = require('../src/utils/redis');

let redisAvailable = false;
let redisClient = null;
let realNotificationQueue = null;
let notificationWorker = null;

const config = getRedisConnectionConfig();

if (config) {
  // Create client to probe connectivity
  const probeOptions = {
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: true,
  };

  if (config.url) {
    if (config.tls) probeOptions.tls = config.tls;
    redisClient = new Redis(config.url, probeOptions);
  } else {
    redisClient = new Redis({
      ...config,
      ...probeOptions,
    });
  }

  // Silence unhandled errors before connect
  redisClient.on('error', () => {});

  console.log('🔍 Checking Redis availability for background jobs...');
  redisClient.connect().then(() => {
    redisAvailable = true;
    console.log('✅ Redis connected - Background queues enabled');

    // Create BullMQ connections:
    // IMPORTANT: BullMQ Worker strictly requires maxRetriesPerRequest: null
    const bullConnection = config.url
      ? new Redis(config.url, {
          tls: config.tls,
          maxRetriesPerRequest: null,
          enableOfflineQueue: false,
        })
      : {
          ...config,
          maxRetriesPerRequest: null,
          enableOfflineQueue: false,
        };

    if (bullConnection instanceof Redis) {
      bullConnection.on('error', () => {});
    }

    realNotificationQueue = new Queue('notifications', { connection: bullConnection });
    realNotificationQueue.on('error', () => {});

    notificationWorker = new Worker('notifications', async job => {
      const { userId, title, body, data, senderId } = job.data;
      console.log(`[Queue] Processing background notification for ${userId}`);

      // 1. Save to Database for in-app history
      try {
        const mongoose = require('mongoose');
        const Notification = mongoose.model('Notification');
        const User = mongoose.model('User');

        let senderName = 'Someone';
        let senderAvatar = null;
        if (senderId) {
          const sender = await User.findOne({
            $or: [
              { _id: mongoose.Types.ObjectId.isValid(senderId) ? new mongoose.Types.ObjectId(senderId) : null },
              { firebaseUid: senderId },
              { uid: senderId }
            ]
          }).select('displayName name avatar photoURL profilePicture').lean();

          if (sender) {
            senderName = sender.displayName || sender.name || 'Someone';
            senderAvatar = sender.avatar || sender.photoURL || sender.profilePicture || null;
          }
        }

        const notification = new Notification({
          recipientId: userId,
          senderId: senderId || null,
          senderName,
          senderAvatar,
          type: data?.type || 'generic',
          message: body,
          data: data || {},
          postId: data?.postId || null,
          storyId: data?.storyId || null,
          read: false,
          createdAt: new Date()
        });
        await notification.save();
      } catch (dbErr) {
        console.warn('[Queue] Failed to save notification to DB:', dbErr.message);
      }

      // 2. Send Push Alert
      return await sendExpoPushToUser(userId, { title, body, data });
    }, { connection: bullConnection });

    notificationWorker.on('error', () => {});
    notificationWorker.on('failed', (job, err) => {
      console.warn(`[Queue] Job ${job?.id} failed: ${err.message}`);
    });
  }).catch(() => {
    redisAvailable = false;
    if (redisClient) {
      redisClient.disconnect();
    }
  });
} else {
  console.log('ℹ️ Redis not configured - background jobs running in inline mode.');
}

const notificationQueue = {
  add: async (type, payload) => {
    if (redisAvailable && realNotificationQueue) {
      try {
        return await realNotificationQueue.add(type, payload);
      } catch (err) {
        return await processInline(payload);
      }
    } else {
      return await processInline(payload);
    }
  }
};

async function processInline(payload) {
  const { userId, title, body, data, senderId } = payload;

  // 1. Save to Database for in-app history (Fire and forget)
  (async () => {
    try {
      const mongoose = require('mongoose');
      const Notification = mongoose.model('Notification');
      const User = mongoose.model('User');

      let senderName = 'Someone';
      let senderAvatar = null;
      if (senderId) {
        const sender = await User.findOne({
          $or: [
            { _id: mongoose.Types.ObjectId.isValid(senderId) ? new mongoose.Types.ObjectId(senderId) : null },
            { firebaseUid: senderId },
            { uid: senderId }
          ]
        }).select('displayName name avatar photoURL profilePicture').lean();

        if (sender) {
          senderName = sender.displayName || sender.name || 'Someone';
          senderAvatar = sender.avatar || sender.photoURL || sender.profilePicture || null;
        }
      }

      const notification = new Notification({
        recipientId: userId,
        senderId: senderId || null,
        senderName,
        senderAvatar,
        type: data?.type || 'generic',
        message: body,
        data: data || {},
        postId: data?.postId || null,
        storyId: data?.storyId || null,
        read: false,
        createdAt: new Date()
      });
      await notification.save();
      console.log(`[Queue] Saved DB notification for ${userId} from ${senderName}`);
    } catch (dbErr) {
      console.warn('[Queue] Failed to save notification to DB:', dbErr.message);
    }
  })();

  // 2. Send Push Alert (Fire and forget)
  sendExpoPushToUser(userId, { title, body, data })
    .catch(err => {
      if (err.message && !err.message.includes('no pushToken')) {
        console.warn('[Inline-Notification] Warning:', err.message);
      }
    });
  return { status: 'processed_inline' };
}

module.exports = {
  notificationQueue,
  redisClient,
  isRedisAvailable: () => redisAvailable,
  get redisAvailable() {
    return redisAvailable;
  }
};
