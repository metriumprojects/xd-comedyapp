const Post = require('../models/Post');
const mongoose = require('mongoose');

// Create post
exports.createPost = async (req, res) => {
  try {
    const { userId, caption, imageUrls, hashtags, mentions, location } = req.body;

    if (!userId || !caption) {
      return res.status(400).json({ success: false, error: 'userId and caption required' });
    }

    const newPost = new Post({
      userId,
      caption,
      mediaUrls: imageUrls || [], // Model uses mediaUrls
      hashtags: hashtags || [],
      mentions: mentions || [],
      location: location || null,
    });

    await newPost.save();

    res.status(201).json({
      success: true,
      data: newPost
    });
  } catch (err) {
    console.error('[createPost] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get all posts
exports.getAllPosts = async (req, res) => {
  try {
    const userId = req.userId ? String(req.userId) : null;
    let reportedIds = [];
    let blockedUsers = [];

    if (userId) {
      const { resolveUserIdentifiers } = require('../utils/userUtils');
      const { candidates } = await resolveUserIdentifiers(userId);
      const Report = require('../models/Report');
      const User = require('../models/User');

      const [reported, userDoc] = await Promise.all([
        Report.find({ reporterId: { $in: candidates }, targetType: 'post' }).select('targetId').lean(),
        User.findOne({
          $or: [
            ...(mongoose.Types.ObjectId.isValid(userId) ? [{ _id: new mongoose.Types.ObjectId(userId) }] : []),
            { firebaseUid: userId },
            { uid: userId }
          ]
        }).select('blockedUsers').lean()
      ]);

      reportedIds = (reported || []).map(r => String(r.targetId));
      blockedUsers = (userDoc?.blockedUsers || []).map(b => String(b));
    }

    const matchFilter = {};
    if (reportedIds.length > 0) {
      const validIds = reportedIds.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
      matchFilter._id = { $nin: validIds };
    }
    if (blockedUsers.length > 0) {
      const validUserIds = blockedUsers.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));
      matchFilter.userId = { $nin: [...blockedUsers, ...validUserIds] };
    }

    const pipeline = [
      ...(Object.keys(matchFilter).length > 0 ? [{ $match: matchFilter }] : []),
      { $sort: { createdAt: -1 } },
      { $limit: 50 },
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

    const posts = await Post.aggregate(pipeline);
    res.json({ success: true, data: posts || [] });
  } catch (err) {
    console.error('[getAllPosts] Error:', err);
    res.status(500).json({ success: false, error: err.message, data: [] });
  }
};

// Get post by ID
exports.getPostById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId ? String(req.userId) : null;
    if (!id) return res.status(400).json({ success: false, error: 'Post ID required' });

    let matchCondition = {};
    if (mongoose.Types.ObjectId.isValid(id)) {
      matchCondition = { _id: new mongoose.Types.ObjectId(id) };
    } else {
      matchCondition = { id: id };
    }

    const pipeline = [
      { $match: matchCondition },
      { $limit: 1 },
      {
        $addFields: {
          isLiked: userId ? { $in: [userId, { $ifNull: ["$likes", []] }] } : false,
          id: "$_id"
        }
      },
      {
        $project: {
          likes: 0,
          comments: 0 // Fetch comments via separate endpoint
        }
      }
    ];

    const results = await Post.aggregate(pipeline);
    const post = results[0];

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    res.json({ success: true, data: post });
  } catch (err) {
    console.error(`[getPostById] Error fetching post ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
};

// Delete post
exports.deletePost = async (req, res) => {
  try {
    const { id } = req.params;
    const { currentUserId } = req.body;

    if (!id) return res.status(400).json({ success: false, error: 'Post ID required' });

    // 1. Find the post first to check ownership
    let post = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      post = await Post.findById(id);
    }
    
    if (!post) {
      post = await Post.findOne({ id: id });
    }

    if (!post) {
      return res.status(404).json({ success: false, error: 'Post not found' });
    }

    // 2. Check ownership if currentUserId is provided
    if (currentUserId && String(post.userId) !== String(currentUserId)) {
      return res.status(403).json({ success: false, error: 'Unauthorized: You can only delete your own posts' });
    }

    // 3. Delete the post
    await post.deleteOne();

    res.json({ success: true, message: 'Post deleted successfully' });
  } catch (err) {
    console.error(`[deletePost] Error deleting post ${req.params.id}:`, err);
    res.status(500).json({ success: false, error: err.message });
  }
};
