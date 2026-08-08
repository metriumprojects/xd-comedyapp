require('dotenv').config();
// Set DNS servers to Google & Cloudflare to resolve MongoDB Atlas SRV DNS query issues
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const admin = require('firebase-admin');
const path = require('path');
const { initSentry, setupSentryErrorHandler } = require('./utils/sentry');
const { validateEnv } = require('./config/validateEnv');
const compression = require('compression');

// ====== VALIDATE ENVIRONMENT VARIABLES ON STARTUP ======
// This will throw and crash the process if critical vars are missing.
try {
  validateEnv();
} catch (err) {
  console.error('🔴 FATAL: Environment validation failed:', err.message);
  process.exit(1);
}

// ====== AUTO-REQUIRE ALL MODELS ======
require('./models/User');
require('./models/Post');
require('./models/Category');
require('./models/LiveStream');
require('./models/Conversation');
require('./models/Message');
require('./models/Passport');
require('./models/Follow');
require('./models/Comment');
require('./models/Story');
require('./models/Highlight');
require('./models/Section');
require('./models/Notification');
require('./models/Group');
require('./models/Report');
require('./models/Block');
require('./models/AdminLog');
require('./models/Region');
require('./models/Subscription');
require('./models/SubscriptionTier');
require('./models/Withdrawal');

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 5000;

// ============= RATE LIMITING =============
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 1500 : 999999, // prevent rate limiting in dev/testing
  message: { success: false, error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// ============= SENTRY INITIALIZATION =============
// Must be called before any other middleware
initSentry(app);

// ============= FIREBASE INITIALIZATION =============
try {
  let serviceAccount = null;

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      console.warn('⚠️ Invalid FIREBASE_SERVICE_ACCOUNT JSON in env:', e.message);
    }
  } else {
    const serviceAccountPath = path.join(__dirname, '../serviceAccountKey.json');
    try {
      serviceAccount = require(serviceAccountPath);
    } catch (e) {
      // Local file not found, which is fine if env var is used in production
    }
  }

  if (admin.apps.length === 0) {
    if (serviceAccount) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
      });
      console.log('✅ Firebase Admin initialized successfully');
    } else {
      console.warn('⚠️ No Firebase Service Account found. Firebase Auth verification and notifications may not work.');
    }
  }
} catch (error) {
  console.warn('⚠️ Firebase Admin initialization warning:', error.message);
}

// ============= MIDDLEWARE =============
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : [];
if (allowedOrigins.length === 0 && process.env.NODE_ENV === 'production') {
  console.error('❌ CRITICAL: ALLOWED_ORIGINS not configured for production');
  process.exit(1);
}
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' ? allowedOrigins : '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'userid', 'x-requested-with'],
  credentials: true
};
app.use(compression());
app.use(cors(corsOptions));
app.get('/api/ping-v2', (req, res) => res.json({ success: true, message: 'pong-v2', timestamp: new Date() }));
// Request Logger for debugging mobile connections
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`🔍 [DEBUG] Incoming: ${req.method} ${req.originalUrl || req.url}`);
  }
  next();
});
app.use(helmet({ contentSecurityPolicy: false })); // Disable CSP for easier dev testing
app.use(mongoSanitize());
app.use(hpp());
// Stripe webhook needs raw body for signature verification — must come BEFORE json parser
app.use('/api/subscriptions/webhook', express.raw({ type: 'application/json' }));
// Reduced from 50mb to 5mb to prevent DDoS payload attacks
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/assests', express.static(path.join(__dirname, '../assests')));
app.use('/stamps', express.static(path.join(__dirname, '../stamps')));

// ============= DATABASE CONNECTION =============
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('🔴 FATAL: MONGO_URI environment variable is not set!');
  process.exit(1);
}
mongoose.connect(mongoUri, {
  serverSelectionTimeoutMS: 10000, // Fail fast if DB unreachable
  socketTimeoutMS: 45000,
})
  .then(async () => {
    console.log('✅ MongoDB connected');
    try {
      await mongoose.connection.db.collection('subscriptiontiers').dropIndex('creatorId_1');
      console.log('✅ Dropped unique index creatorId_1 on subscriptiontiers');
    } catch (e) {
      // Index might not exist or is already dropped
    }
    try {
      await mongoose.connection.db.collection('subscriptions').dropIndex('subscriberId_1_creatorId_1');
      console.log('✅ Dropped unique index subscriberId_1_creatorId_1 on subscriptions');
    } catch (e) {
      // Index might not exist or is already dropped
    }
  })
  .catch(err => {
    console.error('🔴 FATAL: MongoDB connection failed:', err.message);
    process.exit(1); // Do NOT start serving requests with no DB
  });

