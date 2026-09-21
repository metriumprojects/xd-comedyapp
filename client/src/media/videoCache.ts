import * as FileSystem from 'expo-file-system';
import CryptoJS from 'crypto-js';
import { getCdnUrl } from '@/lib/api';

const CACHE_FOLDER = FileSystem.cacheDirectory + 'video_cache/';
const MAX_CACHE_BYTES = 200 * 1024 * 1024; // 200 MB hard limit

function normalizeVideoUrl(url: string): string {
  if (!url || !url.startsWith('http')) return url;
  return getCdnUrl(url) || url;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function ensureCacheFolderExists() {
  const info = await FileSystem.getInfoAsync(CACHE_FOLDER);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_FOLDER, { intermediates: true });
  }
}

export function getLocalCachePath(url: string): string {
  const normalized = normalizeVideoUrl(url);
  const hash = CryptoJS.SHA1(normalized).toString();
  const ext = normalized.split('.').pop()?.split('?')[0] || 'mp4';
  return `${CACHE_FOLDER}${hash}.${ext}`;
}

// ─── LRU Eviction ───────────────────────────────────────────────────────────

let lastEvictCheck = 0;

/**
 * Deletes oldest cached files when total size exceeds MAX_CACHE_BYTES.
 * Keeps 80% headroom after eviction to avoid constant thrashing.
 * Throttled to run at most once per 60 seconds to avoid unnecessary disk I/O.
 */
