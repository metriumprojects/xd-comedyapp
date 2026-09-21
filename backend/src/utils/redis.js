const Redis = require('ioredis');
const logger = require('./logger');

let redis;
let isConnected = false;

/**
 * Returns connection configuration options suitable for both ioredis and BullMQ.
 */
function getRedisConnectionConfig() {
  let redisUrl = process.env.REDIS_URL;
  if (redisUrl && redisUrl.trim()) {
    redisUrl = redisUrl.trim();
    const isUpstash = redisUrl.includes('upstash.io');
    if (isUpstash && redisUrl.startsWith('redis://')) {
      redisUrl = 'rediss://' + redisUrl.slice(8);
    }
    const isTls = redisUrl.startsWith('rediss://') || isUpstash;
    return {
      url: redisUrl,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
    };
  }

  if (process.env.REDIS_HOST) {
    return {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
    };
  }

  return null;
}

const config = getRedisConnectionConfig();

if (config) {
  try {
    const options = {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) {
          logger.warn('⚠️ Redis connection retries exceeded limit, caching disabled.');
          return null;
        }
        return Math.min(times * 100, 2000);
      },
    };

    if (config.url) {
      if (config.tls) options.tls = config.tls;
      redis = new Redis(config.url, options);
    } else {
      redis = new Redis({
        ...config,
        ...options,
      });
    }

    redis.on('error', (err) => {
      isConnected = false;
      logger.warn('⚠️ Redis Error: %s', err.message);
    });

    redis.on('connect', () => {
      isConnected = true;
      logger.info('✅ Redis connected successfully');
    });

    redis.on('close', () => {
      isConnected = false;
    });

    redis.on('end', () => {
      isConnected = false;
    });
  } catch (e) {
    isConnected = false;
    logger.warn('⚠️ Redis Initialization Error: %s', e.message);
  }
} else {
  logger.info('ℹ️ Redis URL / HOST not provided, caching disabled.');
}

const isRedisAvailable = () => isConnected && !!redis;

const get = async (key) => {
  if (!isRedisAvailable()) return null;
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (e) {
    return null;
  }
};

const set = async (key, value, ttl = 3600) => {
  if (!isRedisAvailable()) return;
  try {
    if (ttl) {
      await redis.set(key, JSON.stringify(value), 'EX', ttl);
    } else {
      await redis.set(key, JSON.stringify(value));
    }
  } catch (e) {
    // Ignore cache write errors
  }
};

const del = async (key) => {
  if (!isRedisAvailable()) return;
  try {
    await redis.del(key);
  } catch (e) {
    // Ignore cache delete errors
  }
};

// In-memory fallback map for offline / development resilience (key -> expiresAtMs)
const memoryLockFallback = new Map();

function pruneMemoryFallback() {
  const now = Date.now();
  for (const [k, exp] of memoryLockFallback.entries()) {
    if (exp <= now) {
      memoryLockFallback.delete(k);
    }
  }
}

/**
 * Attempts to acquire an atomic distributed lock for idempotency.
 * Returns true if the lock was acquired (new event).
 * Returns false if the key already exists (duplicate or in-flight).
 * @param {string} key - Unique key, e.g. 'stripe:evt:evt_123'
 * @param {number} ttlSeconds - Time-to-live in seconds (default 86400 / 24 hours)
 * @returns {Promise<boolean>}
 */
const acquireLock = async (key, ttlSeconds = 86400) => {
  if (isRedisAvailable()) {
    try {
      const result = await redis.set(key, 'processing', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      logger.warn('[Redis] acquireLock error, falling back to memory: %s', err.message);
    }
  }

  // Fallback: In-memory atomic check
  pruneMemoryFallback();
  const now = Date.now();
  const existingExp = memoryLockFallback.get(key);
  if (existingExp && existingExp > now) {
    return false; // Already locked
  }
  memoryLockFallback.set(key, now + ttlSeconds * 1000);
  return true;
};

/**
 * Releases a previously acquired lock (useful when an operation fails and needs retry).
 * @param {string} key
 * @returns {Promise<void>}
 */
const releaseLock = async (key) => {
  if (isRedisAvailable()) {
    try {
      await redis.del(key);
    } catch (err) {
      // Ignore Redis del errors
    }
  }
  memoryLockFallback.delete(key);
};

module.exports = {
  redis,
  isRedisAvailable,
  get,
  set,
  del,
  acquireLock,
  releaseLock,
  getRedisConnectionConfig,
};
