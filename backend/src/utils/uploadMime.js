"use strict";

const path = require("path");

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
]);

const EXT_MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.m4v': 'video/x-m4v',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.wav': 'audio/wav',
};

function sniffMime(buf) {
  if (!buf || buf.length < 2) return null;
  // JPEG SOI: 0xFF, 0xD8
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  // PNG signature: 0x89, 'PNG'
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  // GIF: 'GIF'
  if (buf.length >= 3 && buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return 'image/gif';
  // WEBP: RIFF....WEBP
  if (buf.length >= 12 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp';
  }
  // ISO base media file format (MP4, QuickTime, HEIC)
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12);
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1'].some((b) => brand.startsWith(b.trim()) || brand.includes(b.trim()))) {
      return 'image/heic';
    }
    if (['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V ', 'MSNV'].some((b) => brand.startsWith(b.trim()) || brand.includes(b.trim()))) {
      return 'video/mp4';
    }
    if (brand.startsWith('qt') || brand === 'qt  ') return 'video/quicktime';
    return 'video/mp4';
  }
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return 'video/webm';
  }
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] === 0xfb || buf[1] === 0xf3 || buf[1] === 0xf2)) {
    return 'audio/mpeg';
  }
  if (buf.length >= 3 && buf.toString('ascii', 0, 3) === 'ID3') return 'audio/mpeg';
  return null;
}

function normalizeClientMime(mimetype, originalname) {
  const raw = String(mimetype || '')
    .toLowerCase()
    .trim();
  if (ALLOWED_MIME.has(raw)) return raw;
  const ext = path.extname(String(originalname || '')).toLowerCase();
  return EXT_MIME[ext] || null;
}

function assertAllowedUpload(file, buffer) {
  if (!file) {
    const err = new Error('No file provided');
    err.statusCode = 400;
    throw err;
  }
  const clientMime = normalizeClientMime(file.mimetype, file.originalname);
  const sniffed = buffer ? sniffMime(buffer) : null;
  // Trust sniffed magic bytes first; fallback to normalized client MIME or extension
  let resolved = sniffed || clientMime;
  if (!resolved) {
    const ext = path.extname(String(file.originalname || '')).toLowerCase();
    resolved = EXT_MIME[ext] || null;
  }
  if (!resolved || !ALLOWED_MIME.has(resolved)) {
    const err = new Error('Unsupported media type: ' + (file.mimetype || file.originalname || 'unknown'));
    err.statusCode = 415;
    throw err;
  }
  return resolved;
}

function multerFileFilter(_req, file, cb) {
  const mime = normalizeClientMime(file.mimetype, file.originalname);
  if (mime && ALLOWED_MIME.has(mime)) {
    return cb(null, true);
  }
  const raw = String(file.mimetype || '').toLowerCase().trim();
  // Allow generic binary or form payloads through to disk/memory where magic bytes can be sniffed
  if (!raw || raw === 'application/octet-stream' || raw === 'binary/octet-stream' || raw.startsWith('multipart/')) {
    return cb(null, true);
  }
  // Check extension fallback
  const ext = path.extname(String(file.originalname || '')).toLowerCase();
  if (EXT_MIME[ext] && ALLOWED_MIME.has(EXT_MIME[ext])) {
    return cb(null, true);
  }
  return cb(new Error('Unsupported file type: ' + (file.mimetype || file.originalname)));
}

module.exports = {
  ALLOWED_MIME,
  sniffMime,
  normalizeClientMime,
  assertAllowedUpload,
  multerFileFilter
};
