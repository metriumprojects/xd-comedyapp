const mongoose = require('mongoose');

// Load environment variables if available
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/travel-social';

async function run() {
  try {
    console.log('Connecting to database:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const hasSubscriptions = collections.some(col => col.name === 'subscriptions');
    
    if (hasSubscriptions) {
      console.log('Fetching indexes for "subscriptions"...');
      const indexes = await db.collection('subscriptions').indexes();
      console.log('Current indexes:', indexes);
      
      console.log('Dropping all indexes on "subscriptions" collection...');
      await db.collection('subscriptions').dropIndexes();
      console.log('✅ Successfully dropped all indexes!');
    } else {
      console.log('❌ "subscriptions" collection does not exist.');
    }
  } catch (error) {
    console.error('🔴 Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

run();
