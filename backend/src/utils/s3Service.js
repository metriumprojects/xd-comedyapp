const { S3Client } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const logger = require('./logger');

// Configure fluent-ffmpeg to use the static binary path
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
} else {
  logger.warn('⚠️ ffmpeg-static path was not found. Video thumbnail extraction might fail.');
}

// Instantiate AWS S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

/**
 * Upload a Buffer or file path to AWS S3 using lib-storage parallel upload
 * @param {Buffer|string} bufferOrPath - File buffer or local file path
 * @param {string} key - S3 object path key
 * @param {string} contentType - MIME content type of the file
 * @returns {Promise<string>} Full S3 URL of the uploaded resource
 */
async function uploadBufferToS3(bufferOrPath, key, contentType) {
  if (!process.env.AWS_S3_BUCKET_NAME) {
    throw new Error('AWS_S3_BUCKET_NAME is not defined in backend environment variables.');
  }

  const fsNode = require('fs');
  const body = typeof bufferOrPath === 'string'
    ? fsNode.createReadStream(bufferOrPath)
    : bufferOrPath;

  const upload = new Upload({
    client: s3Client,
    params: {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000, immutable',
    },
  });

  const result = await upload.done();
  
  // If CDN is configured, return the CDN-mapped URL instead of raw S3
  if (process.env.MEDIA_CDN_URL) {
    const cleanCDN = process.env.MEDIA_CDN_URL.endsWith('/') 
      ? process.env.MEDIA_CDN_URL.slice(0, -1) 
      : process.env.MEDIA_CDN_URL;
    return `${cleanCDN}/${key}`;
  }

  // AWS S3 standard public URL
  return result.Location || `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
}

/**
 * Optimize and resize image buffers before uploading to S3
 * @param {Buffer|string} bufferOrPath - Original image buffer or file path
 * @param {string} context - Upload context ('avatar', 'post', 'story', etc.)
 * @returns {Promise<Buffer>} Optimized image buffer
 */
async function optimizeImage(bufferOrPath, context) {
  try {
    let pipeline = sharp(bufferOrPath).rotate();
    
    if (context === 'avatar') {
      // User avatars should be square-cropped and resized to 400x400
      pipeline = pipeline.resize(400, 400, { fit: 'cover' });
    } else {
      // Feed posts/stories: Resize to max width 1200px (standard size) to keep loading times fast and costs low
      pipeline = pipeline.resize(1200, null, { withoutEnlargement: true });
    }

    // Convert to WebP with quality 80 for modern compression and low file size
    return await pipeline.webp({ quality: 80 }).toBuffer();
  } catch (err) {
    logger.warn(`Image optimization failed, returning original input: ${err.message}`);
    return Buffer.isBuffer(bufferOrPath) ? bufferOrPath : await fs.readFile(bufferOrPath);
  }
}

/**
 * Extract a single screenshot frame from a video buffer/path to use as thumbnail
 * @param {Buffer|string} videoBufferOrPath - Video file buffer or file path
 * @returns {Promise<Buffer>} JPEG image buffer of the extracted frame
 */
async function generateVideoThumbnail(videoBufferOrPath) {
  const tempDir = os.tmpdir();
  const randomSuffix = Math.random().toString(36).substring(7);
  const tempThumbPath = path.join(tempDir, `temp_thumb_${randomSuffix}.jpg`);

  let inputPath = videoBufferOrPath;
  let isTempInput = false;

  if (Buffer.isBuffer(videoBufferOrPath)) {
    const tempVideoPath = path.join(tempDir, `temp_video_${randomSuffix}.mp4`);
    await fs.writeFile(tempVideoPath, videoBufferOrPath);
    inputPath = tempVideoPath;
    isTempInput = true;
  }

  try {
    // Extract the frame at the 1 second mark using fluent-ffmpeg
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          count: 1,
          timemarks: ['1'], // extract at 1 second
          filename: path.basename(tempThumbPath),
          folder: path.dirname(tempThumbPath),
          size: '640x?' // maximum width 640px, auto height
        })
        .on('end', resolve)
        .on('error', (err) => {
          reject(err);
        });
    });

    // Read the generated screenshot file
    const thumbBuffer = await fs.readFile(tempThumbPath);
    return thumbBuffer;
  } finally {
    // Clean up temporary files asynchronously
    if (isTempInput) {
      try {
        await fs.unlink(inputPath);
      } catch (_) {}
    }
    try {
      await fs.unlink(tempThumbPath);
    } catch (_) {}
  }
}

/**
 * Compress video into multi-quality variants (720p primary + 360p low-bandwidth)
 * Both variants use H.264/AAC with +faststart flag for instant-play streaming
 * @param {Buffer|string} videoBufferOrPath - Video file buffer or file path
 * @param {string} context - Upload context
 * @returns {Promise<{ buffer720p: Buffer|string, buffer360p: Buffer|string|null }>}
 */
async function compressVideoVariants(videoBufferOrPath, context) {
  if (process.env.SKIP_BACKEND_VIDEO_COMPRESSION === 'true' || process.env.SKIP_BACKEND_VIDEO_COMPRESSION === '1') {
    logger.info(`⚡ Skipping backend video compression (Client-side compression active). Preserving server CPU.`);
    return { buffer720p: videoBufferOrPath, buffer360p: null };
  }

  const tempDir = os.tmpdir();
  const randomSuffix = Math.random().toString(36).substring(7);
  const temp720Path = path.join(tempDir, `temp_720_${randomSuffix}.mp4`);
  const temp360Path = path.join(tempDir, `temp_360_${randomSuffix}.mp4`);

  let inputPath = videoBufferOrPath;
  let isTempInput = false;

  if (Buffer.isBuffer(videoBufferOrPath)) {
    const tempInputPath = path.join(tempDir, `temp_in_${randomSuffix}.mp4`);
    await fs.writeFile(tempInputPath, videoBufferOrPath);
    inputPath = tempInputPath;
    isTempInput = true;
  }

  let buffer720p = videoBufferOrPath;
  let buffer360p = null;

  try {
    // 1. Primary Quality (720p max, high quality H.264 + faststart)
    try {
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-preset veryfast',
            '-crf 26',
            '-movflags +faststart',
            '-vf scale=-2:min(720\\,ih)' // Resize to max 720p height, maintaining aspect ratio
          ])
          .output(temp720Path)
          .on('end', resolve)
          .on('error', (err) => {
            reject(err);
          })
          .run();
      });
      buffer720p = temp720Path;
    } catch (err) {
      logger.warn(`720p compression error: ${err.message}`);
    }

    // 2. Secondary Preview Quality (360p mobile low-data, fast scrub)
    try {
      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions([
            '-preset veryfast',
            '-crf 30',
            '-movflags +faststart',
            '-vf scale=-2:min(360\\,ih)' // Resize to max 360p height
          ])
          .output(temp360Path)
          .on('end', resolve)
          .on('error', (err) => {
            reject(err);
          })
          .run();
      });
      buffer360p = temp360Path;
    } catch (err) {
      logger.warn(`360p compression error: ${err.message}`);
    }

    return { buffer720p, buffer360p };
  } finally {
    if (isTempInput) {
      try {
        await fs.unlink(inputPath);
      } catch (_) {}
    }
  }
}

/**
 * Unified entry point to handle client media uploads and optimization
 * @param {Buffer|string} fileBufferOrPath - Media file buffer or file path
 * @param {string} folder - Upload folder path prefix
 * @param {string} context - Context (e.g. 'avatar', 'post', 'story')
 * @param {string} mediaType - Type of media: 'image', 'video', or 'auto'
 * @param {string} originalName - Original file name for ext identification
 */
async function uploadMedia(fileBufferOrPath, folder, context, mediaType = 'auto', originalName = 'file') {
  const extension = path.extname(originalName) || (mediaType === 'video' ? '.mp4' : '.jpg');
  const randomSuffix = Math.random().toString(36).substring(7);
  // Generate file prefix
  const baseKey = `${folder}/${Date.now()}-${randomSuffix}`;

  let finalBufferOrPath = fileBufferOrPath;
  let finalMediaType = mediaType;
  let width = null;
  let height = null;
  let thumbnailUrl = null;
  let url360p = null;

  // 1. Handle Image Optimization & Dimension Parsing
  if (mediaType === 'image' || mediaType === 'auto') {
    try {
      const metadata = await sharp(fileBufferOrPath).metadata();
      if (metadata.format) {
        finalMediaType = 'image';
        finalBufferOrPath = await optimizeImage(fileBufferOrPath, context);
        // Extract size parameters from optimized buffer
        const optimizedMeta = await sharp(finalBufferOrPath).metadata();
        width = optimizedMeta.width || null;
        height = optimizedMeta.height || null;
      }
    } catch (err) {
      if (mediaType === 'image') {
        throw new Error(`Failed to parse image file: ${err.message}`);
      }
      // If it fails auto-detection, we fall through and check other types
    }
  }

  // 2. Handle Video Thumbnailing & Multi-Quality Compression
  if (finalMediaType === 'video' || (mediaType === 'auto' && finalMediaType !== 'image')) {
    finalMediaType = 'video';
    try {
      const thumbBuffer = await generateVideoThumbnail(fileBufferOrPath);
      // Automatically detect real dimensions from the extracted video frame!
      const thumbMeta = await sharp(thumbBuffer).metadata();
      width = thumbMeta.width || null;
      height = thumbMeta.height || null;

      const thumbKey = `${baseKey}-thumb.jpg`;
      thumbnailUrl = await uploadBufferToS3(thumbBuffer, thumbKey, 'image/jpeg');
    } catch (err) {
      logger.warn(`Could not generate thumbnail for video: ${err.message}`);
    }

    try {
      logger.info('🎬 Compressing video (720p & 360p) before uploading to S3...');
      const { buffer720p, buffer360p } = await compressVideoVariants(fileBufferOrPath, context);
      finalBufferOrPath = buffer720p;

      // Upload low-bandwidth 360p variant if created
      if (buffer360p) {
        const previewKey = `${baseKey}_360p.mp4`;
        url360p = await uploadBufferToS3(buffer360p, previewKey, 'video/mp4');
        if (typeof buffer360p === 'string' && buffer360p !== fileBufferOrPath) {
          try { await fs.unlink(buffer360p); } catch (_) {}
        }
      }
      logger.info('✅ Video multi-resolution compression complete');
    } catch (err) {
      logger.warn(`Video compression failed, using original file: ${err.message}`);
    }
  }

  // 3. Upload Main File
  const contentType = finalMediaType === 'image' 
    ? 'image/webp' 
    : (finalMediaType === 'video' ? 'video/mp4' : 'application/octet-stream');
  
  const mainKey = `${baseKey}${finalMediaType === 'image' ? '.webp' : extension}`;
  const s3Url = await uploadBufferToS3(finalBufferOrPath, mainKey, contentType);

  // Clean up compressed temp file if created
  if (typeof finalBufferOrPath === 'string' && finalBufferOrPath !== fileBufferOrPath) {
    try { await fs.unlink(finalBufferOrPath); } catch (_) {}
  }

  return {
    url: s3Url,
    secure_url: s3Url, // For backwards compatibility
    url360p,
    variants: {
      '720p': s3Url,
      ...(url360p ? { '360p': url360p } : {})
    },
    mediaType: finalMediaType,
    resource_type: finalMediaType, // For backwards compatibility
    width,
    height,
    aspectRatio: width && height ? width / height : 1,
    thumbnailUrl
  };
}

module.exports = {
  uploadBufferToS3,
  uploadMedia
};
