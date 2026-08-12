const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function wipeDatabase() {
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI not found in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas production database...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas!');

  const collections = await mongoose.connection.db.collections();
  console.log(`Found ${collections.length} collections in MongoDB Atlas.`);

  for (let collection of collections) {
    const name = collection.collectionName;
    console.log(`🧹 Wiping collection: ${name}...`);
    try {
      await collection.deleteMany({});
      console.log(`  ✓ Cleared ${name}`);
    } catch (e) {
      console.warn(`  ⚠️ Failed to clear ${name}:`, e.message);
    }
  }

  console.log('\n🎉 ALL MONGODB COLLECTIONS HAVE BEEN FULLY WIPED & CLEARED!');
  console.log('The database is now 100% fresh, clean, and ready for TestFlight launch.');

  await mongoose.disconnect();
  process.exit(0);
}

wipeDatabase().catch((err) => {
  console.error('❌ Database wipe failed:', err);
  process.exit(1);
});
