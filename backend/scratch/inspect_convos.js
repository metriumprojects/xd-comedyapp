const mongoose = require('mongoose');
const mongoUri = 'mongodb://comedyapp_db:582NLsXkus0UpzLM@ac-kcegpvr-shard-00-00.oodwscn.mongodb.net:27017,ac-kcegpvr-shard-00-01.oodwscn.mongodb.net:27017,ac-kcegpvr-shard-00-02.oodwscn.mongodb.net:27017/comedyapp?ssl=true&replicaSet=atlas-dw22r4-shard-0&authSource=admin&retryWrites=true&w=majority';

const ConversationSchema = new mongoose.Schema({}, { strict: false });
const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema, 'conversations');

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to DB');

  const userId = '6a4e4a48900721e0fb3a1743'; // testuser3
  const convos = await Conversation.find({ participants: userId }).lean();
  console.log('Conversations count:', convos.length);
  convos.forEach((c, idx) => {
    console.log(`Convo #${idx + 1}:`, JSON.stringify(c));
  });

  await mongoose.disconnect();
}

run().catch(console.error);
