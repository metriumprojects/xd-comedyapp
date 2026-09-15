const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const s3Service = require('../src/utils/s3Service');

// Import model - but since it's a standalone script, we might need to define it if it's not registered
const RegionSchema = new mongoose.Schema({
  name: { type: String, required: true },
  countryCode: { type: String },
  image: { type: String, default: null },
  type: { type: String, enum: ['country', 'region', 'city'], default: 'country' },
  createdAt: { type: Date, default: Date.now },
});

const Region = mongoose.models.Region || mongoose.model('Region', RegionSchema);

const ASSETS_BASE_PATH = path.join(__dirname, '../../client/assets');

const folders = [
  { path: 'countries', type: 'country' },
  { path: 'region', type: 'region' },
  { path: 'cities', type: 'city' },
];

async function uploadToS3(filePath, folderName) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    const result = await s3Service.uploadMedia(fileBuffer, `search_cards/${folderName}`, 'admin', 'image', fileName);
    return result.secure_url;
  } catch (error) {
    console.error(`Upload failed for ${filePath}: ${error.message}`);
    return null;
  }
}
const uploadToCloudinary = uploadToS3;

async function run() {
  try {
    console.log('Connecting to MongoDB...');
    if (!process.env.MONGO_URI) {
        throw new Error('MONGO_URI not found in .env');
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // Clear existing regions to avoid duplicates and ensure fresh data
    // Or just upsert. Let's upsert to be safe.
    
    for (const folder of folders) {
      const dirPath = path.join(ASSETS_BASE_PATH, folder.path);
      if (!fs.existsSync(dirPath)) {
        console.warn(`Directory not found: ${dirPath}`);
        continue;
      }

      const files = fs.readdirSync(dirPath);
      console.log(`\n--- Processing ${files.length} files in ${folder.path} ---`);

      for (const file of files) {
        if (!file.match(/\.(png|jpg|jpeg)$/i)) continue;

        const name = path.parse(file).name;
        const filePath = path.join(dirPath, file);
        
        console.log(`Uploading: ${name}...`);
        const url = await uploadToCloudinary(filePath, folder.path);

        if (url) {
          const updated = await Region.findOneAndUpdate(
            { name, type: folder.type },
            { image: url },
            { upsert: true, new: true }
          );
          console.log(`✅ Success: ${name} -> ${url}`);
        }
      }
    }

    console.log('\nAll assets uploaded and database updated successfully.');
  } catch (error) {
    console.error('\n❌ Fatal Error:', error.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.connection.close();
    }
    process.exit(0);
  }
}

run();
