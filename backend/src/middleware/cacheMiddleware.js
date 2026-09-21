const cache = require('../utils/redis');

/**
 * Cache middleware for Express routes
 * Scopes cache key by authenticated user (req.userId) to prevent cross-user data leaks.
 * @param {number} ttl - Time to live in seconds
 */
const cacheMiddleware = (ttl = 3600) => {
  return async (req, res, next) => {
    // Skip caching if Redis is not connected or it's not a GET request
    if (!cache.isRedisAvailable() || req.method !== 'GET') {
      return next();
    }

    // Isolate cache by viewer if logged in to prevent data leaks across accounts
    const userScope = req.userId ? `u:${req.userId}:` : 'anon:';
    const key = `cache:${userScope}${req.originalUrl || req.url}`;
    
    try {
      const cachedData = await cache.get(key);
      if (cachedData) {
        return res.json(cachedData);
      }

      // Override res.json to capture and cache the response
      const originalJson = res.json;
      res.json = (data) => {
        if (res.statusCode === 200) {
          cache.set(key, data, ttl);
        }
        return originalJson.call(res, data);
      };

      next();
    } catch (err) {
      next();
    }
  };
};

module.exports = cacheMiddleware;
