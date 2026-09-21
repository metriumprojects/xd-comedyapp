/**
 * Story media local-first helpers (no UI). Used by StoriesViewer and StoriesRow.
 */
import {
  pinMedia,
  pinMediaMany,
  resolveLocalFirst,
  resolveLocalFirstSync,
} from '@/src/media/mediaMirror';
import { getLocalCachePath, isLocallyCached, prefetchVideo, preloadVideos, registerLocalVideoCache } from '@/src/media/videoCache';

export function resolveStoryMediaSync(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  return resolveLocalFirstSync(url) || (isLocallyCached(url) ? getLocalCachePath(url) : null);
}

export async function resolveStoryMedia(url?: string | null): Promise<string> {
  if (!url) return '';
  return resolveLocalFirst(url);
}

export function pinStoryMedia(url?: string | null): Promise<string | null> {
  return pinMedia(url);
}

export function pinStoryMediaMany(urls: Array<string | null | undefined>, limit = 4): Promise<void> {
  return pinMediaMany(urls, limit);
}

export function prefetchStoryVideo(url?: string | null): Promise<string | null> {
  if (!url || !String(url).startsWith('http')) return Promise.resolve(null);
  return prefetchVideo(String(url));
}

export function preloadStoryVideos(urls: string[], limit = 2): Promise<void> {
  return preloadVideos(urls, limit);
}

export function registerStoryVideoCache(remoteUrl?: string | null, localFilePath?: string | null): Promise<void> {
  if (!remoteUrl || !localFilePath) return Promise.resolve();
  return registerLocalVideoCache(remoteUrl, localFilePath);
}

export { getLocalCachePath, isLocallyCached };
