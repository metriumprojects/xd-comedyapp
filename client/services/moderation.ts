import { apiService } from '@/src/_services/apiService';
import AsyncStorage from '@/lib/storage';

// In-memory caches for instant zero-latency filtering
const blockedCache = new Map<string, { ids: Set<string>; ts: number }>();
const BLOCKED_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

const REPORTED_POSTS_STORAGE_KEY = '@reported_posts_v1';
const REPORTED_COMMENTS_STORAGE_KEY = '@reported_comments_v1';
const REPORTED_STORIES_STORAGE_KEY = '@reported_stories_v1';
const REPORTED_USERS_STORAGE_KEY = '@reported_users_v1';

const reportedPostsSet = new Set<string>();
const reportedCommentsSet = new Set<string>();
const reportedStoriesSet = new Set<string>();
const reportedUsersSet = new Set<string>();
let isInitialized = false;

// Initialize reported sets from persistent storage on module load
export async function initModerationStore(): Promise<void> {
  if (isInitialized) return;
  try {
    const [postsJson, commentsJson, storiesJson, usersJson] = await Promise.all([
      AsyncStorage.getItem(REPORTED_POSTS_STORAGE_KEY),
      AsyncStorage.getItem(REPORTED_COMMENTS_STORAGE_KEY),
      AsyncStorage.getItem(REPORTED_STORIES_STORAGE_KEY),
      AsyncStorage.getItem(REPORTED_USERS_STORAGE_KEY)
    ]);

    if (postsJson) {
      const ids: string[] = JSON.parse(postsJson);
      if (Array.isArray(ids)) {
        ids.forEach(id => reportedPostsSet.add(String(id)));
      }
    }

    if (commentsJson) {
      const ids: string[] = JSON.parse(commentsJson);
      if (Array.isArray(ids)) {
        ids.forEach(id => reportedCommentsSet.add(String(id)));
      }
    }

    if (storiesJson) {
      const ids: string[] = JSON.parse(storiesJson);
      if (Array.isArray(ids)) {
        ids.forEach(id => reportedStoriesSet.add(String(id)));
      }
    }

    if (usersJson) {
      const ids: string[] = JSON.parse(usersJson);
      if (Array.isArray(ids)) {
        ids.forEach(id => reportedUsersSet.add(String(id)));
      }
    }
    isInitialized = true;
  } catch (err) {
    console.warn('[moderation] Failed to load reported content from storage:', err);
  }
}

// Trigger initial load immediately
initModerationStore().catch(() => {});

/**
 * Record a reported post locally so it is immediately filtered out across all views
 */
