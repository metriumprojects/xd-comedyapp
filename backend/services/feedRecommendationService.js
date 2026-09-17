const mongoose = require('mongoose');
const postService = require('./postService');

// In-memory cache for user category affinity (10-minute TTL per user)
const userAffinityCache = new Map();
const AFFINITY_CACHE_TTL = 10 * 60 * 1000;

/**
 * 1. Extract viewer category affinity
 * Combines explicit profile tags ('interests' e.g. "Stand Up, Memes")
 * and implicit behavior (categories from the user's recently liked posts).
 */
async function getUserCategoryAffinity(viewerId) {
  if (!viewerId) return new Set();

  const cacheKey = String(viewerId);
  const cached = userAffinityCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < AFFINITY_CACHE_TTL)) {
    return cached.categories;
  }

  const preferredCategories = new Set();
  try {
    const User = mongoose.model('User');
    const Post = mongoose.model('Post');

    // 1A. Explicit: User profile tags from User document
    let userDoc = null;
    if (mongoose.Types.ObjectId.isValid(viewerId)) {
      userDoc = await User.findById(viewerId).select('interests').lean();
    }
    if (!userDoc) {
      userDoc = await User.findOne({
        $or: [
          { uid: viewerId },
          { firebaseUid: viewerId }
        ]
      }).select('interests').lean();
    }

    if (userDoc && typeof userDoc.interests === 'string' && userDoc.interests.trim()) {
      userDoc.interests.split(',').forEach(tag => {
        const clean = tag.trim().toLowerCase();
        if (clean) preferredCategories.add(clean);
      });
    }

    // 1B. Implicit: Categories from the viewer's last 25 liked posts
    const likedPosts = await Post.find({
      likes: String(viewerId),
      category: { $exists: true, $ne: null, $ne: '' }
    })
      .sort({ createdAt: -1 })
      .limit(25)
      .select('category')
      .lean();

    likedPosts.forEach(p => {
      if (p.category && typeof p.category === 'string') {
        const clean = p.category.trim().toLowerCase();
        if (clean) preferredCategories.add(clean);
      }
    });

    userAffinityCache.set(cacheKey, {
      categories: preferredCategories,
      timestamp: Date.now()
    });
  } catch (err) {
    console.warn('[feedRecommendationService] Failed to extract user affinity:', err.message);
  }

  return preferredCategories;
}

/**
 * 2. Calculate Engagement Gravity Score
 * Combines likes, comments, shares, laughs, views with recency decay
 * and boosts posts matching viewer's preferred categories.
 */
function calculateGravityScore(post, preferredCategories, now = Date.now()) {
  const likes = Number(post.likesCount || (Array.isArray(post.likes) ? post.likes.length : 0)) || 0;
  const comments = Number(post.commentsCount || post.commentCount || (Array.isArray(post.comments) ? post.comments.length : 0)) || 0;
  const shares = Number(post.shareCount || 0) || 0;
  const laughs = Number(post.laughCount || (Array.isArray(post.laughedBy) ? post.laughedBy.length : 0)) || 0;
  const views = Number(post.viewsCount || 0) || 0;

  // Base weighted engagement
  const baseEngagement = (likes * 1.5) + (comments * 3.0) + (shares * 5.0) + (laughs * 2.0) + (views * 0.05);

  // Time decay: HackerNews / Reddit / TikTok gravity model
  const createdAtMs = post.createdAt ? new Date(post.createdAt).getTime() : now;
  const ageInHours = Math.max(0, (now - createdAtMs) / (1000 * 60 * 60));
  const timeDecay = 1 / Math.pow(ageInHours + 2, 1.15);

  // Category Affinity Boost
  let affinityBoost = 1.0;
  if (post.category && typeof post.category === 'string') {
    const postCat = post.category.trim().toLowerCase();
    if (preferredCategories && preferredCategories.has(postCat)) {
      affinityBoost = 1.5; // 50% boost for matching interests
    }
  }

  // Micro-jitter: 0 to 5% subtle random variation to prevent identical static ordering on reload
  const jitter = 1 + (Math.random() * 0.05);

  return (baseEngagement + 1) * timeDecay * affinityBoost * jitter;
}

/**
 * 3. Creator Anti-Stacking Re-Ranker
 * Re-arranges the post array so no two consecutive reels belong to the same creator.
 */
function applyCreatorAntiStacking(posts) {
  if (!Array.isArray(posts) || posts.length <= 2) return posts;

  const result = [];
  const pool = [...posts];

  const getAuthorId = (post) => {
    if (!post) return '';
    if (typeof post.userId === 'string') return post.userId;
    if (post.userId && typeof post.userId === 'object') {
      return String(post.userId._id || post.userId.id || post.userId.uid || '');
    }
    return '';
  };

  while (pool.length > 0) {
    const prevPost = result[result.length - 1];
    const prevAuthorId = prevPost ? getAuthorId(prevPost) : null;

    // Find first post in pool whose author is different from prevAuthorId
    let chosenIdx = pool.findIndex(p => getAuthorId(p) !== prevAuthorId);

    // If all remaining posts are from the same author, take the first one
    if (chosenIdx === -1) {
      chosenIdx = 0;
    }

    result.push(pool.splice(chosenIdx, 1)[0]);
  }

  return result;
}

