/**
 * Durable local-first media mirror for already-viewed images/videos.
 * Videos still use videoCache; images pin into documentDirectory/media_mirror.
 */
import * as FileSystem from 'expo-file-system';
import CryptoJS from 'crypto-js';
import {
  getCachedVideoUri,
  getLocalCachePath,
  isLocallyCached,
  prefetchVideo,
} from './videoCache';

const MIRROR_ROOT =
  (FileSystem.documentDirectory || FileSystem.cacheDirectory || '') + 'media_mirror/';
const MAX_MIRROR_BYTES = 600 * 1024 * 1024; // 600 MB — feed/stories/DM library pins
const INDEX_PATH = `${MIRROR_ROOT}_index.json`;

const urlToLocal = new Map<string, string>();
const activePins = new Map<string, Promise<string | null>>();
let lastEvictCheck = 0;
let indexLoaded = false;

function isHttpUrl(url?: string | null): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url.trim());
}

function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return (
    /\.(mp4|mov|webm|m4v|mkv)(\?|$)/i.test(lower) ||
    lower.includes('video/upload') ||
    lower.includes('/video/') ||
    lower.includes('f_mp4')
  );
}

function extFromUrl(url: string): string {
  const raw = url.split('?')[0].split('#')[0];
  const part = raw.split('.').pop() || '';
  if (part && part.length <= 5 && /^[a-z0-9]+$/i.test(part)) return part.toLowerCase();
  return isVideoUrl(url) ? 'mp4' : 'jpg';
}

export function getMirrorLocalPath(url: string): string {
  const hash = CryptoJS.SHA1(url).toString();
  return `${MIRROR_ROOT}${hash}.${extFromUrl(url)}`;
}

async function ensureMirrorFolder(): Promise<void> {
  const info = await FileSystem.getInfoAsync(MIRROR_ROOT);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MIRROR_ROOT, { intermediates: true });
  }
}

async function loadIndex(): Promise<void> {
  if (indexLoaded) return;
  indexLoaded = true;
  try {
    await ensureMirrorFolder();
    const info = await FileSystem.getInfoAsync(INDEX_PATH);
    if (!info.exists) return;
    const raw = await FileSystem.readAsStringAsync(INDEX_PATH);
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [remote, local] of Object.entries(parsed)) {
        if (typeof remote === 'string' && typeof local === 'string') {
          urlToLocal.set(remote, local);
        }
      }
    }
  } catch {
    // ignore corrupt index
  }
}

async function persistIndex(): Promise<void> {
  try {
    await ensureMirrorFolder();
    const obj: Record<string, string> = {};
    urlToLocal.forEach((local, remote) => {
      obj[remote] = local;
    });
    await FileSystem.writeAsStringAsync(INDEX_PATH, JSON.stringify(obj));
  } catch {
    // non-critical
  }
}

async function evictIfNeeded(): Promise<void> {
  const now = Date.now();
  if (now - lastEvictCheck < 60_000) return;
  lastEvictCheck = now;

  try {
    const names = await FileSystem.readDirectoryAsync(MIRROR_ROOT);
    const files: { uri: string; size: number; modificationTime: number; name: string }[] = [];
    for (const name of names) {
      if (name.startsWith('_') || name.endsWith('.tmp')) continue;
      const uri = MIRROR_ROOT + name;
      const info = await FileSystem.getInfoAsync(uri, { size: true });
      if (info.exists && !info.isDirectory) {
        files.push({
          uri,
          name,
          size: (info as any).size || 0,
          modificationTime: (info as any).modificationTime || 0,
        });
      }
    }
    let total = files.reduce((s, f) => s + f.size, 0);
    if (total <= MAX_MIRROR_BYTES) return;

    files.sort((a, b) => a.modificationTime - b.modificationTime);
    for (const file of files) {
      if (total <= MAX_MIRROR_BYTES * 0.8) break;
      await FileSystem.deleteAsync(file.uri, { idempotent: true });
      total -= file.size;
      for (const [remote, local] of Array.from(urlToLocal.entries())) {
        if (local === file.uri) urlToLocal.delete(remote);
      }
    }
    await persistIndex();
  } catch {
    // non-critical
  }
}

