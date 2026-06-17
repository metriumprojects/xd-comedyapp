const mongoose = require('mongoose');
const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/travel-social';
const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');

async function main() {
  console.log('🔄 Wiping all data and restarting database...');

  // 1. Initialize Firebase Admin and delete all Auth Users
  let firebaseActive = false;
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
    });
    console.log('✅ Connected to Firebase Admin.');
    firebaseActive = true;
  } catch (err) {
    console.warn('⚠️ Could not initialize Firebase Admin (skipping Auth user deletion):', err.message);
  }

  if (firebaseActive) {
    try {
      console.log('⏳ Listing and deleting all Firebase Auth users...');
      let totalDeleted = 0;
      let listUsersResult = await admin.auth().listUsers(1000);
      
      while (listUsersResult.users.length > 0) {
        const uids = listUsersResult.users.map(user => user.uid);
        await admin.auth().deleteUsers(uids);
        totalDeleted += uids.length;
        console.log(`   Deleted batch of ${uids.length} users...`);
        
        // Fetch next batch if available
        if (listUsersResult.pageToken) {
          listUsersResult = await admin.auth().listUsers(1000, listUsersResult.pageToken);
        } else {
          break;
        }
      }
      console.log(`✅ Successfully deleted a total of ${totalDeleted} Firebase Auth users.`);
    } catch (err) {
      console.error('❌ Error deleting Firebase Auth users:', err.message);
    }
  }

  // 2. Connect to MongoDB and drop database
  try {
    console.log(`⏳ Connecting to MongoDB at: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB.');

    console.log('⏳ Dropping travel-social database...');
    await mongoose.connection.db.dropDatabase();
    console.log('✅ Database dropped successfully.');

    // 3. Re-create default Category list so the Category menu isn't empty
    console.log('⏳ Re-seeding essential categories...');
    const CategorySchema = new mongoose.Schema({
      name: { type: String, required: true },
      image: { type: String, default: null },
      createdAt: { type: Date, default: Date.now },
    });
    const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);

    const defaultCategories = [
      { name: 'Podium', image: 'https://images.pexels.com/photos/2810816/pexels-photo-2810816.jpeg?auto=compress&cs=tinysrgb&w=150' },
      { name: 'Comics', image: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=150' },
      { name: 'Pranks', image: 'https://images.pexels.com/photos/1006073/pexels-photo-1006073.jpeg?auto=compress&cs=tinysrgb&w=150' },
      { name: 'Stand Up', image: 'https://images.pexels.com/photos/2810816/pexels-photo-2810816.jpeg?auto=compress&cs=tinysrgb&w=150' },
      { name: 'Meme', image: 'https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=150' }
    ];

    for (const cat of defaultCategories) {
      await Category.create(cat);
    }
    console.log('✅ Default categories re-seeded!');

    console.log('\n🌟 FRESH START SETUP COMPLETE!');
    process.exit(0);
  } catch (err) {
    console.error('❌ MongoDB operation failed:', err.message);
    process.exit(1);
  }
}

main();
