const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

async function run() {
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI not found in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas!');

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }));

  const totalUsers = await User.countDocuments();
  console.log(`Found ${totalUsers} total users in MongoDB database.`);

  // Unset firebaseUid on all users so they can be auto-linked seamlessly when signing up/logging in with the new Firebase project
  const res = await User.updateMany(
    {},
    { $unset: { firebaseUid: "" } }
  );

  console.log(`✅ Successfully reset firebaseUid on ${res.modifiedCount} users!`);
  console.log('Existing users will now automatically link to their profiles on first login/signup in the new Firebase project.');

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