/** Sync: return local file URI if already indexed (image mirror or video cache). */
export function resolveLocalFirstSync(url?: string | null): string | null {
  if (!isHttpUrl(url)) return null;
  const remote = url.trim();
  if (isVideoUrl(remote)) {
    if (isLocallyCached(remote)) return getLocalCachePath(remote);
    return null;
  }
  return urlToLocal.get(remote) || null;
}

/** Async resolve: check disk, optionally pin in background. Always returns a playable URI. */
export async function resolveLocalFirst(
  url?: string | null,
  opts?: { pinIfMissing?: boolean }
): Promise<string> {
  if (!url) return '';
  const remote = String(url).trim();
  if (!isHttpUrl(remote)) return remote;

  await loadIndex();

  if (isVideoUrl(remote)) {
    const cached = await getCachedVideoUri(remote);
    if (opts?.pinIfMissing !== false && cached === remote) {
      prefetchVideo(remote).catch(() => {});
    }
    return cached;
  }

  const known = urlToLocal.get(remote);
  if (known) {
    try {
      const info = await FileSystem.getInfoAsync(known);
      if (info.exists) return known;
      urlToLocal.delete(remote);
    } catch {
      urlToLocal.delete(remote);
    }
  }

  const localUri = getMirrorLocalPath(remote);
  try {
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists) {
      urlToLocal.set(remote, localUri);
      return localUri;
    }
  } catch {}

  if (opts?.pinIfMissing !== false) {
    pinMedia(remote).catch(() => {});
  }
  return remote;
}

/** Download and pin remote media for offline replay. */
export async function pinMedia(url?: string | null): Promise<string | null> {
  if (!isHttpUrl(url)) return null;
  const remote = url.trim();

  if (isVideoUrl(remote)) {
    return prefetchVideo(remote);
  }

  await loadIndex();
  const existing = resolveLocalFirstSync(remote);
  if (existing) return existing;

  if (activePins.has(remote)) {
    return activePins.get(remote)!;
  }

  const promise = (async () => {
    try {
      await ensureMirrorFolder();
      await evictIfNeeded();
      const localUri = getMirrorLocalPath(remote);
      const info = await FileSystem.getInfoAsync(localUri);
      if (info.exists) {
        urlToLocal.set(remote, localUri);
        await persistIndex();
        return localUri;
      }
      const tmpUri = `${localUri}.tmp`;
      const result = await FileSystem.downloadAsync(remote, tmpUri);
      if (!result?.uri) return null;
      await FileSystem.moveAsync({ from: tmpUri, to: localUri });
      urlToLocal.set(remote, localUri);
      await persistIndex();
      return localUri;
    } catch {
      return null;
    } finally {
      activePins.delete(remote);
    }
  })();

  activePins.set(remote, promise);
  return promise;
}

export async function pinMediaMany(urls: Array<string | null | undefined>, limit = 6): Promise<void> {
  const unique = [...new Set(urls.filter(isHttpUrl).map((u) => u.trim()))].slice(0, Math.max(1, limit));
  if (unique.length === 0) return;
  await Promise.allSettled(unique.map((u) => pinMedia(u)));
}

/** Extract common media URL fields from a DM message / shared card for offline pin. */
export function collectMessageMediaUrls(msg: any): string[] {
  if (!msg || typeof msg !== 'object') return [];
  const out: string[] = [];
  const push = (u: any) => {
    if (typeof u === 'string' && /^https?:\/\//i.test(u.trim())) out.push(u.trim());
  };
  push(msg.mediaUrl);
  push(msg.imageUrl);
  push(msg.videoUrl);
  push(msg.thumbnailUrl);
  push(msg.audioUrl);
  const shared = msg.sharedPost || msg.sharedStory;
  if (shared && typeof shared === 'object') {
    push(shared.imageUrl);
    push(shared.videoUrl);
    push(shared.thumbnailUrl);
    push(shared.mediaUrl);
    if (Array.isArray(shared.mediaUrls)) shared.mediaUrls.forEach(push);
    if (Array.isArray(shared.imageUrls)) shared.imageUrls.forEach(push);
    if (Array.isArray(shared.media)) {
      shared.media.forEach((m: any) => {
        push(typeof m === 'string' ? m : m?.url || m?.uri || m?.thumbnailUrl);
      });
    }
  }
  return out;
}

export async function initMediaMirror(): Promise<void> {
  await loadIndex();
}

initMediaMirror().catch(() => {});
