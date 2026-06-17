const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/travel-social';

console.log('Connecting to MongoDB for removing mrcozy data at:', mongoUri);

async function runCleanup() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to DB successfully!');

    // Retrieve User model or define inline schema fallback
    const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
      email: String,
      username: String,
      firebaseUid: String,
      uid: String
    }));

    const user = await User.findOne({ 
      $or: [
        { email: 'mrcozy@comedy.com' },
        { username: 'mrcozy' }
      ]
    });
    
    if (user) {
      console.log('Found user:', user.username, 'ID:', user._id);
      
      const targetUserId = String(user._id);
      const candidates = [targetUserId, user.firebaseUid, user.uid].filter(Boolean);

      // 1. Delete user's posts
      const Post = mongoose.models.Post || mongoose.model('Post', new mongoose.Schema({
        userId: String
      }));
      const deletePostsResult = await Post.deleteMany({ userId: { $in: candidates } });
      console.log(`Deleted ${deletePostsResult.deletedCount} posts created by mrcozy.`);

      // 2. Delete follow records
      const Follow = mongoose.models.Follow || mongoose.model('Follow', new mongoose.Schema({
        followerId: String,
        followingId: String
      }));
      const deleteFollowsResult = await Follow.deleteMany({
        $or: [
          { followerId: { $in: candidates } },
          { followingId: { $in: candidates } }
        ]
      });
      console.log(`Deleted ${deleteFollowsResult.deletedCount} follow relationships involving mrcozy.`);

      // 3. Delete comments
      const Comment = mongoose.models.Comment || mongoose.model('Comment', new mongoose.Schema({
        userId: String
      }));
      const deleteCommentsResult = await Comment.deleteMany({ userId: { $in: candidates } });
      console.log(`Deleted ${deleteCommentsResult.deletedCount} comments made by mrcozy.`);

      // 4. Delete user itself
      await User.deleteOne({ _id: user._id });
      console.log('Deleted user mrcozy successfully.');
    } else {
      console.log('User mrcozy not found in database.');
    }

    process.exit(0);
  } catch (error) {
    console.error('Cleanup failed:', error);
    process.exit(1);
  }
}

runCleanup();
