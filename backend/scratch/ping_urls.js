const axios = require('axios');

const urls = [
  'https://comedy-app-backend.onrender.com/api/ping-v2',
  'https://comedyapp-backend.onrender.com/api/ping-v2',
  'https://trave-social-backend.onrender.com/api/ping-v2',
  'https://travel-social-backend.onrender.com/api/ping-v2'
];

async function run() {
  for (const url of urls) {
    console.log(`Pinging ${url}...`);
    try {
      const res = await axios.get(url, { timeout: 4000 });
      console.log(`✅ Success for ${url}: status=${res.status}, data=`, res.data);
    } catch (err) {
      console.log(`❌ Failed for ${url}: ${err.message}`);
    }
  }
}

run();
