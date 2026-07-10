const mongoose = require('mongoose');
const mongoUri = 'mongodb://comedyapp_db:582NLsXkus0UpzLM@ac-kcegpvr-shard-00-00.oodwscn.mongodb.net:27017,ac-kcegpvr-shard-00-01.oodwscn.mongodb.net:27017,ac-kcegpvr-shard-00-02.oodwscn.mongodb.net:27017/comedyapp?ssl=true&replicaSet=atlas-dw22r4-shard-0&authSource=admin&retryWrites=true&w=majority';

const MessageSchema = new mongoose.Schema({}, { strict: false });
const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema, 'messages');

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to DB');

  const convoId = '6a47fde4cd95b0100994aae5_6a4e4a48900721e0fb3a1743';
  const msgs = await Message.find({ conversationId: convoId }).sort({ timestamp: 1 }).lean();
  console.log(`Total messages in convo ${convoId}: ${msgs.length}`);
  
  msgs.forEach((m, idx) => {
    console.log(`Msg #${idx + 1}: ID: ${m._id}, type: ${m.mediaType}, text: "${m.text}", hasSharedPost: ${!!m.sharedPost}, keys: ${Object.keys(m).join(', ')}`);
    if (m.sharedPost) console.log(`   - sharedPost: ${JSON.stringify(m.sharedPost)}`);
    if (m.sharedStory) console.log(`   - sharedStory: ${JSON.stringify(m.sharedStory)}`);
    if (m.reactions && Object.keys(m.reactions).length > 0) console.log(`   - reactions: ${JSON.stringify(m.reactions)}`);
  });

  await mongoose.disconnect();
}

run().catch(console.error);
