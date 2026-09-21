const express = require('express');
const router = express.Router();
const multer = require('multer');
const os = require('os');
const fsPromise = require('fs').promises;
const { verifyToken } = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const s3Service = require('../utils/s3Service');
const { uploadLimiter } = require('../middleware/rateLimiters');
const { multerFileFilter, assertAllowedUpload } = require('../utils/uploadMime');
const s3Multipart = require('../utils/s3MultipartService');

// Apply upload rate limiter across all upload routes
router.use(uploadLimiter);

// Configure multer for memory storage with 15MB limit (avatars)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: multerFileFilter,
});

// Configure disk storage for large files (posts, stories, general upload)
const diskUpload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: multerFileFilter,
});

async function validateUploadedFile(file) {
  if (!file) return;
  let buf = file.buffer;
  if (!buf && file.path) {
    const fd = await fsPromise.open(file.path, 'r');
    try {
      buf = Buffer.alloc(64);
      await fd.read(buf, 0, 64, 0);
    } finally {
      await fd.close();
    }
  }
  const resolved = assertAllowedUpload(file, buf);
  file.mimetype = resolved;
}

// Global Multer Error Handler
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    logger.warn('Multer Error: %s', err.message);
    return res.status(400).json({ success: false, error: `Upload error: ${err.message}` });
  }
  if (err && (err.statusCode === 415 || /Unsupported|does not match/i.test(err.message || ''))) {
    return res.status(err.statusCode || 415).json({ success: false, error: err.message });
  }
  next(err);
};

// POST /api/upload/avatar - Upload user avatar
router.post('/avatar', verifyToken, upload.single('file'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file provided' });
    await validateUploadedFile(req.file);
    const userId = req.userId || 'anonymous';
    const result = await s3Service.uploadMedia(req.file.buffer, `avatars/${userId}`, 'avatar', 'image', req.file.originalname || 'avatar.jpg');
    res.json({ success: true, url: result.secure_url });
  } catch (err) {
    if (err.statusCode === 415) return res.status(415).json({ success: false, error: err.message });
    logger.error('Error uploading avatar: %s', err.message);
    res.status(500).json({ success: false, error: `Upload failed: ${err.message}` });
  }
});

// POST /api/upload/post - Upload post media
router.post('/post', verifyToken, diskUpload.single('file'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file provided' });
    await validateUploadedFile(req.file);
    const userId = req.userId || 'anonymous';
    const mediaType = req.body.mediaType || 'auto';
    
    const result = await s3Service.uploadMedia(req.file.path, `posts/${userId}`, 'post', mediaType, req.file.originalname || 'file');
    
    res.json({ 
      success: true, 
      url: result.secure_url, 
      feedUrl: result.feedUrl || result.secure_url,
      variants: result.variants,
      mediaType: result.resource_type,
      width: result.width,
      height: result.height,
      aspectRatio: result.width && result.height ? result.width / result.height : (result.aspectRatio || undefined),
      thumbnailUrl: result.thumbnailUrl
    });
  } catch (err) {
    logger.error('Error uploading post media: %s', err.message);
    res.status(500).json({ success: false, error: `Upload failed: ${err.message}` });
  } finally {
    if (req.file && req.file.path) {
      try { await fsPromise.unlink(req.file.path); } catch (_) {}
    }
  }
});

// POST /api/upload/story - Upload story media
router.post('/story', verifyToken, diskUpload.single('file'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file provided' });
    await validateUploadedFile(req.file);
    const userId = req.userId || 'anonymous';
    const mediaType = req.body.mediaType || 'auto';

    const result = await s3Service.uploadMedia(req.file.path, `stories/${userId}`, 'story', mediaType, req.file.originalname || 'file');

    res.json({ 
      success: true, 
      url: result.secure_url, 
      feedUrl: result.feedUrl || result.secure_url,
      variants: result.variants,
      mediaType: result.resource_type, 
      thumbnailUrl: result.thumbnailUrl,
      aspectRatio: result.aspectRatio
    });
  } catch (err) {
    logger.error('Error uploading story media: %s', err.message);
    res.status(500).json({ success: false, error: `Upload failed: ${err.message}` });
  } finally {
    if (req.file && req.file.path) {
      try { await fsPromise.unlink(req.file.path); } catch (_) {}
    }
  }
});

