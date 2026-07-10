const mongoose = require('mongoose');
const mongoUri = 'mongodb://comedyapp_db:582NLsXkus0UpzLM@ac-kcegpvr-shard-00-00.oodwscn.mongodb.net:27017,ac-kcegpvr-shard-00-01.oodwscn.mongodb.net:27017,ac-kcegpvr-shard-00-02.oodwscn.mongodb.net:27017/comedyapp?ssl=true&replicaSet=atlas-dw22r4-shard-0&authSource=admin&retryWrites=true&w=majority';

const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.models.User || mongoose.model('User', UserSchema, 'users');

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to DB');

  const p1 = await User.findById('6a47fde4cd95b0100994aae5').lean();
  console.log('User 6a47fde4cd95b0100994aae5:', p1);

  const p2 = await User.findById('6a4e4a48900721e0fb3a1743').lean();
  console.log('User 6a4e4a48900721e0fb3a1743:', p2);

  const p3 = await User.findById('6a50892df23bab013efbc039').lean();
  console.log('User 6a50892df23bab013efbc039:', p3);

  await mongoose.disconnect();
}

run().catch(console.error);
