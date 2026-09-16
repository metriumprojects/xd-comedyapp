import { BACKEND_URL, DEFAULT_AVATAR_URL } from '../api';

const CDN_URL = process.env.EXPO_PUBLIC_MEDIA_CDN_URL 
  ? process.env.EXPO_PUBLIC_MEDIA_CDN_URL.trim().replace(/\/+$/, '') 
  : '';

/**
 * Rewrites raw AWS S3 URLs to CloudFront CDN URLs if CDN is configured.
 */
export const getCdnUrl = (rawUrl: string): string => {
  if (!rawUrl || !CDN_URL) return rawUrl;

  // Match virtual-hosted style: https://bucket-name.s3.region.amazonaws.com/key
  const virtualHostMatch = rawUrl.match(/^https?:\/\/[a-zA-Z0-9.\-_]+\.s3[.-][a-zA-Z0-9\-_]*\.amazonaws\.com\/(.+)$/);
  if (virtualHostMatch && virtualHostMatch[1]) {
    return `${CDN_URL}/${virtualHostMatch[1]}`;
  }

  // Match path style: https://s3.region.amazonaws.com/bucket-name/key
  const pathStyleMatch = rawUrl.match(/^https?:\/\/s3[.-][a-zA-Z0-9\-_]*\.amazonaws\.com\/[^\/]+\/(.+)$/);
  if (pathStyleMatch && pathStyleMatch[1]) {
    return `${CDN_URL}/${pathStyleMatch[1]}`;
  }

  return rawUrl;
};

/**
 * Normalizes a media URL to ensure it has the correct protocol and base URL.
 * Handles Cloudinary, S3 CDN mapping, local backend paths, and various protocols.
 */
export const normalizeMediaUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const lower = trimmed.toLowerCase();
  
  // Handle already valid or special protocols
  if (
    lower.startsWith('http://') || 
    lower.startsWith('https://')
  ) {
    return getCdnUrl(trimmed);
  }
  if (
    lower.startsWith('data:') || 
    lower.startsWith('file:') || 
    lower.startsWith('ph:')
  ) {
    return trimmed;
  }

  // Handle protocol-relative URLs
  if (trimmed.startsWith('//')) {
    return getCdnUrl(`https:${trimmed}`);
  }

  // Handle Cloudinary specific cases if they don't have protocol
  if (lower.includes('cloudinary.com')) {
    return `https://${trimmed.replace(/^\/+/, '')}`;
  }

  // Handle local backend paths
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return `${BACKEND_URL}${cleanPath}`;
};

/**
 * Specifically normalizes user avatars, falling back to a default if needed.
 */
export const normalizeAvatarUrl = (url: string | null | undefined): string => {
  const normalized = normalizeMediaUrl(url);
  return normalized || DEFAULT_AVATAR_URL;
};

/**
 * Checks if a URL points to a video file.
 */
export const isVideoUrl = (url: string | null | undefined): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return (
    lower.endsWith('.mp4') || 
    lower.endsWith('.mov') || 
    lower.endsWith('.avi') || 
    lower.endsWith('.mkv') ||
    lower.includes('video/upload') || // Cloudinary video pattern
    lower.includes('.m4v')
  );
};

/**
 * Resolves a media URL and applies performance optimization transformations (Cloudinary, etc.)
 */
export const getOptimizedMediaUrl = (url: string | null | undefined): string => {
  if (!url) return '';
  const normalized = normalizeMediaUrl(url);

  // If it's a Cloudinary URL, apply optimization parameters
  if (normalized.includes('cloudinary.com') && normalized.includes('/upload/') && !normalized.includes('/q_')) {
    const isVideo = isVideoUrl(normalized);
    if (isVideo) {
      // If the video already ends with .mp4 (case insensitive), bypass dynamic on-the-fly Cloudinary
      // transcoding entirely to guarantee near-instantaneous streaming starts (no transcoding lag).
      if (normalized.toLowerCase().endsWith('.mp4')) {
        return normalized;
      }
      // For other video formats (e.g. .mov), transcode to standard H.264
      return normalized.replace('/upload/', '/upload/q_auto:eco,vc_h264/');
    } else {
      // For images, apply quality auto and auto format negotiation
      return normalized.replace('/upload/', '/upload/q_auto:best,f_auto/');
    }
  }

  return normalized;
};

/**
 * Resolves a video URL according to quality preference ('360p' for fast start / low bandwidth, '720p' or 'auto' for standard).
 */
export const getVideoQualityUrl = (
  url: string | null | undefined,
  quality: 'auto' | '360p' | '720p' = 'auto'
): string => {
  if (!url) return '';
  const optimized = getOptimizedMediaUrl(url);
  if (quality === '360p' && isVideoUrl(optimized)) {
    if (optimized.includes('_360p.mp4')) return optimized;
    return optimized.replace(/\.mp4($|\?)/i, '_360p.mp4$1');
  }
  return optimized;
};