// ============= ROUTES =============
const routes = require('./routes');
app.use('/api', routes);

// ============= SENTRY ERROR HANDLER =============
// Must be registered after all controllers and before other error middleware
setupSentryErrorHandler(app);

// ============= ERROR RATE ALERTING =============
// Monitors critical error spike thresholds
const errorAlertMiddleware = require('./middleware/errorAlertMiddleware');
app.use(errorAlertMiddleware);

// ============= SHARE PREVIEW ENDPOINTS =============
app.get('/api/share/post/:id', (req, res) => res.redirect(301, `/share/post/${req.params.id}`));
app.get('/api/share/story/:id', (req, res) => res.redirect(301, `/share/story/${req.params.id}`));
app.get('/api/share/profile/:id', (req, res) => res.redirect(301, `/share/profile/${req.params.id}`));

app.get('/share/post/:id', async (req, res) => {
  const postId = req.params.id;
  try {
    const Post = mongoose.model('Post');
    const User = mongoose.model('User');
    let post = null;
    if (mongoose.Types.ObjectId.isValid(postId)) {
      post = await Post.findById(postId).lean();
    }
    let authorName = 'Someone';
    let imageUrl = '';
    let caption = '';

    if (post) {
      caption = post.content || post.caption || '';
      imageUrl = (post.mediaUrls && post.mediaUrls[0]) || post.mediaUrl || post.imageUrl || '';
      const author = await User.findById(post.userId).lean();
      if (author) {
        authorName = author.displayName || author.username || author.name || 'Someone';
      }
    }

    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Check out this post on Comedy App!</title>
  <meta property="og:title" content="Check out ${authorName}'s post on Comedy App!" />
  <meta property="og:description" content="${caption ? caption.replace(/"/g, '&quot;') : 'Shared a new comedy moment'}" />
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}" />` : ''}
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #121212;
      color: #ffffff;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .card {
      background: #1e1e1e;
      border: 1px solid #333;
      border-radius: 16px;
      max-width: 450px;
      width: 90%;
      padding: 24px;
      text-align: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      object-fit: cover;
      background: #333;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 20px;
      color: #fff;
      margin: 0 0 8px 0;
    }
    p {
      font-size: 15px;
      color: #bbb;
      margin: 0 0 20px 0;
      line-height: 1.4;
    }
    .post-preview {
      width: 100%;
      max-height: 320px;
      border-radius: 12px;
      object-fit: cover;
      margin-bottom: 20px;
    }
    .btn {
      display: block;
      background: #FF8D00;
      color: #fff;
      text-decoration: none;
      padding: 14px 24px;
      border-radius: 10px;
      font-weight: bold;
      font-size: 16px;
      margin-bottom: 12px;
      transition: background 0.2s;
    }
    .btn:hover {
      background: #e07b00;
    }
  </style>
  <script>
    window.onload = function() {
      var deepLinkUrl = "comedy-app://post-detail?id=${postId}";
      window.location.href = deepLinkUrl;
    };
  </script>
</head>
<body>
  <div class="card">
    <img class="avatar" src="https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=FF8D00&color=fff&size=120" alt="Avatar">
    <h1>Check out ${authorName}'s post on Comedy App!</h1>
    <p>${caption ? '"' + caption + '"' : 'Shared a new comedy moment'}</p>
    ${imageUrl ? '<img class="post-preview" src="' + imageUrl + '" alt="Post Media">' : ''}
    <a href="comedy-app://post-detail?id=${postId}" class="btn">Open in Comedy App</a>
  </div>
