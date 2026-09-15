const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

/**
 * Smart Key Generator:
 * Uses authenticated User ID if token is available (prevents mobile tower CGNAT collision),
 * otherwise falls back to sanitized client IP address.
 */
function getUserKey(req) {
  // 1. Direct req.userId from verifyToken
  if (req.userId) {
    return `uid_${req.userId}`;
  }

  // 2. Extract from Authorization Bearer token without full DB verification (lightweight)
  const auth = req.headers && req.headers.authorization;
  if (auth && typeof auth === 'string' && auth.startsWith('Bearer ')) {
    try {
      const decoded = jwt.decode(auth.substring(7));
      if (decoded && decoded.userId) {
        return `uid_${decoded.userId}`;
      }
    } catch (_) {}
  }

  // 3. Fallback to client IP
  const forwarded = req.headers && req.headers['x-forwarded-for'];
  if (forwarded && typeof forwarded === 'string') {
    return `ip_${forwarded.split(',')[0].trim()}`;
  }
  return `ip_${req.ip || req.connection?.remoteAddress || 'unknown'}`;
}

const isProduction = process.env.NODE_ENV === 'production';

// 1. Global API Limiter (Generous general limit)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 2000 : 999999,
  keyGenerator: getUserKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please slow down and try again shortly.',
  },
});

// 2. Media Upload Limiter (Protects 512MB RAM on Render and AWS S3 costs)
const uploadLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: isProduction ? 15 : 999999, // Max 15 uploads per 5 minutes per user
  keyGenerator: getUserKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Upload limit reached (15 uploads per 5 minutes). Please wait a moment before uploading more media.',
  },
});

// 3. Comment Anti-Spam Limiter
const commentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 45 : 999999, // Max 45 comments per 15 min per user
  keyGenerator: getUserKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'You are commenting too fast. Please wait a moment before posting another comment.',
  },
});

// 4. Post Creation Limiter
const postCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 15 : 999999, // Max 15 posts per 15 min per user
  keyGenerator: getUserKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Post creation limit reached. Please wait a few minutes before sharing another post.',
  },
});

// 5. Heavy Database Search Limiter
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isProduction ? 40 : 999999, // Max 40 searches per minute per user
  keyGenerator: getUserKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Search rate limit exceeded. Please wait a moment before searching again.',
  },
});

module.exports = {
  getUserKey,
  globalLimiter,
  uploadLimiter,
  commentLimiter,
  postCreateLimiter,
  searchLimiter,
};
