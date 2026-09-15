const mongoose = require('mongoose');
require('dotenv').config();

const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

const MONGODB_URI = process.env.MONGO_URI;

async function checkDatabase() {
  try {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });

    console.log('Connected to MongoDB');

    // Check users collection
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('\n📊 Collections in database:');
    collections.forEach(col => console.log(`  - ${col.name}`));

    // Count documents in each collection
    console.log('\n📈 Document counts:');
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments();
      console.log(`  ${col.name}: ${count} documents`);
    }

    // Get sample posts if they exist
    const postsCollection = db.collection('posts');
    const postsCount = await postsCollection.countDocuments();
    if (postsCount > 0) {
      console.log('\n🔍 Sample posts:');
      const samplePosts = await postsCollection.find().limit(3).toArray();
      console.log(JSON.stringify(samplePosts, null, 2));
    } else {
      console.log('\n⚠️ No posts found in MongoDB');
    }

    // Get sample users
    const usersCollection = db.collection('users');
    const usersCount = await usersCollection.countDocuments();
    if (usersCount > 0) {
      console.log('\n👥 Sample users:');
      const sampleUsers = await usersCollection.find().limit(3).toArray();
      console.log(JSON.stringify(sampleUsers, null, 2));
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

checkDatabase();
