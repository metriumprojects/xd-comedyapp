const axios = require('axios');

async function run() {
  const url = 'https://travel-social-backend.onrender.com/api/categories';
  console.log('Fetching live categories from:', url);
  try {
    const res = await axios.get(url);
    console.log('Status:', res.status);
    console.log('Data returned:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('Error fetching live categories:', err.message);
  }
}

run();
