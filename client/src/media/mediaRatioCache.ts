import { Image } from 'react-native';
import { isVideoUrl } from '@/lib/utils/media';
import { getVideoThumbnailUrl } from '@/lib/imageHelpers';

// Global singleton map storing (normalized URL -> aspect ratio)
export const mediaRatioCache = new Map<string, number>();

function normalizeKey(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  return url.trim().split('?')[0].toLowerCase();
}

/**
 * Extracts aspect ratio (w/h) from Cloudinary transformation params or URL patterns if present.
 * e.g. /w_1080,h_1920/ or /ar_9:16/ or /ar_4:5/
 */
export function extractRatioFromUrl(url?: string | null): number | null {
  if (!url || typeof url !== 'string') return null;

  // Check for ar_X:Y
  const arMatch = url.match(/ar_([0-9.]+):([0-9.]+)/i);
  if (arMatch) {
    const num = parseFloat(arMatch[1]);
    const den = parseFloat(arMatch[2]);
    if (num > 0 && den > 0) return num / den;
  }

  // Check for w_XXX,h_YYY or h_YYY,w_XXX
  const whMatch = url.match(/(?:w_(\d+)[,_]h_(\d+)|h_(\d+)[,_]w_(\d+))/i);
  if (whMatch) {
    const w = parseInt(whMatch[1] || whMatch[4], 10);
    const h = parseInt(whMatch[2] || whMatch[3], 10);
    if (w > 0 && h > 0) return w / h;
  }

  return null;
}

/**
 * Synchronously retrieves cached aspect ratio for given URL(s).
 * Tries direct lookup, normalized lookup, and URL parameter extraction.
 */
export function getMediaRatio(...urls: (string | null | undefined)[]): number | null {
  for (const u of urls) {
    if (!u || typeof u !== 'string') continue;
    if (mediaRatioCache.has(u)) {
      const r = mediaRatioCache.get(u)!;
      if (r > 0) return r;
    }
    const norm = normalizeKey(u);
    if (norm && mediaRatioCache.has(norm)) {
      const r = mediaRatioCache.get(norm)!;
      if (r > 0) return r;
    }
    const fromUrl = extractRatioFromUrl(u);
    if (fromUrl && fromUrl > 0) {
      setMediaRatio(u, fromUrl);
      return fromUrl;
    }
  }
  return null;
}

/**
 * Stores aspect ratio for a media URL and its normalized variants.
 */
export function setMediaRatio(url?: string | null, ratio?: number | null): void {
  if (!url || typeof url !== 'string' || !ratio || ratio <= 0) return;
  mediaRatioCache.set(url, ratio);
  const norm = normalizeKey(url);
  if (norm) mediaRatioCache.set(norm, ratio);
}

const activeProbes = new Set<string>();

/**
 * Asynchronously probes image/thumbnail dimensions via Image.getSize and caches the result.
 */
export function probeMediaRatio(thumbnailUrl?: string | null, mediaUrl?: string | null): Promise<number | null> {
  const target = thumbnailUrl || mediaUrl;
  if (!target || typeof target !== 'string' || !target.startsWith('http')) {
    return Promise.resolve(null);
  }

  const existing = getMediaRatio(target, mediaUrl);
  if (existing) return Promise.resolve(existing);

  const norm = normalizeKey(target);
  if (activeProbes.has(norm)) {
    return Promise.resolve(null);
  }
  activeProbes.add(norm);

  return new Promise<number | null>((resolve) => {
    Image.getSize(
      target,
      (w, h) => {
        activeProbes.delete(norm);
        if (w > 0 && h > 0) {
          const ratio = w / h;
          setMediaRatio(target, ratio);
          if (mediaUrl) setMediaRatio(mediaUrl, ratio);
          resolve(ratio);
        } else {
          resolve(null);
        }
      },
      () => {
        activeProbes.delete(norm);
        resolve(null);
      }
    );
  });
}

/**
 * Batch pre-probes aspect ratios for an array of posts.
 * Runs silently in the background (e.g. when profile grid or post list mounts).
 */
export function probeBatchPostRatios(posts: any[]): void {
  if (!Array.isArray(posts) || posts.length === 0) return;

  posts.forEach((p) => {
    if (!p) return;

    // Check if post already has an explicit non-1.0 aspectRatio stored
    if (typeof p.aspectRatio === 'number' && p.aspectRatio > 0 && p.aspectRatio !== 1) {
      const vid = p?.media?.[0]?.url || p?.mediaUrls?.[0] || p?.imageUrl || p?.mediaUrl;
      const thumb = p?.thumbnailUrl || p?.imageUrl || p?.gridThumb;
      if (vid) setMediaRatio(vid, p.aspectRatio);
      if (thumb) setMediaRatio(thumb, p.aspectRatio);
      return;
    }

    // Otherwise probe thumbnail
    const rawMedia = Array.isArray(p.media) && p.media.length > 0 ? p.media[0] : null;
    const vidUrl = rawMedia?.url || p?.mediaUrls?.[0] || p?.mediaUrl || p?.imageUrl || '';
    const isVid = rawMedia?.type === 'video' || isVideoUrl(vidUrl);
    const thumbUrl = rawMedia?.thumbnailUrl || p?.thumbnailUrl || p?.imageUrl || p?.gridThumb || (isVid && vidUrl ? getVideoThumbnailUrl(vidUrl) : '');

    if (thumbUrl && typeof thumbUrl === 'string' && thumbUrl.startsWith('http')) {
      probeMediaRatio(thumbUrl, vidUrl).catch(() => {});
    }
  });
}
