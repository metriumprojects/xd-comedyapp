const mongoose = require('mongoose');
const mongoUri = 'mongodb://comedyapp_db:582NLsXkus0UpzLM@ac-kcegpvr-shard-00-00.oodwscn.mongodb.net:27017,ac-kcegpvr-shard-00-01.oodwscn.mongodb.net:27017,ac-kcegpvr-shard-00-02.oodwscn.mongodb.net:27017/comedyapp?ssl=true&replicaSet=atlas-dw22r4-shard-0&authSource=admin&retryWrites=true&w=majority';

const UserSchema = new mongoose.Schema({}, { strict: false });
const ConversationSchema = new mongoose.Schema({}, { strict: false });
const MessageSchema = new mongoose.Schema({}, { strict: false });

const User = mongoose.models.User || mongoose.model('User', UserSchema, 'users');
const Conversation = mongoose.models.Conversation || mongoose.model('Conversation', ConversationSchema, 'conversations');
const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema, 'messages');

async function run() {
  await mongoose.connect(mongoUri);
  console.log('Connected to DB');

  const user = await User.findOne({ email: 'testuser3@gmail.com' }).lean();
  console.log('User testuser3:', user);

  if (user) {
    const userId = String(user._id);
    const convos = await Conversation.find({ participants: userId }).lean();
    console.log('Conversations count:', convos.length);
    for (const c of convos) {
      const convoId = c.conversationId || String(c._id);
      console.log('\n--- Convo ID:', convoId, 'participants:', c.participants);
      const msgs = await Message.find({ conversationId: convoId }).sort({ timestamp: -1 }).limit(15).lean();
      console.log('Messages (last 15):');
      msgs.forEach(m => console.log(JSON.stringify(m)));
    }
  } else {
    console.log('User testuser3@gmail.com not found');
  }

  await mongoose.disconnect();
}

run().catch(console.error);
