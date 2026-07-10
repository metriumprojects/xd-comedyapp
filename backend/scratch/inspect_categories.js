const mongoose = require('mongoose');
const mongoUri = 'mongodb://comedyapp_db:582NLsXkus0UpzLM@ac-kcegpvr-shard-00-00.oodwscn.mongodb.net:27017,ac-kcegpvr-shard-00-01.oodwscn.mongodb.net:27017,ac-kcegpvr-shard-00-02.oodwscn.mongodb.net:27017/comedyapp?ssl=true&replicaSet=atlas-dw22r4-shard-0&authSource=admin&retryWrites=true&w=majority';

const CategorySchema = new mongoose.Schema({
  name: String,
  image: String
}, { collection: 'categories' });

const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to DB');

  const categories = await Category.find().lean();
  console.log('Categories in MongoDB:', categories);

  await mongoose.disconnect();
}

run().catch(console.error);