export async function addReportedPostId(postId: string): Promise<void> {
  if (!postId) return;
  const cleanId = String(postId).split('-loop')[0].trim();
  reportedPostsSet.add(cleanId);
  try {
    const all = Array.from(reportedPostsSet);
    await AsyncStorage.setItem(REPORTED_POSTS_STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn('[moderation] Failed to save reported post ID to storage:', err);
  }
}

/**
 * Check if a post has been reported by the user
 */
export function isPostReported(postId: string): boolean {
  if (!postId) return false;
  const cleanId = String(postId).split('-loop')[0].trim();
  return reportedPostsSet.has(cleanId);
}

/**
 * Record a reported comment locally
 */
export async function addReportedCommentId(commentId: string): Promise<void> {
  if (!commentId) return;
  const cleanId = String(commentId).trim();
  reportedCommentsSet.add(cleanId);
  try {
    const all = Array.from(reportedCommentsSet);
    await AsyncStorage.setItem(REPORTED_COMMENTS_STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn('[moderation] Failed to save reported comment ID to storage:', err);
  }
}

/**
 * Check if a comment has been reported
 */
export function isCommentReported(commentId: string): boolean {
  if (!commentId) return false;
  const cleanId = String(commentId).trim();
  return reportedCommentsSet.has(cleanId);
}

/**
 * Record a reported story locally
 */
export async function addReportedStoryId(storyId: string): Promise<void> {
  if (!storyId) return;
  const cleanId = String(storyId).trim();
  reportedStoriesSet.add(cleanId);
  try {
    const all = Array.from(reportedStoriesSet);
    await AsyncStorage.setItem(REPORTED_STORIES_STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn('[moderation] Failed to save reported story ID to storage:', err);
  }
}

/**
 * Check if a story has been reported
 */
export function isStoryReported(storyId: string): boolean {
  if (!storyId) return false;
  const cleanId = String(storyId).trim();
  return reportedStoriesSet.has(cleanId);
}

/**
 * Record a reported user locally
 */
export async function addReportedUserId(userId: string): Promise<void> {
  if (!userId) return;
  const cleanId = String(userId).trim();
  reportedUsersSet.add(cleanId);
  try {
    const all = Array.from(reportedUsersSet);
    await AsyncStorage.setItem(REPORTED_USERS_STORAGE_KEY, JSON.stringify(all));
  } catch (err) {
    console.warn('[moderation] Failed to save reported user ID to storage:', err);
  }
}

/**
 * Check if a user has been reported
 */
export function isUserReported(userId: string): boolean {
  if (!userId) return false;
  const cleanId = String(userId).trim();
  return reportedUsersSet.has(cleanId);
}

/**
 * Add a newly blocked user ID to local cache immediately
 */
export function addBlockedUserId(currentUserId: string, blockedId: string): void {
  if (!currentUserId || !blockedId) return;
  const entry = blockedCache.get(currentUserId);
  const cleanId = String(blockedId).trim();
  if (entry) {
    entry.ids.add(cleanId);
  } else {
    blockedCache.set(currentUserId, { ids: new Set([cleanId]), ts: Date.now() });
  }
}

/**
 * Remove a user ID from local blocked cache immediately upon unblocking
 */
export function removeBlockedUserId(currentUserId: string, unblockedId: string): void {
  if (!unblockedId) return;
  const cleanId = String(unblockedId).trim();
  if (currentUserId) {
    const entry = blockedCache.get(currentUserId);
    if (entry) entry.ids.delete(cleanId);
  }
  for (const entry of blockedCache.values()) {
    entry.ids.delete(cleanId);
  }
  reportedUsersSet.delete(cleanId);
}

/**
 * Synchronously checks if a user is blocked locally
 */
export function isUserBlockedLocally(targetId: string, currentUserId?: string): boolean {
  if (!targetId) return false;
  const cleanId = String(targetId).trim();
  if (currentUserId) {
    const entry = blockedCache.get(currentUserId);
    if (entry && entry.ids.has(cleanId)) return true;
  }
  for (const entry of blockedCache.values()) {
    if (entry.ids.has(cleanId)) return true;
  }
  return false;
}

export function peekBlockedUserIds(uid: string): Set<string> | null {
  if (!uid) return null;
  const cached = blockedCache.get(uid);
  if (cached && Date.now() - cached.ts < BLOCKED_CACHE_TTL) {
    return cached.ids;
  }
  return cached?.ids ?? null;
}

/**
 * Fetch blocked user IDs with TTL cache (10 min).
 */
export async function fetchBlockedUserIds(uid: string): Promise<Set<string>> {
  if (!uid) return new Set<string>();

  const cached = blockedCache.get(uid);
  if (cached && Date.now() - cached.ts < BLOCKED_CACHE_TTL) {
    return cached.ids;
  }

  try {
    const res = await apiService.get(`/users/${uid}/blocked`);
    if (res?.success && Array.isArray(res.data)) {
      const ids = new Set<string>();
      res.data.forEach((u: any) => {
        // Add ALL id variants so filtering works regardless of which ID format posts use
        if (u._id) ids.add(String(u._id));
        if (u.uid) ids.add(String(u.uid));
        if (u.firebaseUid) ids.add(String(u.firebaseUid));
        if (u.id) ids.add(String(u.id));
      });
      blockedCache.set(uid, { ids, ts: Date.now() });
      return ids;
    }
    return new Set<string>();
  } catch (err) {
    console.warn('fetchBlockedUserIds failed:', err);
    return cached?.ids ?? new Set<string>(); // Return stale cache on error
  }
}

/**
 * Check if an item is authored by a blocked user or reported user
 */
export function isAuthorBlocked(item: any, blocked?: Set<string>): boolean {
  if (!item) return false;
  const rawUid = item.userId || item.ownerId || item.authorId || item.user;
  if (!rawUid) return false;

  if (typeof rawUid === 'object') {
    const ids = [rawUid._id, rawUid.id, rawUid.uid, rawUid.firebaseUid].filter(Boolean).map(String);
    if (ids.some(id => reportedUsersSet.has(id))) return true;
    if (blocked && blocked.size > 0 && ids.some(id => blocked.has(id))) return true;
    for (const entry of blockedCache.values()) {
      if (ids.some(id => entry.ids.has(id))) return true;
    }
    return false;
  }

  const cleanId = String(rawUid).trim();
  if (reportedUsersSet.has(cleanId)) return true;
  if (blocked && blocked.size > 0 && blocked.has(cleanId)) return true;
  for (const entry of blockedCache.values()) {
    if (entry.ids.has(cleanId)) return true;
  }
  return false;
}

export function filterOutBlocked<T = any>(items: T[], blocked?: Set<string>): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter(i => !isAuthorBlocked(i, blocked));
}

/**
 * Comprehensively filters out reported items (posts, stories) and items from blocked/reported users
 */
export function filterOutReportedAndBlocked<T = any>(items: T[], blocked?: Set<string>): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter(i => {
    // 1. Check if post or story itself is reported
    const raw = i as any;
    const id = String(raw?.id || raw?._id || raw?.postId || raw?.storyId || '').split('-loop')[0].trim();
    if (id && (reportedPostsSet.has(id) || reportedStoriesSet.has(id))) {
      return false;
    }

    // 2. Check if author is blocked or reported
    if (isAuthorBlocked(i, blocked)) {
      return false;
    }

    return true;
  });
}
