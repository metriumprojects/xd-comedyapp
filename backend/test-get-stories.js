const mongoose = require('mongoose');

async function run() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect('mongodb://127.0.0.1:27017/travel-social');
    console.log('Connected.');

    // Load models
    require('./src/models/Highlight');
    require('./src/models/Story');

    const Highlight = mongoose.model('Highlight');
    const Story = mongoose.model('Story');

    const highlights = await Highlight.find().lean();
    console.log(`Found ${highlights.length} highlights:`);
    console.log(JSON.stringify(highlights, null, 2));

    if (highlights.length > 0) {
      const hlId = highlights[0]._id;
      console.log(`Testing getHighlightStories logic for highlight ${hlId}...`);

      const highlight = await Highlight.findById(hlId);
      console.log('Highlight from db:', highlight);

      const items = Array.isArray(highlight.items) ? highlight.items : [];
      const hasSnapshots = items.some((it) => it && typeof it === 'object' && (it.mediaUrl || it.imageUrl || it.videoUrl));
      console.log('hasSnapshots:', hasSnapshots);

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
        console.log('Returned normalized snapshots count:', normalized.length);
      } else {
        const storyIds = highlight.stories || [];
        console.log('storyIds:', storyIds);
        const storiesArray = await Story.find({
          _id: { $in: storyIds.filter(sid => mongoose.Types.ObjectId.isValid(sid)) }
        }).lean();
        console.log('Returned storiesArray count:', storiesArray.length);
      }
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    process.exit();
  }
}

run();
