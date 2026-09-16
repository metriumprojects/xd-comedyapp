require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const sharp = require('sharp');

async function probeImageRatio(url) {
  try {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) return null;
    const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 8000 });
    const meta = await sharp(res.data).metadata();
    if (meta.width && meta.height && meta.height > 0) {
      return meta.width / meta.height;
    }
  } catch (e) {
    // Silent
  }
  return null;
}

async function run() {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error('No MONGO_URI found in environment.');
    process.exit(1);
  }

  console.log('Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  const Post = mongoose.connection.collection('posts');

  // Find posts where aspectRatio is missing, null, or exactly 1 (which was the false default)
  const posts = await Post.find({
    $or: [
      { aspectRatio: { $exists: false } },
      { aspectRatio: null },
      { aspectRatio: 1 }
    ]
  }).toArray();

  console.log(`Found ${posts.length} posts with missing or default 1.0 aspectRatio.`);

  let updatedCount = 0;
  for (const post of posts) {
    const candidateUrl = post.thumbnailUrl || post.imageUrl || (Array.isArray(post.mediaUrls) ? post.mediaUrls[0] : null);
    if (!candidateUrl) continue;

    // Only probe images/thumbnails with sharp
    const isImage = candidateUrl.includes('thumb') || candidateUrl.endsWith('.jpg') || candidateUrl.endsWith('.jpeg') || candidateUrl.endsWith('.png') || candidateUrl.endsWith('.webp');
    if (isImage) {
      const ratio = await probeImageRatio(candidateUrl);
      if (ratio && Math.abs(ratio - 1) > 0.01) {
        await Post.updateOne({ _id: post._id }, { $set: { aspectRatio: Number(ratio.toFixed(4)) } });
        console.log(`Updated post ${post._id} aspectRatio -> ${ratio.toFixed(4)}`);
        updatedCount++;
      }
    }
  }

  console.log(`Done! Updated ${updatedCount} posts.`);
  await mongoose.disconnect();
}

run().catch((err) => {
  console.error('Migration error:', err);
  process.exit(1);
});