/**
 * 4. Main Recommendation Feed Generator
 * Handles 80/20 candidate mix (personalized vs fresh discovery),
 * engagement scoring, anti-stacking, and stable cursor pagination.
 */
async function getRecommendedFeed({
  baseQuery,
  limit = 20,
  skip = 0,
  viewerId = null,
  cursor = null
}) {
  const preferredCategories = await getUserCategoryAffinity(viewerId);
  const now = Date.now();

  const isFirstPage = (!cursor && skip === 0);

  if (isFirstPage) {
    // 80/20 Mix:
    // 80% High-Scoring Personalized Reels (~16 items for limit 20)
    // 20% Fresh Discovery Reels (~4 items for limit 20)
    const targetScoredCount = Math.max(1, Math.ceil(limit * 0.8));
    const targetDiscoveryCount = Math.max(1, limit - targetScoredCount);

    // 1. Fetch Candidate Pool from last 30 days for ranking
    const candidateLimit = Math.max(limit * 3, 60);
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
    const candidateQuery = {
      $and: [
        baseQuery,
        { createdAt: { $gte: thirtyDaysAgo } }
      ]
    };

    const candidates = await postService.getEnrichedPosts(candidateQuery, {
      limit: candidateLimit,
      sort: { createdAt: -1 },
      viewerId
    });

    // Score all candidates
    const scoredCandidates = candidates.map(post => ({
      post,
      score: calculateGravityScore(post, preferredCategories, now)
    }));

    // Sort descending by gravity score
    scoredCandidates.sort((a, b) => b.score - a.score);

    // Top scored posts for Pool A
    const poolA = scoredCandidates.slice(0, targetScoredCount).map(s => s.post);
    const poolAIds = new Set(poolA.map(p => String(p._id || p.id)));

    // 2. Pool B: Fresh Discovery Posts (last 48 hours or un-scored fresh posts)
    let poolB = [];
    const fortyEightHoursAgo = new Date(now - 48 * 60 * 60 * 1000);
    const discoveryQuery = {
      $and: [
        baseQuery,
        { createdAt: { $gte: fortyEightHoursAgo } }
      ]
    };

    const discoveryCandidates = await postService.getEnrichedPosts(discoveryQuery, {
      limit: targetDiscoveryCount * 3,
      viewerId,
      randomize: true
    });

    // Filter out posts already in Pool A
    for (const d of discoveryCandidates) {
      const id = String(d._id || d.id);
      if (!poolAIds.has(id)) {
        poolB.push(d);
        if (poolB.length >= targetDiscoveryCount) break;
      }
    }

    // If not enough 48h discovery posts, take next best from candidate pool
    if (poolB.length < targetDiscoveryCount) {
      for (const s of scoredCandidates.slice(targetScoredCount)) {
        const id = String(s.post._id || s.post.id);
        if (!poolAIds.has(id)) {
          poolB.push(s.post);
          if (poolB.length >= targetDiscoveryCount) break;
        }
      }
    }

    // 3. Interleave Pool A and Pool B (e.g. 4 scored, 1 discovery, 4 scored, 1 discovery...)
    const combined = [];
    let bIdx = 0;
    poolA.forEach((p, idx) => {
      combined.push(p);
      if ((idx + 1) % 4 === 0 && bIdx < poolB.length) {
        combined.push(poolB[bIdx++]);
      }
    });
    while (bIdx < poolB.length) {
      combined.push(poolB[bIdx++]);
    }

    // 4. Apply Creator Anti-Stacking
    const unstacked = applyCreatorAntiStacking(combined);
    const finalPosts = unstacked.slice(0, limit);

    // 5. Build stable pagination state
    const nextCursor = `offset_${finalPosts.length}`;
    const lastPost = finalPosts.length > 0 ? finalPosts[finalPosts.length - 1] : null;

    return {
      posts: finalPosts,
      cursor: nextCursor,
      cursorDate: lastPost?.createdAt || null
    };
  } else {
    // Page 2+: Continuous infinite scroll
    let effectiveSkip = skip;
    if (cursor && typeof cursor === 'string' && cursor.startsWith('offset_')) {
      effectiveSkip = parseInt(cursor.replace('offset_', ''), 10) || skip;
    }

    // Fetch batch from baseQuery ordered by recency/engagement
    const posts = await postService.getEnrichedPosts(baseQuery, {
      skip: effectiveSkip,
      limit: limit * 2, // Fetch double to allow anti-stacking and light scoring
      sort: { createdAt: -1 },
      viewerId
    });

    // Score and lightly rank the current page
    const scored = posts.map(post => ({
      post,
      score: calculateGravityScore(post, preferredCategories, now)
    }));
    scored.sort((a, b) => b.score - a.score);

    const sortedPosts = scored.map(s => s.post);
    const unstacked = applyCreatorAntiStacking(sortedPosts);
    const pagedPosts = unstacked.slice(0, limit);

    const nextSkip = effectiveSkip + pagedPosts.length;
    const nextCursor = pagedPosts.length > 0 ? `offset_${nextSkip}` : null;
    const lastPost = pagedPosts.length > 0 ? pagedPosts[pagedPosts.length - 1] : null;

    return {
      posts: pagedPosts,
      cursor: nextCursor,
      cursorDate: lastPost?.createdAt || null
    };
  }
}

module.exports = {
  getUserCategoryAffinity,
  calculateGravityScore,
  applyCreatorAntiStacking,
  getRecommendedFeed
};
