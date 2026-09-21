const mongoose = require('mongoose');

/**
 * Resolves different user ID variants (MongoDB _id, Firebase UID, etc.)
 * @param {string} inputId The ID string provided in the request
 * @returns {Promise<{raw: string, canonicalId: string, firebaseUid: string|null, candidates: string[]}>}
 */
async function resolveUserIdentifiers(inputId) {
  const raw = String(inputId);
  const User = mongoose.model('User');

  const uniqStrings = (arr) => Array.from(new Set((arr || []).filter(Boolean).map(v => String(v))));

  // Dynamic require to prevent circular references on startup
  let redisClient, isRedisAvailable;
  try {
    const queueService = require('../../services/queue');
    redisClient = queueService.redisClient;
    isRedisAvailable = queueService.isRedisAvailable || (() => queueService.redisAvailable);
  } catch (e) {}

  if (!redisClient) {
    try {
      const redisUtil = require('./redis');
      redisClient = redisUtil.redis;
      isRedisAvailable = redisUtil.isRedisAvailable;
    } catch (e) {}
  }

  const cacheKey = `user:resolve:${raw}`;
  if (isRedisAvailable && isRedisAvailable()) {
    try {
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && Array.isArray(parsed.candidates) && parsed.candidates.length > 0 && parsed.canonicalId) {
          return parsed;
        }
      }
    } catch (cacheErr) {
      // Non-blocking warning
    }
  }

  try {
    // Aggressive lookup: search all possible ID fields for the input string
    let user = await User.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(raw) ? new mongoose.Types.ObjectId(raw) : null },
        { firebaseUid: raw },
        { uid: raw }
      ].filter(q => q._id !== null || q.firebaseUid || q.uid)
    }).select('_id firebaseUid uid').lean();
    
    if (!user && mongoose.Types.ObjectId.isValid(raw)) {
       // fallback for direct ID if for some reason findOne with $or is finicky on some Mongo versions
       user = await User.findById(raw).select('_id firebaseUid uid').lean();
    }

    const canonicalId = user?._id ? String(user._id) : raw;
    const firebaseUid = user?.firebaseUid || user?.uid || null;
    const candidates = uniqStrings([raw, canonicalId, firebaseUid ? String(firebaseUid) : null]);

    const result = { 
      raw, 
      canonicalId, 
      firebaseUid: firebaseUid ? String(firebaseUid) : null, 
      candidates 
    };

    if (isRedisAvailable && isRedisAvailable() && user) {
      try {
        await redisClient.setex(cacheKey, 300, JSON.stringify(result)); // Cache for 5 minutes
      } catch (cacheErr) {
        // Non-blocking write error
      }
    }

    return result;
  } catch (err) {
    console.error('[resolveUserIdentifiers] Error:', err.message);
    return { 
      raw, 
      canonicalId: raw, 
      firebaseUid: null, 
      candidates: uniqStrings([raw]) 
    };
  }
}

const toObjectId = (id) => {
  if (typeof id === 'object' && (id instanceof mongoose.Types.ObjectId || id?._bsontype === 'ObjectId')) return id;
  try {
    return mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : null;
  } catch (err) {
    return null;
  }
};

/**
 * Gets all user IDs involved in blocking with the current user (either blocked by or blocking the current user).
 * @param {string} userId - The current user's ID
 * @returns {Promise<string[]>} - Array of unique string IDs
 */
async function getBlockedUserBoundaries(userId) {
  if (!userId) return [];
  const User = mongoose.model('User');
  const resolved = await resolveUserIdentifiers(userId);
  const userCandidates = resolved.candidates.map(String);

  // Find the user to get their blockedUsers list
  const user = await User.findOne({
    $or: [
      { _id: { $in: userCandidates.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id)) } },
      { firebaseUid: { $in: userCandidates } },
      { uid: { $in: userCandidates } }
    ]
  }).select('blockedUsers').lean();

  const blockedByMe = user?.blockedUsers || [];

  // Find users who blocked me
  const blockedMeUsers = await User.find({
    blockedUsers: { $in: userCandidates }
  }).select('_id firebaseUid uid').lean();

  const blockedMe = blockedMeUsers.flatMap(u => [
    String(u._id),
    u.firebaseUid,
    u.uid
  ]).filter(Boolean);

  // Return unique string identifiers
  return [...new Set([...blockedByMe, ...blockedMe])].map(String);
}

/**
 * Gets IDs of content reported by the specified user
 * @param {string} userId
 * @returns {Promise<{reportedPostIds: string[], reportedCommentIds: string[], reportedUserIds: string[], reportedStoryIds: string[]}>}
 */
