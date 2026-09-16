const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { resolveUserIdentifiers } = require('../src/utils/userUtils');
const { verifyToken } = require('../src/middleware/authMiddleware');
const { enrichPostsWithUserData } = require('../utils/postHelpers');

// Use centralized Section model
const Section = mongoose.models.Section || mongoose.model('Section');

console.log('📌 Loading sections routes...');

// ─── POST /api/users/:userId/sections - Create a new collection (Requires Auth)
router.post('/:userId/sections', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { name, coverImage, posts, postIds, visibility, collaborators } = req.body;
    const authenticatedUserId = req.userId;

    // Verify self ownership
    const resolved = await resolveUserIdentifiers(authenticatedUserId);
    const target = await resolveUserIdentifiers(userId);
    const isSelf = resolved.candidates.some(c => target.candidates.map(String).includes(String(c)));
    
    if (!isSelf) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Get max order for this user
    const resolvedUser = await resolveUserIdentifiers(userId);
    const lastSection = await Section.findOne({ userId: { $in: resolvedUser.candidates } }).sort({ order: -1 });
    const nextOrder = (lastSection?.order || 0) + 1;

    const section = new Section({
      userId: resolvedUser.canonicalId || userId,
      name,
      order: nextOrder,
      coverImage: coverImage || null,
      postIds: postIds || posts || [], // Support both
      visibility: visibility || 'private',
      collaborators: collaborators || [],
      allowedUsers: req.body.allowedUsers || [],
      allowedGroups: req.body.allowedGroups || []
    });
    await section.save();

    console.log('[POST /users/:userId/sections] Section created:', section._id, 'for user:', userId);
    res.status(201).json({ success: true, data: section });
  } catch (err) {
    console.error('[POST /users/:userId/sections] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/users/:userId/sections - Get collections/sections for user
router.get('/:userId/sections', async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.query.requesterId || req.query.viewerId;

    const user = await resolveUserIdentifiers(userId);
    const userCandidateStrings = (user.candidates || []).map(v => String(v));
    const userCandidateObjectIds = userCandidateStrings
      .filter(id => mongoose.Types.ObjectId.isValid(id))
      .map(id => new mongoose.Types.ObjectId(id));

    // Find sections owned by the user OR where the user is a collaborator
    const sections = await Section.find({ 
      $or: [
        { userId: { $in: user.candidates } },
        { collaborators: { $in: user.candidates } },
        { collaborators: { $in: userCandidateStrings } },
        { collaborators: { $in: userCandidateObjectIds } },
        { 'collaborators.userId': { $in: userCandidateStrings } },
        { 'collaborators.userId': { $in: userCandidateObjectIds } }
      ]
    }).sort({ order: 1 });
    
    // Filter by visibility and collaborators
    const filteredSections = sections.filter(section => {
      // 1. Owner can see all
      if (requesterId && user.candidates.includes(String(requesterId))) return true;
      // 2. Public is visible to all
      if (section.visibility === 'public') return true;
      // 3. Collaborators can see
      if (section.collaborators && requesterId && section.collaborators.includes(String(requesterId))) return true;
      // 4. Allowed users can see (specific visibility)
      if (section.visibility === 'specific' && section.allowedUsers && requesterId && section.allowedUsers.includes(String(requesterId))) return true;
      
      return false;
    });

    // 5. Populate collaborators with basic user info (BATCHED)
    const User = mongoose.models.User || mongoose.model('User');
    
    // Collect all unique collaborator IDs across all sections
    const allCollabIds = new Set();
    filteredSections.forEach(s => {
      if (Array.isArray(s.collaborators)) {
        s.collaborators.forEach(entry => {
          const id = entry && typeof entry === 'object'
            ? String(entry.userId || entry._id || entry.id || entry.uid || entry.firebaseUid || '')
            : String(entry || '');
          if (id) allCollabIds.add(id);
        });
      }
    });

    const collabIdsArray = Array.from(allCollabIds);
    const collabUsers = await User.find({ 
      $or: [
        { _id: { $in: collabIdsArray.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id)) } },
        { uid: { $in: collabIdsArray } },
        { firebaseUid: { $in: collabIdsArray } }
      ]
    }, 'name displayName username avatar uid firebaseUid _id').lean();

    const collabCache = {};
    collabUsers.forEach(u => {
      if (u._id) collabCache[String(u._id)] = u;
      if (u.uid) collabCache[u.uid] = u;
      if (u.firebaseUid) collabCache[u.firebaseUid] = u;
    });

    // 6. Populate post documents inside each section (BATCHED)
    const Post = mongoose.models.Post || mongoose.model('Post');
    
    const allPostIds = new Set();
    filteredSections.forEach(s => {
      if (Array.isArray(s.postIds)) {
        s.postIds.forEach(id => {
          if (id) allPostIds.add(String(id));
        });
      }
    });

    const postIdsArray = Array.from(allPostIds);
    const postsData = await Post.find({
      $or: [
        { _id: { $in: postIdsArray.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id)) } },
        { id: { $in: postIdsArray } }
      ]
    }).lean();

    const enrichedPosts = await enrichPostsWithUserData(postsData, requesterId);

    const postCache = {};
    enrichedPosts.forEach(p => {
      if (p._id) postCache[String(p._id)] = p;
      if (p.id) postCache[String(p.id)] = p;
    });

    const populatedSections = filteredSections.map((section) => {
      const s = section.toObject ? section.toObject() : section;
      
      // Populate posts
      if (Array.isArray(s.postIds)) {
        s.posts = s.postIds.map(id => postCache[String(id)]).filter(Boolean);
      } else {
        s.posts = [];
      }

      if (Array.isArray(s.collaborators)) {
        s.collaborators = s.collaborators.map(entry => {
          const idStr = entry && typeof entry === 'object'
            ? String(entry.userId || entry._id || entry.id || entry.uid || entry.firebaseUid || '')
            : String(entry || '');
          const u = collabCache[idStr];
          return u ? { ...u, id: u._id } : entry;
        });
      }
      return s;
    });

    res.json({ success: true, data: populatedSections });
  } catch (err) {
    console.error('[GET /users/:userId/sections] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT/PATCH /api/users/:userId/sections/:sectionId - Update section
const updateHandler = async (req, res) => {
  try {
    const { userId, sectionId } = req.params;
    const { name, coverImage, postIds, posts, order, visibility, collaborators, addPostId, removePostId } = req.body;
    const requesterId = req.userId;

    console.log(`📌 [updateHandler] userId: ${userId}, sectionId: ${sectionId}, requesterId: ${requesterId}`);

    const resolvedUser = await resolveUserIdentifiers(userId);
    const userIdCandidates = [...new Set(resolvedUser.candidates.map(String))];
    console.log(`📌 [updateHandler] userIdCandidates:`, userIdCandidates);

    const cleanId = String(sectionId).split('-loop')[0];

    // Find section by ID or by name matching the target user
    const existingSection = await Section.findOne({
      $and: [
        { userId: { $in: userIdCandidates } },
        {
          $or: [
            ...(mongoose.Types.ObjectId.isValid(cleanId) ? [{ _id: cleanId }] : []),
            { name: sectionId }
          ]
        }
      ]
    });

    if (!existingSection) {
      console.log(`❌ [updateHandler] Section not found for cleanId: ${cleanId}, sectionId: ${sectionId}`);
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    console.log(`📌 [updateHandler] existingSection found:`, existingSection._id, 'owner userId:', existingSection.userId);

    const owns = userIdCandidates.includes(String(existingSection.userId)) || String(existingSection.userId) === String(requesterId);
    const collab = existingSection.collaborators && existingSection.collaborators.some(id => String(id) === String(requesterId));

    console.log(`📌 [updateHandler] owns: ${owns}, collab: ${collab}`);

    if (!owns && !collab) {
      console.log(`❌ [updateHandler] Forbidden! owns/collab is false`);
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Collaborators can only add/remove posts
    if (collab && !owns) {
      if (name !== undefined || visibility !== undefined || collaborators !== undefined || req.body.allowedUsers !== undefined || order !== undefined) {
        return res.status(403).json({ success: false, error: 'Unauthorized: Collaborators can only update posts' });
      }
    }

    const updateData = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (coverImage !== undefined) updateData.coverImage = coverImage;
    if (order !== undefined) updateData.order = order;
    if (visibility !== undefined) updateData.visibility = visibility;
    if (collaborators !== undefined) updateData.collaborators = collaborators;
    if (req.body.allowedUsers !== undefined) updateData.allowedUsers = req.body.allowedUsers;
    if (req.body.allowedGroups !== undefined) updateData.allowedGroups = req.body.allowedGroups;

    let updatedPostIds = Array.isArray(existingSection.postIds) ? [...existingSection.postIds] : [];
    if (postIds !== undefined) {
      updatedPostIds = postIds;
    } else if (posts !== undefined) {
      updatedPostIds = posts;
    }

    if (addPostId) {
      if (!updatedPostIds.includes(String(addPostId))) {
        updatedPostIds.push(String(addPostId));
      }
    }
    if (removePostId) {
      updatedPostIds = updatedPostIds.filter(id => String(id) !== String(removePostId));
    }
    updateData.postIds = updatedPostIds;

    const section = await Section.findByIdAndUpdate(
      existingSection._id,
      updateData,
      { new: true }
    );

    console.log('[PUT/PATCH /users/:userId/sections/:sectionId] Section updated:', existingSection._id);
    res.json({ success: true, data: section });
  } catch (err) {
    console.error('[PUT/PATCH /users/:userId/sections/:sectionId] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};

router.put('/:userId/sections/:sectionId', verifyToken, updateHandler);
router.patch('/:userId/sections/:sectionId', verifyToken, updateHandler);

// ─── DELETE /api/users/:userId/sections/:sectionId - Delete collection
router.delete('/:userId/sections/:sectionId', verifyToken, async (req, res) => {
  try {
    const { userId, sectionId } = req.params;
    const requesterId = req.userId;

    const resolvedUser = await resolveUserIdentifiers(userId);
    const userIdCandidates = [...new Set(resolvedUser.candidates.map(String))];

    const cleanId = String(sectionId).split('-loop')[0];

    const existingSection = await Section.findOne({
      $and: [
        { userId: { $in: userIdCandidates } },
        {
          $or: [
            ...(mongoose.Types.ObjectId.isValid(cleanId) ? [{ _id: cleanId }] : []),
            { name: sectionId }
          ]
        }
      ]
    });

    if (!existingSection) {
      return res.status(404).json({ success: false, error: 'Section not found' });
    }

    if (String(existingSection.userId) !== String(requesterId) && !userIdCandidates.includes(String(existingSection.userId))) {
      return res.status(403).json({ success: false, error: 'Unauthorized: Only owner can delete' });
    }

    await Section.findByIdAndDelete(existingSection._id);
    console.log('[DELETE /users/:userId/sections/:sectionId] Section deleted:', existingSection._id);
    res.json({ success: true, message: 'Section deleted successfully' });
  } catch (err) {
    console.error('[DELETE /users/:userId/sections/:sectionId] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /api/users/:userId/sections-order - Update section order (batch update)
router.patch('/:userId/sections-order', verifyToken, async (req, res) => {
  try {
    const { sections } = req.body;

    if (!sections || !Array.isArray(sections)) {
      return res.status(400).json({ success: false, error: 'sections array required' });
    }

    const updatePromises = sections.map((section, index) =>
      Section.updateOne(
        { _id: section._id || section.id },
        { order: index, updatedAt: new Date() }
      )
    );

    await Promise.all(updatePromises);

    console.log('[PATCH /users/:userId/sections-order] Updated order for', sections.length, 'sections');
    res.json({ success: true, message: 'Section order updated successfully' });
  } catch (err) {
    console.error('[PATCH /users/:userId/sections-order] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
