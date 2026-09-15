const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken, optionalAuth } = require('../middleware/authMiddleware');
const { get, set } = require('../utils/redis');

const postController = require('../controllers/postController');
const validate = require('../middleware/validateMiddleware');
const { createPostSchema, updatePostSchema } = require('../validations/postValidation');
const { postCreateLimiter, searchLimiter } = require('../middleware/rateLimiters');

// Helper: escape user input for use in MongoDB $regex to prevent ReDoS
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Create post (POST /api/posts) — must be authenticated, rate limited
router.post('/', verifyToken, postCreateLimiter, validate(createPostSchema), postController.createPost);

router.get('/feed', optionalAuth, async (req, res) => {
  try {
    const skip = Math.max(0, parseInt(req.query.skip) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20)); // cap at 50

    // Redis caching
    const cacheKey = `feed:skip_${skip}:limit_${limit}`;
    const cachedFeed = await get(cacheKey);
    let finalFeed = [];

    if (cachedFeed) {
      finalFeed = cachedFeed;
    } else {
      const db = mongoose.connection.db;
      const postsCollection = db.collection('posts');
      const userId = req.userId ? String(req.userId) : null;

      // Use aggregation for high-performance field selection and computed values
      const pipeline = [
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        {
          $addFields: {
            isLiked: userId ? { $in: [userId, { $ifNull: ["$likes", []] }] } : false,
            id: "$_id"
          }
        },
        {
          $project: {
            likes: 0,
            comments: 0
          }
        }
      ];

      finalFeed = await postsCollection.aggregate(pipeline).toArray();
      await set(cacheKey, finalFeed || [], 120);
    }

    // Filter out posts reported by the current user
    if (req.userId) {
      const Report = require('../models/Report');
      const reportedPosts = await Report.find({ reporterId: String(req.userId), targetType: 'post' }).select('targetId').lean();
      const reportedIds = reportedPosts.map(r => String(r.targetId));
      finalFeed = finalFeed.filter(post => !reportedIds.includes(String(post._id || post.id)));
    }

    res.json({ success: true, data: finalFeed || [], source: cachedFeed ? 'cache' : 'db' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch feed', data: [] });
  }
});

// Get recommended posts (GET /api/posts/recommended) — optionalAuth
router.get('/recommended', optionalAuth, async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
    const excludeIdsStr = req.query.excludeIds || '';
    const excludeIds = excludeIdsStr ? excludeIdsStr.split(',').filter(Boolean) : [];

    const filter = {};
    if (excludeIds.length > 0) {
      const objectIds = excludeIds
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));
      if (objectIds.length > 0) {
        filter._id = { $nin: objectIds };
      }
    }

    // Use aggregation with $sample for random recommendations
    const posts = await postsCollection.aggregate([
      { $match: filter },
      { $sample: { size: limit } }
    ]).toArray();

    res.json({ success: true, data: posts || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch recommendations', data: [] });
  }
});

// Get posts by location (GET /api/posts/by-location) — optionalAuth
// FIX: Escape location input to prevent ReDoS regex injection
router.get('/by-location', optionalAuth, async (req, res) => {
  try {
    const { location, skip: skipStr, limit: limitStr } = req.query;
    if (!location) {
      return res.status(400).json({ success: false, error: 'location query required' });
    }

    // Sanitize: max 100 chars, escape for regex
    const safeLocation = escapeRegex(String(location).slice(0, 100));

    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    const skip = Math.max(0, parseInt(skipStr) || 0);
    const limit = Math.min(50, Math.max(1, parseInt(limitStr) || 20));

    // Priority: Try Text Search first for industrial-grade speed
    // Fallback: If no results, use regex for partial matches
    let posts = await postsCollection.find({
      $text: { $search: safeLocation }
    }).sort({ score: { $meta: "textScore" }, createdAt: -1 }).skip(skip).limit(limit).toArray();

    if (!posts || posts.length === 0) {
      posts = await postsCollection.find({
        $or: [
          { location: { $regex: safeLocation, $options: 'i' } },
          { 'locationData.name': { $regex: safeLocation, $options: 'i' } }
        ]
      }).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
    }

    res.json({ success: true, data: posts || [] });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Location search failed', data: [] });
  }
});

// Search posts by caption, hashtags, tags, or location (GET /api/posts/search?q=query&filter=videos)
// MUST be placed before /:id route!
router.get('/search', optionalAuth, searchLimiter, async (req, res) => {
  try {
    const rawQ = req.query.q || req.query.query || '';
    const filterMode = req.query.filter || 'videos';
    const trimmed = String(rawQ).trim();

    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 30));
    const db = mongoose.connection.db;
    const postsCollection = db.collection('posts');
    const userId = req.userId ? String(req.userId) : null;

    // Visibility: include public posts + own posts (if logged in)
    // Also include docs where visibility field doesn't exist at all (older posts)
    const visibilityFilter = {
      $or: [
        { visibility: { $exists: false } },
        { visibility: null },
        { visibility: { $in: ['Everyone', 'everyone', 'public'] } },
        ...(userId ? [{ userId: userId }] : [])
      ]
    };

    let queryConditions = [visibilityFilter];

    if (trimmed) {
      const cleanTag = trimmed.replace(/^#/, '');
      const escapedQ = escapeRegex(cleanTag || trimmed);

      if (filterMode === 'location') {
        // Location capsule: Search specifically by location name / place
        queryConditions.push({
          $or: [
            { location: { $regex: escapedQ, $options: 'i' } },
            { 'locationData.name': { $regex: escapedQ, $options: 'i' } },
            { 'locationData.address': { $regex: escapedQ, $options: 'i' } },
            { 'locationData.city': { $regex: escapedQ, $options: 'i' } }
          ]
        });
      } else {
        // Videos / Laugh / Tomato capsules: Search caption, text, hashtags, tags, location
        queryConditions.push({
          $or: [
            { caption: { $regex: escapedQ, $options: 'i' } },
            { text: { $regex: escapedQ, $options: 'i' } },
            { hashtags: { $regex: escapedQ, $options: 'i' } },
            { tags: { $regex: escapedQ, $options: 'i' } },
            { location: { $regex: escapedQ, $options: 'i' } },
            { 'locationData.name': { $regex: escapedQ, $options: 'i' } }
          ]
        });
      }
    }

    let sortOption = { _id: -1 };
    if (filterMode === 'laugh') {
      sortOption = { laughCount: -1, laughs: -1, _id: -1 };
    } else if (filterMode === 'tomato') {
      sortOption = { tomatoCount: -1, tomatoes: -1, _id: -1 };
    }

    const posts = await postsCollection
      .find({ $and: queryConditions })
      .sort(sortOption)
      .limit(limit)
      .toArray();

    res.json({ success: true, data: posts || [] });
  } catch (err) {
    console.error('[Posts Search] Error:', err);
    res.status(500).json({ success: false, error: 'Search failed', data: [] });
  }
});

