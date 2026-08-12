const mongoose = require('mongoose');
require('dotenv').config({ path: '../.env' });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const DEFAULT_CATEGORIES = [
  { name: 'Stand Up', image: 'https://images.pexels.com/photos/2810816/pexels-photo-2810816.jpeg?auto=compress&cs=tinysrgb&w=150' },
  { name: 'Memes', image: 'https://images.pexels.com/photos/1545743/pexels-photo-1545743.jpeg?auto=compress&cs=tinysrgb&w=150' },
  { name: 'Pranks', image: 'https://images.pexels.com/photos/1006073/pexels-photo-1006073.jpeg?auto=compress&cs=tinysrgb&w=150' },
  { name: 'Comics', image: 'https://images.pexels.com/photos/3184291/pexels-photo-3184291.jpeg?auto=compress&cs=tinysrgb&w=150' },
  { name: 'Street pranks', image: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=150' }
];

async function seedCategories() {
  if (!MONGO_URI) {
    console.error('❌ MONGO_URI not found in .env');
    process.exit(1);
  }

  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ Connected to MongoDB Atlas!');

  const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true },
    image: { type: String, default: null },
    createdAt: { type: Date, default: Date.now }
  });

  const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);

  // Clear existing categories and insert defaults
  await Category.deleteMany({});
  const inserted = await Category.insertMany(DEFAULT_CATEGORIES);

  console.log(`✅ Successfully seeded ${inserted.length} categories into MongoDB Atlas:`);
  inserted.forEach(c => console.log(`   • ${c.name}`));

  await mongoose.disconnect();
  process.exit(0);
}

seedCategories().catch((err) => {
  console.error('❌ Category seeding failed:', err);
  process.exit(1);
});
