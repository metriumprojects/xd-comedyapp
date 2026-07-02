const Highlight = require('../models/Highlight');

// Helper – normalise an incoming story entry from the client
function normaliseStory(entry) {
  if (!entry) return null;
  if (typeof entry === 'string') {
    return { storyId: entry, imageUrl: '', mediaType: 'image', createdAt: new Date() };
  }
  return {
    storyId:   entry.storyId   || entry.id   || '',
    imageUrl:  entry.imageUrl  || entry.image || entry.imageUri || '',
    videoUrl:  entry.videoUrl  || entry.videoUri || '',
    mediaType: entry.mediaType || (entry.videoUrl ? 'video' : 'image'),
    createdAt: entry.createdAt ? new Date(entry.createdAt) : new Date()
  };
}

// GET /api/highlights?userId=...
exports.getHighlightsByUser = async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    const highlights = await Highlight.find({ userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: highlights });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/highlights
exports.createHighlight = async (req, res) => {
  try {
    const { userId, title, coverImage, stories = [], storySnapshot } = req.body;
    if (!userId || !title) return res.status(400).json({ success: false, error: 'userId and title required' });

    let resolvedStories = [];
    const mongoose = require('mongoose');
    const Story = mongoose.model('Story');

    if (storySnapshot) {
      const s = normaliseStory(storySnapshot);
      if (s) resolvedStories = [s];
    } else if (Array.isArray(stories) && stories.length > 0) {
      for (const entry of stories) {
        if (typeof entry === 'string') {
          try {
            const st = mongoose.Types.ObjectId.isValid(entry) ? await Story.findById(entry).lean() : null;
            if (st) {
              resolvedStories.push({
                id: String(st._id),
                storyId: String(st._id),
                userId: st.userId,
                userName: st.userName,
                userAvatar: st.userAvatar,
                imageUrl: st.image || null,
                videoUrl: st.video || null,
                thumbnailUrl: st.thumbnail || null,
                mediaUrl: st.image || st.video || null,
                mediaType: st.video ? 'video' : 'image',
                createdAt: st.createdAt || new Date(),
                expiresAt: st.expiresAt || null,
              });
            } else {
              resolvedStories.push(normaliseStory(entry));
            }
          } catch {
            resolvedStories.push(normaliseStory(entry));
          }
        } else {
          const s = normaliseStory(entry);
          if (s) resolvedStories.push(s);
        }
      }
    }

    const coverUrl = coverImage || (resolvedStories[0] && (resolvedStories[0].imageUrl || resolvedStories[0].mediaUrl)) || '';

    const highlight = new Highlight({
      userId,
      title,
      coverImage: coverUrl,
      stories: resolvedStories.map(s => s.storyId).filter(Boolean),
      items: resolvedStories,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await highlight.save();
    res.status(201).json({ success: true, data: highlight, id: highlight._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// POST /api/highlights/:id/stories
exports.addStoryToHighlight = async (req, res) => {
  try {
    const { id } = req.params;
    const { storySnapshot } = req.body;

    const highlight = await Highlight.findById(id);
    if (!highlight) return res.status(404).json({ success: false, error: 'Highlight not found' });

    let entry = null;
    const mongoose = require('mongoose');
    const Story = mongoose.model('Story');

    if (typeof storySnapshot === 'string' || (storySnapshot && !storySnapshot.imageUrl && !storySnapshot.image)) {
      const sid = typeof storySnapshot === 'string' ? storySnapshot : (storySnapshot.storyId || storySnapshot.id);
      try {
        const st = mongoose.Types.ObjectId.isValid(sid) ? await Story.findById(sid).lean() : null;
        if (st) {
          entry = {
            id: String(st._id),
            storyId: String(st._id),
            userId: st.userId,
            userName: st.userName,
            userAvatar: st.userAvatar,
            imageUrl: st.image || null,
            videoUrl: st.video || null,
            thumbnailUrl: st.thumbnail || null,
            mediaUrl: st.image || st.video || null,
            mediaType: st.video ? 'video' : 'image',
            createdAt: st.createdAt || new Date(),
            expiresAt: st.expiresAt || null,
          };
        }
      } catch (err) {}
    }

    if (!entry) {
      entry = normaliseStory(storySnapshot);
    }

    if (!entry) return res.status(400).json({ success: false, error: 'story data required' });

    if (!highlight.stories) highlight.stories = [];
    if (!highlight.items) highlight.items = [];

    const alreadyIn = highlight.stories.includes(entry.storyId);
    if (!alreadyIn) {
      highlight.stories.push(entry.storyId);
      highlight.items.push(entry);
      if (!highlight.coverImage && entry.imageUrl) highlight.coverImage = entry.imageUrl;
      highlight.updatedAt = new Date();
      await highlight.save();
    }

    res.json({ success: true, data: highlight });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/highlights/:id/stories/:storyId
exports.removeStoryFromHighlight = async (req, res) => {
  try {
    const { id, storyId } = req.params;

    const highlight = await Highlight.findById(id);
    if (!highlight) return res.status(404).json({ success: false, error: 'Highlight not found' });

    highlight.stories = highlight.stories.filter(s => s !== storyId);
    highlight.items = (highlight.items || []).filter(item => {
      if (typeof item === 'string') return item !== storyId;
      if (item && typeof item === 'object') return (item.id || item.storyId || '') !== storyId;
      return true;
    });
    highlight.updatedAt = new Date();
    await highlight.save();

    res.json({ success: true, data: highlight });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// PATCH /api/highlights/:id
exports.updateHighlight = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, coverImage } = req.body;

    const highlight = await Highlight.findById(id);
    if (!highlight) return res.status(404).json({ success: false, error: 'Highlight not found' });

    if (title !== undefined) highlight.title = title;
    if (coverImage !== undefined) highlight.coverImage = coverImage;
    highlight.updatedAt = new Date();

    await highlight.save();
    res.json({ success: true, data: highlight });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// DELETE /api/highlights/:id
exports.deleteHighlight = async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const highlight = await Highlight.findById(id);
    if (!highlight) return res.status(404).json({ success: false, error: 'Highlight not found' });

    if (userId && highlight.userId !== String(userId)) {
      return res.status(403).json({ success: false, error: 'Unauthorized' });
    }

    await Highlight.deleteOne({ _id: id });
    res.json({ success: true, message: 'Highlight deleted' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// GET /api/highlights/:id/stories
exports.getHighlightStories = async (req, res) => {
  try {
    const { id } = req.params;
    const mongoose = require('mongoose');
    const Highlight = mongoose.model('Highlight');
    const highlight = await Highlight.findById(id);

    if (!highlight) {
      return res.status(404).json({ success: false, error: 'Highlight not found' });
    }

    // Prefer items snapshots (survives story expiry). Fallback to stories ids.
    const items = Array.isArray(highlight.items) ? highlight.items : [];
    const hasSnapshots = items.some((it) => it && typeof it === 'object' && (it.mediaUrl || it.imageUrl || it.videoUrl));
    if (hasSnapshots) {
      const normalized = items
        .map((it) => {
          if (!it) return null;
          if (typeof it === 'string') return null;
          const storyId = String(it.id || it.storyId || '').trim();
          if (!storyId) return null;
          return {
            ...it,
            id: storyId,
            _id: storyId,
            imageUrl: it.imageUrl || null,
            videoUrl: it.videoUrl || null,
            mediaUrl: it.mediaUrl || it.imageUrl || it.videoUrl || null,
            mediaType: it.mediaType || (it.videoUrl ? 'video' : 'image'),
          };
        })
        .filter(Boolean);
      return res.json({ success: true, data: normalized });
    }

    const storyIds = highlight.stories || [];
    if (!storyIds || storyIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const Story = mongoose.model('Story');
    const storiesArray = await Story.find({
      _id: { $in: storyIds.filter(sid => mongoose.Types.ObjectId.isValid(sid)) }
    }).lean();

    const enrichedStories = storiesArray.map(story => ({
      ...story,
      id: String(story._id),
      imageUrl: story.image || null,
      videoUrl: story.video || null,
      mediaUrl: story.image || story.video || null,
      mediaType: story.video ? 'video' : 'image',
    }));

    enrichedStories.sort((a, b) => {
      const idxA = storyIds.indexOf(a.id);
      const idxB = storyIds.indexOf(b.id);
      return idxA - idxB;
    });

    res.json({ success: true, data: enrichedStories });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
