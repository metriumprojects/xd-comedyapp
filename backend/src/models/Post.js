const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true },
  content: { type: String, required: true },
  caption: { type: String },
  imageUrl: String,
  mediaUrls: { type: [String], default: [] },
  mediaType: { type: String, enum: ['image', 'video'], default: 'image' },
  thumbnailUrl: String,
  aspectRatio: Number,
  location: String,
  locationData: {
    name: String,
    address: String,
    placeId: String,
    neighborhood: String,
    city: String,
    country: String,
    countryCode: String,
    lat: Number,
    lon: Number,
    verified: Boolean
  },
  locationKeys: { type: [String], default: [] },
  category: String,
  hashtags: { type: [String], default: [] },
  mentions: { type: [String], default: [] },
  taggedUserIds: { type: [String], default: [] },
  likes: { type: [String], default: [] },
  likesCount: { type: Number, default: 0 },
  comments: { type: Array, default: [] }, // Array of comment objects (when stored in post)
  commentsCount: { type: Number, default: 0 }, // Cached count
  commentCount: { type: Number, default: 0 }, // Alias for frontend compatibility
  reactions: { type: Array, default: [] }, // Array of { userId, userName, userAvatar, emoji, createdAt }
  savedBy: { type: [String], default: [] }, // Array of user IDs who saved this post
  savesCount: { type: Number, default: 0 }, // Count of saves
  laughCount: { type: Number, default: 0 },
  tomatoCount: { type: Number, default: 0 },
  laughedBy: { type: [String], default: [] },
  tomatoedBy: { type: [String], default: [] },
  viewsCount: { type: Number, default: 0 },
  isPrivate: { type: Boolean, default: false }, // Privacy flag: true = private account post
  visibility: { type: String, default: 'Everyone' }, // Visibility setting: 'Everyone', 'Friends', 'Family', etc.
  allowedFollowers: { type: [String], default: [] }, // Array of follower IDs who can see this private post
  subscriptionTierId: { type: mongoose.Schema.Types.ObjectId, ref: 'SubscriptionTier', default: null }, // Tier lock ID
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Feed / discovery: sort by createdAt + privacy filters hit these paths constantly.
PostSchema.index({ createdAt: -1 });
PostSchema.index({ isPrivate: 1, createdAt: -1 });
PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ locationKeys: 1, createdAt: -1 });
PostSchema.index({ allowedFollowers: 1, createdAt: -1 });
PostSchema.index({ hashtags: 1, createdAt: -1 });
PostSchema.index({ category: 1, createdAt: -1 });
PostSchema.index({ visibility: 1, createdAt: -1 });
PostSchema.index({ laughCount: -1 });
PostSchema.index({ tomatoCount: -1 });
// Compound indexes for scaled feed queries
PostSchema.index({ mediaType: 1, createdAt: -1 });              // Video/image filter + sort
PostSchema.index({ isPrivate: 1, visibility: 1, createdAt: -1 }); // Visibility filter + sort
PostSchema.index({ laughCount: -1, createdAt: -1 });             // Laugh leaderboard
PostSchema.index({ tomatoCount: -1, createdAt: -1 });            // Tomato leaderboard
PostSchema.index({ 
  location: 'text', 
  'locationData.name': 'text', 
  caption: 'text',
  hashtags: 'text' 
}, { 
  weights: { 
    location: 10, 
    'locationData.name': 10, 
    caption: 5, 
    hashtags: 2 
  },
  name: "PostSearchIndex" 
});


module.exports = mongoose.models.Post || mongoose.model('Post', PostSchema);
