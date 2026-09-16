require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const axios = require('axios');

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  const p = await mongoose.connection.collection('posts').findOne({
    mediaUrls: { $exists: true, $not: { $size: 0 } }
  });
  console.log('Post mediaUrls:', p?.mediaUrls);
  console.log('Post thumbnailUrl:', p?.thumbnailUrl);

  const sampleUrl = p?.thumbnailUrl || p?.mediaUrls?.[0];
  console.log('Sample URL:', sampleUrl);

  if (sampleUrl) {
    const s3Path = sampleUrl.split('.amazonaws.com/')[1] || sampleUrl.split('comedyapp-bucket/')[1];
    const cdnUrl = `https://d2qhstwmcd6f2g.cloudfront.net/${s3Path}`;
    console.log('Testing S3 direct:', sampleUrl);
    try {
      const s3Res = await axios.get(sampleUrl, { timeout: 5000 });
      console.log('S3 direct status:', s3Res.status);
    } catch (e) {
      console.log('S3 direct error:', e.response?.status, e.message);
    }

    console.log('Testing CDN URL:', cdnUrl);
    try {
      const cdnRes = await axios.get(cdnUrl, { timeout: 5000 });
      console.log('CDN status:', cdnRes.status);
    } catch (e) {
      console.log('CDN error:', e.response?.status, e.message, e.response?.data);
    }
  }

  await mongoose.disconnect();
}

test();