// Get all posts (GET /api/posts) — verifyToken (enforced for security)
router.get('/', verifyToken, postController.getAllPosts);

// Get location count (GET /api/posts/location-count?location=...)
// MUST be before /:id route!
router.get('/location-count', optionalAuth, async (req, res) => {
  try {
    const { location } = req.query;

    if (!location) {
      return res.status(400).json({ success: false, error: 'location query parameter required' });
    }

    const safeLocation = escapeRegex(String(location).slice(0, 100));
    const Post = require('../models/Post');

    const count = await Post.countDocuments({
      $or: [
        { location: { $regex: safeLocation, $options: 'i' } },
        { locationName: { $regex: safeLocation, $options: 'i' } }
      ]
    });

    res.json({ success: true, count, location });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Count failed' });
  }
});

// Get post by ID (GET /api/posts/:id) — optionalAuth
router.get('/:id', optionalAuth, postController.getPostById);

// Get comments for a post (GET /api/posts/:postId/comments)
router.get('/:postId/comments', optionalAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const viewerId = req.userId || null;

    const Post = mongoose.model('Post');
    const Comment = mongoose.model('Comment');

    // Resolve post
    const post = await Post.findOne({
      $or: [
        { _id: mongoose.Types.ObjectId.isValid(postId) ? new mongoose.Types.ObjectId(postId) : null },
        { id: postId }
      ].filter(q => q._id !== null || q.id)
    }).lean();

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // Security: Check visibility (Basic implementation)
    if (post.isPrivate && (!viewerId || String(post.userId) !== String(viewerId))) {
      // Check for follow status if needed, for now just allow owner
      if (String(post.userId) !== String(viewerId)) {
        return res.status(403).json({ success: false, error: 'Private content' });
      }
    }

    // Fetch comments
    const comments = await Comment.find({
      postId: { $in: [String(post._id), String(post.id)].filter(Boolean) }
    }).sort({ createdAt: -1 }).lean();

    // Enrich comments with author data
    const User = mongoose.model('User');
    const enriched = await Promise.all(comments.map(async (c) => {
      const author = await User.findOne({
        $or: [
          { _id: mongoose.Types.ObjectId.isValid(c.userId) ? new mongoose.Types.ObjectId(c.userId) : null },
          { firebaseUid: c.userId },
          { uid: c.userId }
        ].filter(q => q._id !== null || q.firebaseUid || q.uid)
      }).select('displayName name avatar photoURL profilePicture').lean();

      return {
        ...c,
        userName: author?.displayName || author?.name || 'Anonymous',
        userAvatar: author?.avatar || author?.photoURL || author?.profilePicture || null
      };
    }));

    res.json({ success: true, data: enriched });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Like post (POST /api/posts/:postId/like) — must be authenticated
router.post('/:postId/like', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    // Use the authenticated user's ID from JWT — not from request body (prevents spoofing)
    const userId = String(req.userId);

    const Post = mongoose.model('Post');

    let result = null;
    if (mongoose.Types.ObjectId.isValid(postId)) {
      const objectId = new mongoose.Types.ObjectId(postId);
      result = await Post.findByIdAndUpdate(
        objectId,
        { $addToSet: { likes: userId } },
        { new: true }
      );
    }

    if (!result) {
      result = await Post.findOneAndUpdate(
        { id: postId },
        { $addToSet: { likes: userId } },
        { new: true }
      );
    }

    if (!result) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Like failed' });
  }
});

// Unlike post (DELETE /api/posts/:postId/like) — must be authenticated
router.delete('/:postId/like', verifyToken, async (req, res) => {
  try {
    const { postId } = req.params;
    const userId = String(req.userId);

    const Post = mongoose.model('Post');

    let result = null;
    if (mongoose.Types.ObjectId.isValid(postId)) {
      const objectId = new mongoose.Types.ObjectId(postId);
      result = await Post.findByIdAndUpdate(
        objectId,
        { $pull: { likes: userId } },
        { new: true }
      );
    }

    if (!result) {
      result = await Post.findOneAndUpdate(
        { id: postId },
        { $pull: { likes: userId } },
        { new: true }
      );
    }

    if (!result) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Unlike failed' });
  }
});

// Delete post (DELETE /api/posts/:id) — must be authenticated
// Note: The controller should additionally verify the post belongs to req.userId
router.delete('/:id', verifyToken, postController.deletePost);

module.exports = router;