async function evictIfNeeded() {
  const now = Date.now();
  if (now - lastEvictCheck < 60_000) return;
  lastEvictCheck = now;

  try {
    const dirInfo = await FileSystem.readDirectoryAsync(CACHE_FOLDER);
    const fileInfos: { uri: string; size: number; modificationTime: number }[] = [];

    for (const name of dirInfo) {
      const uri = CACHE_FOLDER + name;
      const info = await FileSystem.getInfoAsync(uri, { size: true, md5: false });
      if (info.exists && !info.isDirectory) {
        fileInfos.push({
          uri,
          size: (info as any).size || 0,
          modificationTime: (info as any).modificationTime || 0,
        });
      }
    }

    const totalBytes = fileInfos.reduce((sum, f) => sum + f.size, 0);
    if (totalBytes <= MAX_CACHE_BYTES) return;

    fileInfos.sort((a, b) => a.modificationTime - b.modificationTime); // oldest first
    let currentBytes = totalBytes;
    for (const file of fileInfos) {
      if (currentBytes <= MAX_CACHE_BYTES * 0.8) break;
      await FileSystem.deleteAsync(file.uri, { idempotent: true });
      currentBytes -= file.size;
      if (__DEV__) {
        console.log(`[videoCache] 🗑️ Evicted: ${file.uri} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
      }
    }
  } catch {
    // Non-critical — eviction failure must not block playback
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

const memoryCache = new Set<string>();
const activeDownloads = new Map<string, Promise<string | null>>();

/**
 * Pre-index existing cached video files into memoryCache at app boot.
 */
export async function initVideoCache(): Promise<void> {
  try {
    await ensureCacheFolderExists();
    const files = await FileSystem.readDirectoryAsync(CACHE_FOLDER);
    for (const f of files) {
      if (!f.endsWith('.tmp')) {
        memoryCache.add(CACHE_FOLDER + f);
      }
    }
  } catch {}
}

// Auto-run indexing in background immediately upon module load
initVideoCache().catch(() => {});

/**
 * Synchronously checks if a video URL is already available in the local disk cache.
 */
export function isLocallyCached(url: string): boolean {
  if (!url || !url.startsWith('http')) return false;
  const localUri = getLocalCachePath(normalizeVideoUrl(url));
  return memoryCache.has(localUri);
}

/**
 * Pins an already-existing local video file (e.g. freshly recorded/compressed before upload)
 * directly into the videoCache for the given remote URL.
 * Allows the creator's device to play their newly uploaded story with 0 network latency.
 */
export async function registerLocalVideoCache(remoteUrl: string, localFilePath: string): Promise<void> {
  if (!remoteUrl || !localFilePath) return;
  try {
    await ensureCacheFolderExists();
    const dest = getLocalCachePath(normalizeVideoUrl(remoteUrl));
    const fileInfo = await FileSystem.getInfoAsync(localFilePath);
    if (fileInfo.exists) {
      if (localFilePath !== dest) {
        await FileSystem.copyAsync({ from: localFilePath, to: dest });
      }
      memoryCache.add(dest);
      if (__DEV__) {
        console.log(`[videoCache] 🚀 Registered local video cache for ${remoteUrl} -> ${dest}`);
      }
    }
  } catch (err) {
    if (__DEV__) {
      console.warn('[videoCache] Failed to register local video cache:', err);
    }
  }
}

/**
 * Resolves a remote URL to a cached local file URI.
 * Returns local file URI if already cached, otherwise returns remote URL and downloads in background.
 */
export async function getCachedVideoUri(url: string): Promise<string> {
  if (!url || !url.startsWith('http')) return url;
  const cdnUrl = normalizeVideoUrl(url);
  try {
    const localUri = getLocalCachePath(cdnUrl);
    if (memoryCache.has(localUri)) return localUri;

    await ensureCacheFolderExists();
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      memoryCache.add(localUri);
      return localUri;
    }
    prefetchVideo(cdnUrl).catch(() => {});
    return cdnUrl;
  } catch {
    return cdnUrl;
  }
}

/**
 * Downloads a video file to local cache with in-flight deduplication.
 */
export async function prefetchVideo(url: string): Promise<string | null> {
  if (!url || !url.startsWith('http')) return null;
  const cdnUrl = normalizeVideoUrl(url);
  try {
    const localUri = getLocalCachePath(cdnUrl);
    if (memoryCache.has(localUri)) return localUri;

    await ensureCacheFolderExists();
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (fileInfo.exists) {
      memoryCache.add(localUri);
      return localUri;
    }

    if (activeDownloads.has(localUri)) {
      return activeDownloads.get(localUri)!;
    }

    const downloadPromise = (async () => {
      try {
        const tmp = `${localUri}.tmp`;
        const result = await FileSystem.downloadAsync(cdnUrl, tmp);
        if (result.status >= 200 && result.status < 300) {
          await FileSystem.moveAsync({ from: tmp, to: localUri });
          memoryCache.add(localUri);
          evictIfNeeded().catch(() => {});
          return localUri;
        }
        try { await FileSystem.deleteAsync(tmp, { idempotent: true }); } catch {}
        return null;
      } catch {
        return null;
      } finally {
        activeDownloads.delete(localUri);
      }
    })();

    activeDownloads.set(localUri, downloadPromise);
    return downloadPromise;
  } catch {
    return null;
  }
}

/**
 * Pre-downloads up to 4 videos in background concurrently to enable instant 0ms playback on scroll.
 */
export async function preloadVideos(urls: string[], limit = 3) {
  const uncached = urls
    .filter((u) => typeof u === 'string' && u.startsWith('http') && !isLocallyCached(u))
    .slice(0, Math.min(limit, 4));
  if (uncached.length === 0) return;
  // Concurrently download in parallel using CloudFront HTTP/2 multiplexing
  await Promise.allSettled(uncached.map((url) => prefetchVideo(url)));
}

/**
 * Deletes the entire video cache directory and resets in-memory cache.
 */
export async function clearVideoCache() {
  try {
    memoryCache.clear();
    activeDownloads.clear();
    const info = await FileSystem.getInfoAsync(CACHE_FOLDER);
    if (info.exists) {
      await FileSystem.deleteAsync(CACHE_FOLDER, { idempotent: true });
    }
  } catch (err) {
    if (__DEV__) console.warn('[videoCache] Failed to clear cache:', err);
  }
}
