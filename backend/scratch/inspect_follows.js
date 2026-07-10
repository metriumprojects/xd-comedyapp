const mongoose = require('mongoose');
const mongoUri = 'mongodb://comedyapp_db:582NLsXkus0UpzLM@ac-kcegpvr-shard-00-00.oodwscn.mongodb.net:27017,ac-kcegpvr-shard-00-01.oodwscn.mongodb.net:27017,ac-kcegpvr-shard-00-02.oodwscn.mongodb.net:27017/comedyapp?ssl=true&replicaSet=atlas-dw22r4-shard-0&authSource=admin&retryWrites=true&w=majority';

const FollowSchema = new mongoose.Schema({}, { strict: false });
const Follow = mongoose.models.Follow || mongoose.model('Follow', FollowSchema, 'follows');

const UserSchema = new mongoose.Schema({}, { strict: false });
const User = mongoose.models.User || mongoose.model('User', UserSchema, 'users');

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to DB');

  const userId = '6a4e4a48900721e0fb3a1743'; // testuser3
  const following = await Follow.find({ followerId: userId }).lean();
  console.log('Following follows:', following);
  for (const f of following) {
    const u = await User.findById(f.followingId).lean();
    console.log(`Following user ${f.followingId}:`, u);
  }

  const followers = await Follow.find({ followingId: userId }).lean();
  console.log('Followers follows:', followers);
  for (const f of followers) {
    const u = await User.findById(f.followerId).lean();
    console.log(`Follower user ${f.followerId}:`, u);
  }

  await mongoose.disconnect();
}

run().catch(console.error);
