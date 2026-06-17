const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/travel-social';

console.log('Connecting to MongoDB at:', mongoUri);

async function runInspect() {
  try {
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB successfully!\n');

    // Load/define models
    const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
      email: String,
      username: String,
      displayName: String,
      firebaseUid: String,
      uid: String,
      createdAt: Date
    }));

    const Post = mongoose.models.Post || mongoose.model('Post', new mongoose.Schema({
      userId: String,
      caption: String,
      content: String,
      mediaUrls: [String],
      createdAt: Date
    }));

    // Find all users
    const users = await User.find({}).lean();
    console.log(`=== DATABASE USERS (${users.length}) ===`);
    
    const userMap = {};
    for (const u of users) {
      userMap[String(u._id)] = u;
      if (u.firebaseUid) userMap[u.firebaseUid] = u;
      if (u.uid) userMap[u.uid] = u;

      // Count posts for this user
      const postCount = await Post.countDocuments({ 
        userId: { $in: [String(u._id), u.firebaseUid, u.uid].filter(Boolean) } 
      });

      console.log(`- ID: ${u._id}`);
      console.log(`  DisplayName: "${u.displayName}"`);
      console.log(`  Username: "${u.username || 'N/A'}"`);
      console.log(`  Email: "${u.email}"`);
      console.log(`  FirebaseUid: "${u.firebaseUid || 'N/A'}"`);
      console.log(`  Posts Count: ${postCount}`);
      console.log('-----------------------------------');
    }

    // Find all posts
    const posts = await Post.find({}).sort({ createdAt: -1 }).lean();
    console.log(`\n=== DATABASE POSTS (${posts.length}) ===`);
    
    for (const p of posts) {
      const creator = userMap[p.userId] || { displayName: 'Unknown Creator', email: 'N/A' };
      console.log(`- Post ID: ${p._id}`);
      console.log(`  Creator: "${creator.displayName}" (${creator.email})`);
      console.log(`  Caption: "${p.caption || p.content || 'No Caption'}"`);
      console.log(`  Media URLs:`, p.mediaUrls);
      console.log(`  Created At: ${p.createdAt}`);
      console.log('-----------------------------------');
    }

    process.exit(0);
  } catch (error) {
    console.error('Inspection failed:', error);
    process.exit(1);
  }
}

runInspect();
