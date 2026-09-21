'use strict';

const {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  ListPartsCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const logger = require('./logger');
const { toCdnUrl } = require('./cdnUtils');

const PART_SIZE = 8 * 1024 * 1024; // 8MB
const SIGN_TTL_SEC = 30 * 60; // 30 mins

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

function getBucket() {
  const bucket = process.env.AWS_S3_BUCKET_NAME;
  if (!bucket) throw new Error('AWS_S3_BUCKET_NAME is not defined');
  return bucket;
}

function assertOwnedKey(key, userId) {
  const uid = String(userId || '').trim();
  if (!uid) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
  const allowed = [
    `posts/${uid}/`,
    `stories/${uid}/`,
    `media/${uid}/`,
  ];
  const ok = allowed.some((prefix) => String(key || '').startsWith(prefix));
  if (!ok) {
    const err = new Error('Invalid upload key for this user');
    err.statusCode = 403;
    throw err;
  }
}

function buildObjectKey(userId, context, fileName) {
  const ctx = context === 'story' ? 'stories' : context === 'media' ? 'media' : 'posts';
  const safeName = String(fileName || 'video.mp4')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);
  const ext = /\.[a-z0-9]+$/i.test(safeName) ? '' : '.mp4';
  const suffix = Math.random().toString(36).slice(2, 9);
  return `${ctx}/${userId}/${Date.now()}-${suffix}-${safeName}${ext}`;
}

async function initMultipartUpload({ userId, mediaType, fileName, contentType, context }) {
  const bucket = getBucket();
  const key = buildObjectKey(userId, context || 'post', fileName);
  const type = contentType || (mediaType === 'video' ? 'video/mp4' : 'application/octet-stream');

  const out = await s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: type,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return {
    uploadId: out.UploadId,
    key,
    partSize: PART_SIZE,
    bucket,
    contentType: type,
  };
}

async function signUploadPart({ userId, uploadId, key, partNumber }) {
  assertOwnedKey(key, userId);
  const bucket = getBucket();
  const pn = Number(partNumber);
  if (!Number.isFinite(pn) || pn < 1 || pn > 10000) {
    const err = new Error('Invalid partNumber');
    err.statusCode = 400;
    throw err;
  }

  const command = new UploadPartCommand({
    Bucket: bucket,
    Key: key,
    UploadId: uploadId,
    PartNumber: pn,
  });

  const url = await getSignedUrl(s3Client, command, { expiresIn: SIGN_TTL_SEC });
  return { url, partNumber: pn, expiresIn: SIGN_TTL_SEC };
}

async function listUploadedParts({ userId, uploadId, key }) {
  assertOwnedKey(key, userId);
  const bucket = getBucket();
  const parts = [];
  let marker;

  // Paginate ListParts
  for (;;) {
    const out = await s3Client.send(
      new ListPartsCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumberMarker: marker,
      })
    );
    for (const p of out.Parts || []) {
      parts.push({
        PartNumber: p.PartNumber,
        ETag: p.ETag,
        Size: p.Size,
      });
    }
    if (!out.IsTruncated) break;
    marker = out.NextPartNumberMarker;
  }

  return { parts };
}

async function completeMultipartUpload({ userId, uploadId, key, parts, mediaType, context }) {
  assertOwnedKey(key, userId);
  const bucket = getBucket();

  if (!Array.isArray(parts) || parts.length === 0) {
    const err = new Error('parts required');
    err.statusCode = 400;
    throw err;
  }

  const normalized = parts
    .map((p) => {
      const raw = String(p.ETag || p.etag || '').trim();
      const PartNumber = Number(p.PartNumber || p.partNumber);
      if (!raw || !Number.isFinite(PartNumber)) return null;
      const ETag = raw.startsWith('"') ? raw : `"${raw.replace(/"/g, '')}"`;
      return { ETag, PartNumber };
    })
    .filter(Boolean)
    .sort((a, b) => a.PartNumber - b.PartNumber);

  await s3Client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: normalized },
    })
  );

  const region = process.env.AWS_REGION || 'us-east-1';
  const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  const secureUrl = toCdnUrl(s3Url);

  let thumbnailUrl = null;
  let width;
  let height;

  // Generate thumbnail for video
  if (mediaType === 'video' || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(key)) {
    try {
      const getCmd = new GetObjectCommand({ Bucket: bucket, Key: key });
      const signedGet = await getSignedUrl(s3Client, getCmd, { expiresIn: 600 });
      const s3Service = require('./s3Service');
      if (typeof s3Service.generateVideoThumbnail === 'function') {
        const thumbBuffer = await s3Service.generateVideoThumbnail(signedGet);
        const sharp = require('sharp');
        let optimizedThumb = thumbBuffer;
        try {
          const meta = await sharp(thumbBuffer).metadata();
          width = meta.width || undefined;
          height = meta.height || undefined;
          optimizedThumb = await sharp(thumbBuffer)
            .resize(480, null, { withoutEnlargement: true })
            .webp({ quality: 72 })
            .toBuffer();
        } catch (_) {}
        const thumbKey = key.replace(/\.[^.]+$/, '') + '-thumb.webp';
        thumbnailUrl = await s3Service.uploadBufferToS3(optimizedThumb, thumbKey, 'image/webp');
      }
    } catch (err) {
      logger.warn('[multipart] thumbnail after complete skipped: %s', err.message);
    }
  }

  return {
    secure_url: secureUrl,
    url: secureUrl,
    feedUrl: secureUrl,
    thumbnailUrl: thumbnailUrl || undefined,
    mediaType: mediaType || 'video',
    resource_type: mediaType || 'video',
    width,
    height,
    aspectRatio: width && height ? width / height : undefined,
    key,
    context: context || 'post',
  };
}

async function abortMultipartUpload({ userId, uploadId, key }) {
  assertOwnedKey(key, userId);
  const bucket = getBucket();
  await s3Client.send(
    new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    })
  );
  return { aborted: true };
}

module.exports = {
  PART_SIZE,
  initMultipartUpload,
  signUploadPart,
  listUploadedParts,
  completeMultipartUpload,
  abortMultipartUpload,
  assertOwnedKey,
};
