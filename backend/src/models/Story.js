const mongoose = require('mongoose');

const storyCommentSchema = new mongoose.Schema({
  userId:     { type: String, required: true },
  userName:   { type: String, default: 'Anonymous' },
  userAvatar: { type: String, default: null },
  text:       { type: String, required: true },
  editedAt:   { type: Date, default: null },
  createdAt:  { type: Date, default: Date.now },
}, { _id: true }); // Mongoose auto-generates ObjectId _id for each comment

const storySchema = new mongoose.Schema({
  userId: String,
  userName: String,
  userAvatar: String,
  image: String,
  video: String,
  thumbnail: String,
  caption: String,
  locationData: Object,
  postMetadata: { type: mongoose.Schema.Types.Mixed, default: null },
  isPostShare: Boolean,
  visibility: String,
  allowedFollowers: [String],
  isPrivate: Boolean,
  isDeleted: { type: Boolean, default: false },
  views: [String],
  likes: [String],
  comments: { type: [storyCommentSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) }
});

storySchema.index({ userId: 1, createdAt: -1 });
storySchema.index({ userId: 1, isDeleted: 1, createdAt: -1 });
storySchema.index({ createdAt: -1 });
// Compound index for the active-stories feed: match expiresAt > now, sort by createdAt
storySchema.index({ expiresAt: 1, createdAt: -1 });

const Story = mongoose.models.Story || mongoose.model('Story', storySchema);

// Drop the legacy TTL index if it still exists in the MongoDB collection
Story.collection.indexes()
  .then(indexes => {
    const ttlIndex = indexes.find(idx => idx.name === 'expiresAt_1' && idx.expireAfterSeconds !== undefined);
    if (ttlIndex) {
      console.log('📌 [StoryModel] Dropping legacy TTL index expiresAt_1 to enable Story Archive...');
      return Story.collection.dropIndex('expiresAt_1');
    }
  })
  .then(res => {
    if (res) console.log('✅ [StoryModel] Successfully dropped legacy TTL index. Stories will now be archived permanently.');
  })
  .catch(err => {
    if (err.code !== 27 && !err.message?.includes('index not found')) {
      console.warn('⚠️ [StoryModel] Check/drop TTL index warning:', err.message);
    }
  });

module.exports = Story;
