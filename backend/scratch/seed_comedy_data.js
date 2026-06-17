const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/travel-social';

console.log('Connecting to MongoDB for seeding at:', mongoUri);

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  username: { type: String, unique: true },
  password: { type: String },
  displayName: { type: String, default: 'User' },
  avatar: { type: String, default: null },
  role: { type: String, default: 'user' },
  status: { type: String, default: 'active' },
  createdAt: { type: Date, default: Date.now }
});

const PostSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  content: { type: String, required: true },
  caption: { type: String },
  mediaUrls: { type: [String], default: [] },
  mediaType: { type: String, default: 'video' },
  thumbnailUrl: String,
  category: String,
  likes: { type: [String], default: [] },
  likesCount: { type: Number, default: 0 },
  comments: { type: Array, default: [] },
  commentsCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  image: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Post = mongoose.models.Post || mongoose.model('Post', PostSchema);
const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);

async function runSeed() {
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to DB successfully!');

    // 1. Create a mock user
    let user = await User.findOne({ email: 'mrcozy@comedy.com' });
    if (!user) {
      console.log('Creating sample creator user...');
      const hashedPassword = await bcrypt.hash('password123', 10);
      user = await User.create({
        email: 'mrcozy@comedy.com',
        username: 'mrcozy',
        password: hashedPassword,
        displayName: 'MrCozy Standup',
        avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=150&w=150',
        role: 'user',
        status: 'active'
      });
      console.log('User created:', user.username, 'ID:', user._id);
    } else {
      console.log('Sample creator user already exists. ID:', user._id);
    }

    // 2. Clear and seed categories
    await Category.deleteMany({});
    console.log('Cleared existing categories.');

    const comedyCategories = [
      { name: 'Podium', image: 'https://images.pexels.com/photos/2810816/pexels-photo-2810816.jpeg?auto=compress&cs=tinysrgb&w=150' },
      { name: 'Comics', image: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=150' },
      { name: 'Pranks', image: 'https://images.pexels.com/photos/1006073/pexels-photo-1006073.jpeg?auto=compress&cs=tinysrgb&w=150' },
      { name: 'Stand Up', image: 'https://images.pexels.com/photos/2810816/pexels-photo-2810816.jpeg?auto=compress&cs=tinysrgb&w=150' },
      { name: 'Meme', image: 'https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=150' }
    ];

    console.log('Seeding comedy categories...');
    for (const cat of comedyCategories) {
      await Category.create(cat);
    }
    console.log('Comedy categories seeded!');

    // 3. Clear existing posts to start clean (optional, but good for demo)
    await Post.deleteMany({});
    console.log('Cleared existing posts.');

    // 4. Create mock posts/reels
    const mockPosts = [
      {
        userId: user._id.toString(),
        content: 'Guys this is from my latest stand-up show! What do you think? 😂🎤',
        caption: 'Stand-up comedy highlights from London! #comedy #standup #funny',
        mediaUrls: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'],
        mediaType: 'video',
        thumbnailUrl: 'https://images.pexels.com/photos/2810816/pexels-photo-2810816.jpeg?auto=compress&cs=tinysrgb&w=300',
        category: 'Stand Up',
        likes: [],
        likesCount: 154,
        commentsCount: 22
      },
      {
        userId: user._id.toString(),
        content: 'When you try to prank your friend but it goes completely wrong... 😭💀',
        caption: 'Prank gone wrong! Don\'t try this at home guys #pranks #funny #fail',
        mediaUrls: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4'],
        mediaType: 'video',
        thumbnailUrl: 'https://images.pexels.com/photos/1006073/pexels-photo-1006073.jpeg?auto=compress&cs=tinysrgb&w=300',
        category: 'Pranks',
        likes: [],
        likesCount: 382,
        commentsCount: 45
      },
      {
        userId: user._id.toString(),
        content: 'Every single morning meeting ever... relatable? 😂💼',
        caption: 'Workplace humor! Tag your coworker #memes #worklife #comedy',
        mediaUrls: ['https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4'],
        mediaType: 'video',
        thumbnailUrl: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=300',
        category: 'Comics',
        likes: [],
        likesCount: 890,
        commentsCount: 112
      }
    ];

    console.log('Seeding mock reels...');
    for (const postData of mockPosts) {
      const p = await Post.create(postData);
      console.log(`Created reel in category: ${p.category}, ID: ${p._id}`);
    }

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding failed:', error);
    process.exit(1);
  }
}

runSeed();
