let Section;
try {
  Section = require('../models/Section');
} catch (e) {
  try {
    const mongoose = require('mongoose');
    Section = mongoose.model('Section');
  } catch (e2) {
    console.error('Failed to load Section model:', e2.message);
  }
}

// ─── helpers ────────────────────────────────────────────────────────────────

function isOwner(section, uid) {
  return section.userId === uid;
}

function isCollaborator(section, uid) {
  return section.collaborators && section.collaborators.some(c => c.userId === uid);
}

const mongoose = require('mongoose');

async function findSectionByIdOrName(sectionId, uid) {
  const isObjId = mongoose.Types.ObjectId.isValid(sectionId);
  const query = {
    $or: [
      ...(isObjId ? [{ _id: new mongoose.Types.ObjectId(sectionId) }] : []),
      { name: sectionId }
    ]
  };
  if (uid) {
    query.userId = uid;
  }
  return await Section.findOne(query);
}

// ─── GET /api/sections?userId=... ───────────────────────────────────────────
exports.getSectionsByUser = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const sections = await Section.find({ userId }).sort({ createdAt: 1 });
    res.json({ success: true, data: sections });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── GET /api/users/:uid/sections ───────────────────────────────────────────
exports.getUserSections = async (req, res) => {
  try {
    const { uid } = req.params;
    // Return own + collections where user is collaborator
    const sections = await Section.find({
      $or: [
        { userId: uid },
        { 'collaborators.userId': uid },
      ],
    }).sort({ createdAt: 1 });
    res.json({ success: true, data: sections });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

async function syncSavedPostState(uid, postId, isSaved) {
  if (!uid || !postId) return;
  try {
    const cleanPostId = String(postId).split('-loop')[0];
    const { resolveUserIdentifiers } = require('../utils/userUtils');
    const resolved = await resolveUserIdentifiers(uid);

    let SavedPost;
    try { SavedPost = mongoose.model('SavedPost'); } catch {
      const savedPostSchema = new mongoose.Schema({
        userId: { type: String, required: true },
        postId: { type: String, required: true },
        savedAt: { type: Date, default: Date.now }
      });
      SavedPost = mongoose.model('SavedPost', savedPostSchema);
    }

    const Post = mongoose.model('Post');
    const targetPost = await Post.findOne({
      $or: [
        { id: cleanPostId },
        ...(mongoose.Types.ObjectId.isValid(cleanPostId) ? [{ _id: cleanPostId }] : [])
      ]
    });

    if (isSaved) {
      const existing = await SavedPost.findOne({ userId: { $in: resolved.candidates }, postId: cleanPostId });
      if (!existing) {
        await new SavedPost({ userId: resolved.canonicalId, postId: cleanPostId }).save();
      }
      if (targetPost) {
        const alreadyInSavedBy = Array.isArray(targetPost.savedBy)
          && targetPost.savedBy.some((id) => resolved.candidates.includes(String(id)));
        if (!alreadyInSavedBy) {
          targetPost.savedBy = Array.isArray(targetPost.savedBy) ? targetPost.savedBy : [];
          targetPost.savedBy.push(resolved.canonicalId);
          targetPost.savesCount = targetPost.savedBy.length;
          await targetPost.save();
        }
      }
    } else {
      const Section = mongoose.model('Section');
      const otherSection = await Section.findOne({
        $or: [
          { userId: { $in: resolved.candidates } },
          { 'collaborators.userId': { $in: resolved.candidates } }
        ],
        postIds: cleanPostId
      });
      if (!otherSection) {
        await SavedPost.deleteMany({ userId: { $in: resolved.candidates }, postId: cleanPostId });
        if (targetPost) {
          targetPost.savedBy = (Array.isArray(targetPost.savedBy) ? targetPost.savedBy : []).filter((id) => !resolved.candidates.includes(String(id)));
          targetPost.savesCount = targetPost.savedBy.length;
          await targetPost.save();
        }
      }
    }
  } catch (err) {
    console.warn('[syncSavedPostState] Warning:', err.message);
  }
}

// ─── POST /api/users/:uid/sections ──────────────────────────────────────────
exports.createSection = async (req, res) => {
  try {
    const { uid } = req.params;
    const { name, postIds, coverImage, visibility, specificUsers, collaborators } = req.body;

    if (!name) return res.status(400).json({ success: false, error: 'Section name required' });

    const section = new Section({
      userId: uid,
      name,
      postIds: Array.isArray(postIds) ? postIds : [],
      coverImage: coverImage || undefined,
      visibility: visibility || 'private',
      specificUsers: Array.isArray(specificUsers) ? specificUsers : [],
      collaborators: Array.isArray(collaborators)
        ? collaborators.map(id => ({ userId: id }))
        : [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await section.save();

    if (Array.isArray(postIds)) {
      for (const pid of postIds) {
        await syncSavedPostState(uid, pid, true);
      }
    }

    res.json({ success: true, data: section });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── PUT /api/users/:uid/sections/:sectionId ────────────────────────────────
// Only owner can edit name/visibility/collaborators/cover
// Collaborator can only add to postIds
exports.updateSection = async (req, res) => {
  try {
    const { uid, sectionId } = req.params;
    const { name, postIds, coverImage, visibility, specificUsers, collaborators, addPostId, removePostId } = req.body;

    const section = await findSectionByIdOrName(sectionId, uid);
    if (!section) return res.status(404).json({ success: false, error: 'Section not found' });

    const owns = isOwner(section, uid);
    const collab = isCollaborator(section, uid);

    if (!owns && !collab) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Collaborators can only add/remove posts
    if (collab && !owns) {
      if (addPostId) section.postIds.addToSet(addPostId);
      if (removePostId) section.postIds.pull(removePostId);
    } else {
      // Owner: full update
      if (name !== undefined) section.name = name;
      if (coverImage !== undefined) section.coverImage = coverImage;
      if (visibility !== undefined) section.visibility = visibility;
      if (Array.isArray(specificUsers)) section.specificUsers = specificUsers;
      if (Array.isArray(collaborators)) {
        section.collaborators = collaborators.map(id => ({ userId: id }));
      }
      if (Array.isArray(postIds)) section.postIds = postIds;
      if (addPostId) section.postIds.addToSet(addPostId);
      if (removePostId) section.postIds.pull(removePostId);
    }

    section.updatedAt = new Date();
    await section.save();

    if (addPostId) await syncSavedPostState(uid, addPostId, true);
    if (removePostId) await syncSavedPostState(uid, removePostId, false);
    if (Array.isArray(postIds)) {
      for (const pid of postIds) {
        await syncSavedPostState(uid, pid, true);
      }
    }

    res.json({ success: true, data: section });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── DELETE /api/users/:uid/sections/:sectionId ─────────────────────────────
// Optional: body.migrateToSectionId — move posts before delete
exports.deleteSection = async (req, res) => {
  try {
    const { uid, sectionId } = req.params;
    const { migrateToSectionId } = req.body || {};

    const section = await findSectionByIdOrName(sectionId, uid);
    if (!section) return res.status(404).json({ success: false, error: 'Section not found' });

    if (!isOwner(section, uid)) {
      return res.status(403).json({ success: false, error: 'Only the owner can delete a collection' });
    }

    // Migrate posts to another section if requested
    if (migrateToSectionId && section.postIds.length > 0) {
      const target = await Section.findById(migrateToSectionId);
      if (target) {
        const merged = [...new Set([...target.postIds, ...section.postIds])];
        target.postIds = merged;
        target.updatedAt = new Date();
        await target.save();
      }
    }

    const isObjId = mongoose.Types.ObjectId.isValid(sectionId);
    await Section.deleteMany({
      userId: uid,
      $or: [
        ...(isObjId ? [{ _id: new mongoose.Types.ObjectId(sectionId) }] : []),
        { name: section.name },
        { name: sectionId }
      ]
    });
    res.json({ success: true, data: { deletedId: sectionId } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── POST /api/users/:uid/sections/:sectionId/collaborators ─────────────────
exports.addCollaborator = async (req, res) => {
  try {
    const { uid, sectionId } = req.params;
    const { collaboratorId } = req.body;

    if (!collaboratorId) return res.status(400).json({ success: false, error: 'collaboratorId required' });

    const section = await Section.findOne({ _id: sectionId });
    if (!section) return res.status(404).json({ success: false, error: 'Section not found' });

    if (!isOwner(section, uid)) {
      return res.status(403).json({ success: false, error: 'Only the owner can add collaborators' });
    }

    const alreadyIn = section.collaborators.some(c => c.userId === collaboratorId);
    if (!alreadyIn) {
      section.collaborators.push({ userId: collaboratorId });
      section.updatedAt = new Date();
      await section.save();
    }

    res.json({ success: true, data: section });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── DELETE /api/users/:uid/sections/:sectionId/collaborators/:collabId ─────
exports.removeCollaborator = async (req, res) => {
  try {
    const { uid, sectionId, collabId } = req.params;

    const section = await Section.findOne({ _id: sectionId });
    if (!section) return res.status(404).json({ success: false, error: 'Section not found' });

    if (!isOwner(section, uid)) {
      return res.status(403).json({ success: false, error: 'Only the owner can remove collaborators' });
    }

    section.collaborators = section.collaborators.filter(c => c.userId !== collabId);
    section.updatedAt = new Date();
    await section.save();

    res.json({ success: true, data: section });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
