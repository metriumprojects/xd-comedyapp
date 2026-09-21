const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const Redis = require('ioredis');
const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const mongoose = require('mongoose');
const { registerMessagingSocket } = require('../socket/registerMessagingSocket');
const { toObjectId } = require('../utils/userUtils');
const { sendExpoPushToUser } = require('../services/notificationService');
const { getRedisConnectionConfig } = require('../utils/redis');

const initSockets = (server, secret) => {
  // SECURITY: Use same origin policy as Express CORS — no wildcard in production
  const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
  const io = new Server(server, { 
    cors: { 
      origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
      methods: ['GET', 'POST']
    } 
  });

  // Attach Redis Adapter for Multi-Instance / Cluster Scaling if Redis is configured
  const redisConfig = getRedisConnectionConfig();
  if (redisConfig) {
    try {
      const redisOptions = {
        maxRetriesPerRequest: null,
        enableOfflineQueue: false,
        lazyConnect: true,
      };

      const pubClient = redisConfig.url
        ? new Redis(redisConfig.url, { ...redisOptions, tls: redisConfig.tls })
        : new Redis({ ...redisConfig, ...redisOptions });

      pubClient.on('error', (err) => {
        logger.warn('[Socket.IO Redis Pub Error]: %s', err.message);
      });

      const subClient = pubClient.duplicate();
      subClient.on('error', (err) => {
        logger.warn('[Socket.IO Redis Sub Error]: %s', err.message);
      });

      Promise.all([pubClient.connect(), subClient.connect()])
        .then(() => {
          io.adapter(createAdapter(pubClient, subClient));
          logger.info('✅ Socket.IO Redis Adapter connected (Multi-Instance Scaling Active)');
        })
        .catch((err) => {
          logger.warn('⚠️ Socket.IO Redis Adapter connection failed, running in memory mode: %s', err.message);
        });

      io.redisPubClient = pubClient;
      io.redisSubClient = subClient;
    } catch (adapterErr) {
      logger.warn('⚠️ Could not initialize Socket.IO Redis Adapter: %s', adapterErr.message);
    }
  } else {
    logger.info('ℹ️ Redis not configured - Socket.IO running in standalone in-memory mode.');
  }
  
  // Secure WebSocket Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers.token;
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }
    try {
      const decoded = jwt.verify(token, secret);
      socket.userId = decoded.userId;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  try {
    registerMessagingSocket({ io, mongoose, toObjectId, sendExpoPushToUser });
    logger.info('✅ Socket.IO handlers registered (Authenticated)');
  } catch (e) {
    logger.error('❌ Socket.IO Registration Error: %s', e.message);
  }

  return io;
};

module.exports = initSockets;
