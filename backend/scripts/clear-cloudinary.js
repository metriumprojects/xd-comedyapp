#!/usr/bin/env node

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

async function deleteAllCloudinaryResources() {
  try {
    console.log('🔄 Connecting to Cloudinary...');
    console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);

    let totalDeleted = 0;
    const resourceTypes = ['image', 'video', 'raw'];

    for (const type of resourceTypes) {
      console.log(`\n🧹 Processing resource type: ${type}`);
      let hasMore = true;
      let nextCursor = null;

      while (hasMore) {
        console.log(`📦 Fetching ${type} resources from Cloudinary...`);
        
        const options = {
          max_results: 500,
          resource_type: type
        };
        
        if (nextCursor) {
          options.next_cursor = nextCursor;
        }

        const result = await cloudinary.api.resources(options);
        
        console.log(`Found ${result.resources.length} ${type} resources`);

        // Delete each resource
        for (const resource of result.resources) {
          try {
            console.log(`Deleting: ${resource.public_id} (${type})`);
            await cloudinary.uploader.destroy(resource.public_id, { resource_type: type });
            totalDeleted++;
            console.log(`✅ Deleted: ${resource.public_id}`);
          } catch (err) {
            console.error(`❌ Error deleting ${resource.public_id}:`, err.message);
          }
        }

        // Check if there are more resources
        if (result.next_cursor) {
          nextCursor = result.next_cursor;
        } else {
          hasMore = false;
        }
      }
    }

    console.log('\n🎉 Cloudinary cleanup complete!');
    console.log(`✅ Total deleted: ${totalDeleted} resources`);
    console.log('Cloudinary is now completely empty!\n');

    process.exit(0);
  } catch (err) {
    console.error('❌ Error cleaning Cloudinary:', err.message);
    process.exit(1);
  }
}

deleteAllCloudinaryResources();

