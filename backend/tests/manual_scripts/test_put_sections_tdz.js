const http = require('http');
require('dotenv').config();

const { generateToken } = require('../../src/middleware/authMiddleware');

const TEST_UID = '6a2bbe1e7fde57e0149b3e9a';
const token = generateToken(TEST_UID, 'oceanshah87@gmail.com');

console.log('🔑 Generated Test JWT Token:', token);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: `/api/users/${TEST_UID}/sections/661234567890abcdef123456`,
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('📡 Response Status:', res.statusCode);
    console.log('📡 Response Body:', data);
    process.exit(0);
  });
});

req.on('error', (err) => {
  console.error('❌ Request Error:', err.message);
  process.exit(1);
});

req.write(JSON.stringify({ name: 'New Section Name' }));
req.end();
