const mongoose = require('mongoose');
const mongoUri = 'mongodb://comedyapp_db:582NLsXkus0UpzLM@ac-kcegpvr-shard-00-00.oodwscn.mongodb.net:27017,ac-kcegpvr-shard-00-01.oodwscn.mongodb.net:27017,ac-kcegpvr-shard-00-02.oodwscn.mongodb.net:27017/comedyapp?ssl=true&replicaSet=atlas-dw22r4-shard-0&authSource=admin&retryWrites=true&w=majority';

const ConversationSchema = new mongoose.Schema({}, { strict: false });
const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema, 'conversations');

const MessageSchema = new mongoose.Schema({}, { strict: false });
const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema, 'messages');

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to DB');

  const userId = '6a4e4a48900721e0fb3a1743'; // testuser3
  const otherUserId = '6a47fde4cd95b0100994aae5'; // testuser2

  // 1. Find conversation
  const conv = await Conversation.findOne({
    $and: [
      { isGroup: { $ne: true } },
      { participants: userId },
      { participants: otherUserId }
    ]
  }).lean();

  console.log('Conversation:', conv);

  if (conv) {
    const convoIdsArray = [String(conv.conversationId), String(conv._id)];
    
    // Find all raw messages
    const rawMsgs = await Message.find({
      conversationId: { $in: convoIdsArray }
    }).sort({ createdAt: -1, timestamp: -1 }).lean();

    console.log(`Total messages in DB: ${rawMsgs.length}`);

    // Let's print each message timestamp and if it would be filtered
    const clearedMap = conv.clearedBy || {};
    const idsToMatch = [userId]; // in API verifyToken it includes variants, but let's test this
    
    let lastCleared = 0;
    for (const uid of idsToMatch) {
      const timeVal = clearedMap instanceof Map ? clearedMap.get(uid) : clearedMap[uid];
      if (timeVal) {
        const t = new Date(timeVal).getTime();
        if (t > lastCleared) lastCleared = t;
      }
    }
    console.log('lastCleared timestamp:', lastCleared, new Date(lastCleared).toISOString());

    rawMsgs.forEach((m, idx) => {
      const mTime = new Date(m.timestamp || m.createdAt || 0).getTime();
      const kept = mTime > lastCleared;
      console.log(`Msg #${idx+1}: id=${m.id || m._id}, text="${m.text}", mTime=${new Date(mTime).toISOString()}, kept=${kept}`);
    });
  }

  await mongoose.disconnect();
}

run().catch(console.error);
