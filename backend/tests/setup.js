const mongoose = require('mongoose');
require('dotenv').config();

beforeAll(async () => {
  // Ensure we are using a test database if possible, or just the dev one if specified
  const uri = process.env.MONGO_URI_TEST || process.env.MONGO_URI;
  console.log(`🔌 Connecting to DB for tests: ${uri.split('@')[1] || 'local'}`);
  if (!mongoose.connection.readyState && uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 2000 });
      console.log('✅ DB Connected for tests');
    } catch (err) {
      console.warn('⚠️ DB Connection unavailable for tests (offline/unit-mode):', err.message);
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState) {
    await mongoose.connection.close();
  }
});