async function getReportedContentBoundaries(userId) {
  if (!userId) {
    return { reportedPostIds: [], reportedCommentIds: [], reportedUserIds: [], reportedStoryIds: [] };
  }
  try {
    let Report;
    try {
      Report = mongoose.model('Report');
    } catch {
      Report = require('../models/Report');
    }
    const resolved = await resolveUserIdentifiers(userId);
    const userVariants = resolved.candidates.map(String);

    const reports = await Report.find({
      reporterId: { $in: userVariants },
      status: { $ne: 'dismissed' }
    }).select('targetId targetType').lean();

    const reportedPostIds = [];
    const reportedCommentIds = [];
    const reportedUserIds = [];
    const reportedStoryIds = [];

    for (const r of reports) {
      const tType = String(r.targetType || '').toLowerCase();
      const tId = String(r.targetId || '').trim();
      if (!tId) continue;
      if (tType === 'post') reportedPostIds.push(tId);
      else if (tType === 'comment') reportedCommentIds.push(tId);
      else if (tType === 'user') reportedUserIds.push(tId);
      else if (tType === 'story') reportedStoryIds.push(tId);
    }

    return {
      reportedPostIds: [...new Set(reportedPostIds)],
      reportedCommentIds: [...new Set(reportedCommentIds)],
      reportedUserIds: [...new Set(reportedUserIds)],
      reportedStoryIds: [...new Set(reportedStoryIds)]
    };
  } catch (err) {
    console.error('[getReportedContentBoundaries] Error:', err.message);
    return { reportedPostIds: [], reportedCommentIds: [], reportedUserIds: [], reportedStoryIds: [] };
  }
}

/**
 * Gets all moderation boundaries (blocked users + reported content)
 * @param {string} userId
 */
async function getModerationBoundaries(userId) {
  if (!userId) {
    return {
      blockedUserIds: [],
      reportedPostIds: [],
      reportedCommentIds: [],
      reportedUserIds: [],
      reportedStoryIds: [],
      excludedAuthorIds: []
    };
  }

  const [blockedUserIds, reported] = await Promise.all([
    getBlockedUserBoundaries(userId),
    getReportedContentBoundaries(userId)
  ]);

  const excludedAuthorIds = [...new Set([...blockedUserIds, ...reported.reportedUserIds])];

  return {
    blockedUserIds,
    ...reported,
    excludedAuthorIds
  };
}

/**
 * Strip sensitive fields before sending a user profile to a client.
 * @param {object} user lean user doc
 * @param {{ isSelf?: boolean, locked?: boolean }} opts
 */
function sanitizeUserForViewer(user, opts = {}) {
  if (!user || typeof user !== 'object') return user;
  const isSelf = !!opts.isSelf;
  const locked = !!opts.locked; // private account, viewer has no access

  const avatar =
    user.avatar || user.photoURL || user.profilePicture || null;

  let displayName = typeof user.displayName === 'string' ? user.displayName.trim() : '';
  const isPlaceholder = !displayName || displayName.toLowerCase() === 'user' || displayName.toLowerCase() === 'unknown';
  const email = typeof user.email === 'string' ? user.email.trim() : '';
  if (isPlaceholder && email && email.includes('@')) {
    displayName = email.split('@')[0] || displayName || 'User';
  }
  if (!displayName) displayName = 'User';

  if (locked) {
    return {
      _id: user._id,
      firebaseUid: user.firebaseUid || user.uid || null,
      uid: user.uid || user.firebaseUid || null,
      displayName,
      username: user.username || null,
      avatar,
      photoURL: avatar,
      profilePicture: avatar,
      isPrivate: true,
      isVerified: !!(user.isVerified || user.verified),
      followersCount: user.followersCount || 0,
      followingCount: user.followingCount || 0,
      bio: null,
      email: null,
      website: null,
      location: null,
      phone: null,
      interests: null
    };
  }

  const out = {
    _id: user._id,
    firebaseUid: user.firebaseUid || null,
    uid: user.uid || user.firebaseUid || null,
    displayName,
    username: user.username || null,
    name: user.name || displayName,
    avatar,
    photoURL: avatar,
    profilePicture: avatar,
    bio: user.bio || null,
    website: user.website || null,
    isPrivate: !!user.isPrivate,
    isVerified: !!(user.isVerified || user.verified),
    followersCount: user.followersCount || 0,
    followingCount: user.followingCount || 0,
    postsCount: user.postsCount || 0,
    interests: Array.isArray(user.interests) ? user.interests : (user.interests || null),
    createdAt: user.createdAt || undefined
  };

  if (isSelf) {
    out.isSelf = true;
    out.isOwnProfile = true;
    if (email) out.email = email;
  }

  return out;
}

module.exports = {
  resolveUserIdentifiers,
  toObjectId,
  getBlockedUserBoundaries,
  getReportedContentBoundaries,
  getModerationBoundaries,
  sanitizeUserForViewer
};
