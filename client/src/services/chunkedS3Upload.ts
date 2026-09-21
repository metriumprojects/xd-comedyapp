import AsyncStorage from '@/lib/storage';
import { apiService } from '@/src/services/apiService';

export const CHUNKED_UPLOAD_THRESHOLD = 8 * 1024 * 1024; // 8MB
const DEFAULT_PART_SIZE = 8 * 1024 * 1024;
const CONCURRENCY = 3;

export type ChunkedUploadContext = 'post' | 'story' | 'media';

export type ChunkedUploadResult = {
  success: boolean;
  url?: string;
  feedUrl?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  mediaType?: string;
  error?: string;
};

type CompletedPart = { PartNumber: number; ETag: string };

type MultipartSession = {
  localId: string;
  uri: string;
  size: number;
  uploadId: string;
  key: string;
  partSize: number;
  contentType: string;
  context: ChunkedUploadContext;
  mediaType: string;
  completedParts: CompletedPart[];
  updatedAt: number;
};

function sessionKey(localId: string) {
  return `multipart_upload_${localId}`;
}

function makeLocalId(uri: string, size: number) {
  const tail = String(uri).slice(-48);
  return `${size}_${tail.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const Buf = (global as any).Buffer;
  if (Buf) {
    return new Uint8Array(Buf.from(base64, 'base64'));
  }
  const binary = globalThis.atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function loadSession(localId: string): Promise<MultipartSession | null> {
  try {
    const raw = await AsyncStorage.getItem(sessionKey(localId));
    if (!raw) return null;
    return JSON.parse(raw) as MultipartSession;
  } catch {
    return null;
  }
}

async function saveSession(session: MultipartSession) {
  session.updatedAt = Date.now();
  await AsyncStorage.setItem(sessionKey(session.localId), JSON.stringify(session));
}

async function clearSession(localId: string) {
  try {
    await AsyncStorage.removeItem(sessionKey(localId));
  } catch {}
}

async function putPart(
  uri: string,
  offset: number,
  length: number,
  presignedUrl: string,
  contentType: string
): Promise<string> {
  const FileSystem = require('expo-file-system');
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
    position: offset,
    length,
  });
  const body = base64ToUint8Array(base64);
  const res = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': contentType || 'application/octet-stream',
      'Content-Length': String(body.byteLength),
    },
    body: body as any,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Part upload failed (${res.status}): ${text.slice(0, 160)}`);
  }
  const etag = res.headers.get('etag') || res.headers.get('ETag') || '';
  if (!etag) {
    return '';
  }
  return etag;
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function chunkedS3Upload(options: {
  uri: string;
  mediaType?: 'video' | 'image' | 'audio';
  context?: ChunkedUploadContext;
  contentType?: string;
  fileName?: string;
  onProgress?: (percent: number) => void;
  signal?: { aborted?: boolean };
}): Promise<ChunkedUploadResult> {
  const FileSystem = require('expo-file-system');
  const mediaType = options.mediaType || 'video';
  const context = options.context || 'post';
  const contentType = options.contentType || (mediaType === 'video' ? 'video/mp4' : 'application/octet-stream');
  const fileName = options.fileName || (mediaType === 'video' ? `video-${Date.now()}.mp4` : `file-${Date.now()}`);

  let uri = options.uri;
  if (!uri.startsWith('file://') && !uri.startsWith('content://') && !uri.includes('://')) {
    uri = `file://${uri}`;
  }

  const info = await FileSystem.getInfoAsync(uri, { size: true });
  if (!info?.exists) {
    return { success: false, error: 'File not found for chunked upload' };
  }
  const size = Number(info.size || 0);
  if (!size || size <= 0) {
    return { success: false, error: 'Could not read file size' };
  }

  const localId = makeLocalId(uri, size);
  let session = await loadSession(localId);

  try {
    if (!session || session.uri !== uri || session.size !== size) {
      const init = await apiService.post('/upload/multipart/init', {
        mediaType,
        fileName,
        contentType,
        size,
        context,
      });
      if (!init?.success && !init?.uploadId && !init?.data?.uploadId) {
        return { success: false, error: init?.error || 'Failed to init multipart upload' };
      }
      const uploadId = init.uploadId || init.data?.uploadId;
      const key = init.key || init.data?.key;
      const partSize = Number(init.partSize || init.data?.partSize || DEFAULT_PART_SIZE);
      session = {
        localId,
        uri,
        size,
        uploadId,
        key,
        partSize,
        contentType,
        context,
        mediaType,
        completedParts: [],
        updatedAt: Date.now(),
      };
      await saveSession(session);
    }

    try {
      const listed = await apiService.post('/upload/multipart/list-parts', {
        uploadId: session.uploadId,
        key: session.key,
      });
      const remoteParts = listed?.parts || listed?.data?.parts || [];
      if (Array.isArray(remoteParts) && remoteParts.length) {
        const byNum = new Map<number, CompletedPart>();
        for (const p of session.completedParts) byNum.set(p.PartNumber, p);
        for (const p of remoteParts) {
          const PartNumber = Number(p.PartNumber);
          const ETag = String(p.ETag || '');
          if (PartNumber && ETag) byNum.set(PartNumber, { PartNumber, ETag });
        }
        session.completedParts = Array.from(byNum.values()).sort((a, b) => a.PartNumber - b.PartNumber);
        await saveSession(session);
      }
    } catch {
      // list-parts optional
    }

    const partSize = session.partSize || DEFAULT_PART_SIZE;
    const totalParts = Math.ceil(size / partSize);
    const doneSet = new Set(session.completedParts.map((p) => p.PartNumber));
    const pending: number[] = [];
    for (let n = 1; n <= totalParts; n++) {
      if (!doneSet.has(n)) pending.push(n);
    }

    const reportProgress = () => {
      const doneBytes = session!.completedParts.reduce((sum, p) => {
        const start = (p.PartNumber - 1) * partSize;
        const len = Math.min(partSize, size - start);
        return sum + Math.max(0, len);
      }, 0);
      const pct = Math.max(1, Math.min(99, Math.round((doneBytes / size) * 100)));
      options.onProgress?.(pct);
    };
    reportProgress();

    await mapPool(pending, CONCURRENCY, async (partNumber) => {
      if (options.signal?.aborted) throw new Error('Upload aborted');
      const start = (partNumber - 1) * partSize;
      const length = Math.min(partSize, size - start);

      const signed = await apiService.post('/upload/multipart/sign-part', {
        uploadId: session!.uploadId,
        key: session!.key,
        partNumber,
      });
      const url = signed?.url || signed?.data?.url;
      if (!url) throw new Error(signed?.error || `No presign for part ${partNumber}`);

      let etag = await putPart(uri, start, length, url, session!.contentType);
      if (!etag) {
        const listed = await apiService.post('/upload/multipart/list-parts', {
          uploadId: session!.uploadId,
          key: session!.key,
        });
        const remoteParts = listed?.parts || listed?.data?.parts || [];
        const hit = (remoteParts as any[]).find((p) => Number(p.PartNumber) === partNumber);
        etag = hit?.ETag || '';
      }
      if (!etag) throw new Error(`Missing ETag for part ${partNumber}`);

      session!.completedParts = [
        ...session!.completedParts.filter((p) => p.PartNumber !== partNumber),
        { PartNumber: partNumber, ETag: etag },
      ].sort((a, b) => a.PartNumber - b.PartNumber);
      await saveSession(session!);
      reportProgress();
      return partNumber;
    });

    if (options.signal?.aborted) throw new Error('Upload aborted');

    const complete = await apiService.post('/upload/multipart/complete', {
      uploadId: session.uploadId,
      key: session.key,
      parts: session.completedParts,
      mediaType,
      context,
    });

    if (!complete?.success && !(complete?.url || complete?.data?.url || complete?.data?.secure_url)) {
      return { success: false, error: complete?.error || 'Complete multipart failed' };
    }

    const url = complete.url || complete.data?.url || complete.data?.secure_url;
    await clearSession(localId);
    options.onProgress?.(100);

    return {
      success: true,
      url,
      feedUrl: complete.feedUrl || complete.data?.feedUrl || url,
      thumbnailUrl: complete.thumbnailUrl || complete.data?.thumbnailUrl || '',
      width: complete.width || complete.data?.width,
      height: complete.height || complete.data?.height,
      aspectRatio: complete.aspectRatio || complete.data?.aspectRatio,
      mediaType,
    };
  } catch (err: any) {
    const msg = err?.message || 'Chunked upload failed';
    if (/aborted/i.test(msg) && session) {
      try {
        await apiService.post('/upload/multipart/abort', {
          uploadId: session.uploadId,
          key: session.key,
        });
        await clearSession(localId);
      } catch {}
    }
    return { success: false, error: msg };
  }
}

export async function abortChunkedUploadSession(uri: string, size: number) {
  const localId = makeLocalId(uri, size);
  const session = await loadSession(localId);
  if (!session) return;
  try {
    await apiService.post('/upload/multipart/abort', {
      uploadId: session.uploadId,
      key: session.key,
    });
  } catch {}
  await clearSession(localId);
}
