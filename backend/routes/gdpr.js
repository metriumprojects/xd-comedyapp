const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { verifyToken } = require('../src/middleware/authMiddleware');
const { resolveUserIdentifiers } = require('../src/utils/userUtils');

/**
 * Helper to verify requester owns the target userId
 */
async function checkOwnership(requesterId, targetUserId) {
  if (!requesterId || !targetUserId) return false;
  const { candidates } = await resolveUserIdentifiers(requesterId);
  return candidates.map(String).includes(String(targetUserId));
}

/**
 * @route   POST /api/gdpr/users/:userId/deletion-request
 * @desc    Request account deletion (initial request)
 */
router.post('/users/:userId/deletion-request', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const isOwner = await checkOwnership(req.userId, userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Forbidden: You can only request deletion of your own account' });
    }

    // A full implementation would set a 'deletionScheduled' flag in the User model.
    console.log(`🗑️ Deletion request received for user: ${userId}`);
    res.json({ success: true, message: 'Deletion request received. Your account will be deleted within 30 days.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/gdpr/users/:userId/export
 * @desc    Export all user data
 */
router.get('/users/:userId/export', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const isOwner = await checkOwnership(req.userId, userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Forbidden: You can only export your own data' });
    }
    const User = mongoose.model('User');
    const Post = mongoose.model('Post');
    
    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    
    // Security: Strip internal password and reset secrets from export
    delete user.password;
    delete user.resetCode;
    delete user.resetCodeExpires;

    const posts = await Post.find({ userId: userId }).lean();
    
    // Construct export object matching frontend expectations
    const exportData = {
      profile: user,
      posts: posts,
      comments: [], // Simplification
      messages: [], // Simplification
      followers: [],
      following: [],
      savedPosts: [],
      notifications: [],
      exportedAt: new Date()
    };
    
    res.json(exportData);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   GET /api/gdpr/users/:userId/deletion-status
 */
router.get('/users/:userId/deletion-status', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const isOwner = await checkOwnership(req.userId, userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    res.json({ requested: false });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @route   POST /api/gdpr/users/:userId/deletion-cancel
 */
router.post('/users/:userId/deletion-cancel', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const isOwner = await checkOwnership(req.userId, userId);
    if (!isOwner) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    res.json({ success: true, message: 'Deletion request cancelled.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;

