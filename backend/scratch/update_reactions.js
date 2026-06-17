const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/travel-social';

console.log('Connecting to MongoDB at:', mongoUri);

async function updateReactions() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to DB!');

    const Post = mongoose.models.Post || mongoose.model('Post', new mongoose.Schema({}, { strict: false }));
    const posts = await Post.find({});

    console.log(`Found ${posts.length} posts to update.`);
    for (const post of posts) {
      const laughCount = Math.floor(Math.random() * 500) + 50;
      const tomatoCount = Math.floor(Math.random() * 50) + 5;
      const viewsCount = Math.floor(laughCount * 12.5 + tomatoCount * 4.3 + 120);

      await Post.updateOne(
        { _id: post._id },
        { 
          $set: { 
            laughCount, 
            tomatoCount,
            viewsCount,
            laughedBy: [],
            tomatoedBy: []
          } 
        }
      );
      console.log(`Updated post ${post._id} with 😂 ${laughCount}, 🍅 ${tomatoCount}`);
    }

    console.log('Successfully updated all posts!');
    process.exit(0);
  } catch (error) {
    console.error('Update failed:', error);
    process.exit(1);
  }
}

updateReactions();