</body>
</html>
    `);
  } catch (err) {
    res.status(500).send('Error loading post preview');
  }
});

app.get('/share/story/:id', async (req, res) => {
  const storyId = req.params.id;
  try {
    const Story = mongoose.model('Story');
    const User = mongoose.model('User');
    let story = null;
    if (mongoose.Types.ObjectId.isValid(storyId)) {
      story = await Story.findById(storyId).lean();
    }
    let authorName = 'Someone';
    let imageUrl = '';
    let caption = '';

    if (story) {
      caption = story.caption || '';
      imageUrl = story.mediaUrl || story.image || story.thumbnail || '';
      const author = await User.findById(story.userId).lean();
      if (author) {
        authorName = author.displayName || author.username || author.name || 'Someone';
      }
    }

    res.send(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Check out this story on Comedy App!</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #121212;
      color: #ffffff;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .card {
      background: #1e1e1e;
      border: 1px solid #333;
      border-radius: 16px;
      max-width: 450px;
      width: 90%;
      padding: 24px;
      text-align: center;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    }
    .avatar {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      object-fit: cover;
      background: #333;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 20px;
      color: #fff;
      margin: 0 0 8px 0;
    }
    p {
      font-size: 15px;
      color: #bbb;
      margin: 0 0 20px 0;
    }
    .btn {
      display: block;
      background: #FF8D00;
      color: #fff;
      text-decoration: none;
      padding: 14px 24px;
      border-radius: 10px;
      font-weight: bold;
      font-size: 16px;
    }
  </style>
  <script>
    window.onload = function() {
      var deepLinkUrl = "comedy-app://story-detail?id=${storyId}";
      window.location.href = deepLinkUrl;
    };
  </script>
</head>
<body>
  <div class="card">
    <img class="avatar" src="https://ui-avatars.com/api/?name=${encodeURIComponent(authorName)}&background=FF8D00&color=fff&size=120" alt="Avatar">
    <h1>Check out ${authorName}'s story on Comedy App!</h1>
    <p>${caption ? '"' + caption + '"' : 'Shared a new story'}</p>
    <a href="comedy-app://story-detail?id=${storyId}" class="btn">Open in Comedy App</a>
  </div>
</body>
</html>
    `);
  } catch (err) {
    res.status(500).send('Error loading story preview');
  }
});

// ============= 404 HANDLER =============
// Must be after all routes
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// ============= GLOBAL ERROR HANDLER =============
// Must be last middleware — catches all unhandled errors to prevent process crash
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('🔴 Unhandled Error:', err.stack || err.message);
  // Never leak stack traces or internal details to the client
  res.status(err.status || 500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

const initSockets = require('./loaders/socket');

// Start server
let server;
let io;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 Local Access: http://localhost:${PORT}`);
  });

  // Initialize Socket.IO
  const JWT_SECRET = process.env.JWT_SECRET;
  io = initSockets(server, JWT_SECRET);
  app.set('io', io);
}

// ============= GRACEFUL SHUTDOWN =============
// Properly close connections on deploy/restart to avoid interrupted DB writes
function gracefulShutdown(signal) {
  console.log(`\n⚠️ ${signal} received. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log('✅ HTTP server closed.');
      if (io) {
        io.close(() => console.log('✅ Socket.IO closed.'));
      }
      mongoose.connection.close(false).then(() => {
        console.log('✅ MongoDB connection closed.');
        process.exit(0);
      }).catch(() => process.exit(0));
    });
  } else {
    mongoose.connection.close(false).then(() => {
      console.log('✅ MongoDB connection closed.');
      process.exit(0);
    }).catch(() => process.exit(0));
  }
  // Force shutdown after 10s if graceful shutdown fails
  setTimeout(() => {
    console.error('🔴 Forced shutdown after timeout.');
    process.exit(1);
  }, 10000);
}

if (process.env.NODE_ENV !== 'test') {
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

// ====== RENDER BACKEND KEEP-ALIVE SCHEDULER ======
if (process.env.NODE_ENV === 'production' || process.env.RENDER) {
  const SERVER_URL = process.env.RENDER_EXTERNAL_URL || process.env.SERVER_URL || 'https://travel-social-backend.onrender.com';
  setInterval(() => {
    fetch(`${SERVER_URL}/api/health`)
      .then(() => console.log('🔄 Render Keep-Alive Ping successful'))
      .catch(err => console.warn('⚠️ Render Keep-Alive Ping warning:', err.message));
  }, 14 * 60 * 1000); // Self-ping every 14 minutes
}

module.exports = server || app;