// Alias route for industrial standard binary upload
router.post('/upload', verifyToken, diskUpload.single('file'), handleMulterError, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No binary file provided. Use multipart/form-data.' });
    await validateUploadedFile(req.file);
    
    const userId = req.userId || 'anonymous';
    const folder = req.body.path || `media/${userId}`;

    const result = await s3Service.uploadMedia(req.file.path, folder, 'media', req.body.mediaType || 'auto', req.file.originalname || 'file');

    res.json({ 
      success: true, 
      url: result.secure_url, 
      feedUrl: result.feedUrl || result.secure_url,
      thumbnailUrl: result.thumbnailUrl,
      aspectRatio: result.aspectRatio,
      data: { 
        url: result.secure_url,
        feedUrl: result.feedUrl || result.secure_url,
        variants: result.variants,
        thumbnailUrl: result.thumbnailUrl,
        width: result.width,
        height: result.height,
        aspectRatio: result.width && result.height ? result.width / result.height : (result.aspectRatio || undefined)
      } 
    });
  } catch (err) {
    logger.error('Error in industrial upload: %s', err.message);
    res.status(500).json({ success: false, error: `Upload failed: ${err.message}` });
  } finally {
    if (req.file && req.file.path) {
      try { await fsPromise.unlink(req.file.path); } catch (_) {}
    }
  }
});

// ─── S3 Multipart (Chunked Video Uploads) ─────────────────────────────
router.post('/multipart/init', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { mediaType, fileName, contentType, size, context } = req.body || {};
    if (!mediaType && !contentType) {
      return res.status(400).json({ success: false, error: 'mediaType or contentType required' });
    }
    const result = await s3Multipart.initMultipartUpload({
      userId,
      mediaType: mediaType || 'video',
      fileName: fileName || 'video.mp4',
      contentType: contentType || 'video/mp4',
      context: context === 'story' ? 'story' : context === 'media' ? 'media' : 'post',
      size: Number(size) || 0,
    });
    res.json({ success: true, ...result, data: result });
  } catch (err) {
    logger.error('multipart init: %s', err.message);
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

router.post('/multipart/sign-part', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { uploadId, key, partNumber } = req.body || {};
    if (!uploadId || !key || !partNumber) {
      return res.status(400).json({ success: false, error: 'uploadId, key, partNumber required' });
    }
    const result = await s3Multipart.signUploadPart({ userId, uploadId, key, partNumber });
    res.json({ success: true, ...result, data: result });
  } catch (err) {
    logger.error('multipart sign-part: %s', err.message);
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

router.post('/multipart/list-parts', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { uploadId, key } = req.body || {};
    if (!uploadId || !key) {
      return res.status(400).json({ success: false, error: 'uploadId and key required' });
    }
    const result = await s3Multipart.listUploadedParts({ userId, uploadId, key });
    res.json({ success: true, ...result, data: result });
  } catch (err) {
    logger.error('multipart list-parts: %s', err.message);
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

router.post('/multipart/complete', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { uploadId, key, parts, mediaType, context } = req.body || {};
    if (!uploadId || !key || !Array.isArray(parts)) {
      return res.status(400).json({ success: false, error: 'uploadId, key, parts required' });
    }
    const result = await s3Multipart.completeMultipartUpload({
      userId,
      uploadId,
      key,
      parts,
      mediaType: mediaType || 'video',
      context: context || 'post',
    });
    res.json({
      success: true,
      url: result.secure_url,
      feedUrl: result.feedUrl || result.secure_url,
      thumbnailUrl: result.thumbnailUrl,
      mediaType: result.mediaType,
      width: result.width,
      height: result.height,
      aspectRatio: result.aspectRatio,
      data: result,
    });
  } catch (err) {
    logger.error('multipart complete: %s', err.message);
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

router.post('/multipart/abort', verifyToken, async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const { uploadId, key } = req.body || {};
    if (!uploadId || !key) {
      return res.status(400).json({ success: false, error: 'uploadId and key required' });
    }
    const result = await s3Multipart.abortMultipartUpload({ userId, uploadId, key });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('multipart abort: %s', err.message);
    res.status(err.statusCode || 500).json({ success: false, error: err.message });
  }
});

module.exports = router;

