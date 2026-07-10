import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { InteractionManager } from 'react-native';
import { apiService } from '../src/_services/apiService';
import { getUserProfile } from '../lib/firebaseHelpers/index';
import { getCachedData, setCachedData } from '../hooks/useOffline';

export function useHomeFeed(currentUserId: string | null, isOnline: boolean) {
  const [posts, setPosts] = useState<any[]>([]);
  const [allLoadedPosts, setAllLoadedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  
  // Cursor-based pagination state
  const cursorRef = useRef<string | null>(null);
  const cursorDateRef = useRef<string | null>(null);
  const avatarHydrateReqIdRef = useRef(0);
  const avatarHydrateTaskRef = useRef<any>(null);
  const allLoadedPostsRef = useRef<any[]>([]);
  const hasFetchedRef = useRef(false);

  useEffect(() => {
    allLoadedPostsRef.current = Array.isArray(allLoadedPosts) ? allLoadedPosts : [];
  }, [allLoadedPosts]);

  const HOME_CACHE_KEY = useMemo(() => `home_feed_v2_${String(currentUserId || 'anon')}`, [currentUserId]);

  // Server handles randomization now — createMixedFeed is a pass-through for first page
  // and simple append for subsequent pages
  const createMixedFeed = useCallback((postsArray: any[]) => {
    return postsArray;
  }, []);

  const normalizeAvatar = useCallback((value: any): string => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim();
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    if (['null', 'undefined', 'n/a', 'na'].includes(lower)) return '';
    if (lower.includes('via.placeholder.com/200x200.png?text=profile')) return '';
    if (lower.includes('/default%2fdefault-pic.jpg') || lower.includes('/default/default-pic.jpg')) return '';
    return trimmed;
  }, []);

  const getPostAuthorId = useCallback((post: any): string => {
    const raw = post?.userId;
    if (typeof raw === 'string') return raw;
    if (raw && typeof raw === 'object') return String(raw._id || raw.id || raw.uid || raw.firebaseUid || '');
    return '';
  }, []);

  const loadInitialFeed = async (pageNum = 0, options?: { silent?: boolean, [key: string]: any }) => {
    if (pageNum === 0) {
      cursorRef.current = null;
      cursorDateRef.current = null;
    }
    if (pageNum === 0 && !options?.silent) setLoading(true);
    try {
      const limit = 20;

      // Build params — use cursor for page 2+, skip for legacy fallback
      const params: any = {
        limit,
        requesterUserId: currentUserId || undefined,
        ...options
      };

      if (pageNum > 0 && cursorRef.current) {
        // Cursor-based pagination — O(1) cost regardless of depth
        params.cursor = cursorRef.current;
        params.cursorDate = cursorDateRef.current;
      } else if (pageNum > 0) {
        // Fallback to offset-based if no cursor available
        params.skip = pageNum * limit;
      }

      const response = await apiService.getPosts(params);

      let postsData: any[] = [];
      let nextCursor: string | null = null;
      let nextCursorDate: string | null = null;

      if (response?.success && Array.isArray(response.data)) {
        postsData = response.data;
        nextCursor = response.cursor || null;
        nextCursorDate = response.cursorDate || null;
      } else if (Array.isArray(response)) {
        postsData = response;
      }

      // Update cursor for next page
      if (nextCursor) {
        cursorRef.current = nextCursor;
        cursorDateRef.current = nextCursorDate;
      }

      // If main feed returned nothing, try the recommended (randomized) endpoint
      if (pageNum > 0 && postsData.length === 0) {
        const excludeIds = (allLoadedPostsRef.current || [])
          .map((p: any) => String(p?.id || p?._id || ''))
          .filter(Boolean)
          .slice(-180);
        try {
          const recRes = await apiService.getRecommendedPosts({
            limit,
            excludeIds: excludeIds.join(','),
            requesterUserId: currentUserId || undefined,
          });
          if (recRes?.success && Array.isArray(recRes.data)) {
            postsData = recRes.data;
          }
        } catch {}
      }

      const normalizedPosts = postsData.map(p => ({
        ...p,
        id: p.id || p._id,
        isPrivate: p.isPrivate ?? false,
        allowedFollowers: p.allowedFollowers || [],
      }));

      // Redundant safety filter for blocked users
      const blockedSet = new Set<string>();
      try {
        const { fetchBlockedUserIds } = await import('../services/moderation');
        const ids = await fetchBlockedUserIds(currentUserId || '');
        ids.forEach(id => blockedSet.add(String(id)));
      } catch {}

      const filteredPosts = normalizedPosts.filter(p => {
        const authorId = p.userId && typeof p.userId === 'object' 
          ? String(p.userId._id || p.userId.id || '') 
          : String(p.userId || '');
        return !blockedSet.has(authorId);
      });

      if (pageNum === 0) {
        try { await setCachedData(HOME_CACHE_KEY, filteredPosts, { ttl: 24 * 60 * 60 * 1000 }); } catch {}
        setAllLoadedPosts(filteredPosts);
        // Server already handles randomization — use data as-is
        setPosts(filteredPosts);

        avatarHydrateReqIdRef.current += 1;
        const reqId = avatarHydrateReqIdRef.current;
        try { avatarHydrateTaskRef.current?.cancel?.(); } catch {}
        avatarHydrateTaskRef.current = InteractionManager.runAfterInteractions(() => {
          (async () => {
            if (reqId !== avatarHydrateReqIdRef.current) return;
            
            // Only fetch profiles for posts that are missing a valid avatar
            const needsHydration = normalizedPosts.filter(p => {
              const direct = normalizeAvatar(p.userAvatar || p.avatar || p.photoURL || p.profilePicture || p?.userId?.avatar || p?.userId?.photoURL);
              return !direct;
            });
            if (needsHydration.length === 0) return; // Skip hydration entirely if all posts have avatars

            const authorIds = Array.from(new Set(needsHydration.map(p => getPostAuthorId(p)).filter(Boolean)));
            const avatarMap: Record<string, string> = {};
            const idsToFetch = authorIds.slice(0, 15); // Batch call

            if (idsToFetch.length > 0) {
              try {
                const bulkRes = await apiService.getBulkProfiles(idsToFetch);
                if (bulkRes?.success && Array.isArray(bulkRes.data)) {
                  bulkRes.data.forEach((user: any) => {
                    const resolved = normalizeAvatar(user.avatar || user.photoURL || user.profilePicture);
                    const authorId = String(user.uid || user.firebaseUid || user._id || '');
                    if (resolved && authorId) avatarMap[authorId] = resolved;
                  });
                }
              } catch (err) {
                if (__DEV__) console.warn('[HomeFeed] Bulk profile fetch failed:', err);
              }
            }

            if (reqId !== avatarHydrateReqIdRef.current) return;
            if (Object.keys(avatarMap).length === 0) return; // Nothing to apply
            
            const apply = (p: any) => {
              const authorId = getPostAuthorId(p);
              const directAvatar = normalizeAvatar(p.userAvatar || p.avatar || p.photoURL || p.profilePicture || p?.userId?.avatar || p?.userId?.photoURL || p?.userId?.profilePicture);
              if (directAvatar) return p; // Already has avatar, skip update
              const hydratedAvatar = avatarMap[authorId] || '';
              if (!hydratedAvatar) return p;
              const hydratedUserObj = (p.userId && typeof p.userId === 'object') ? { ...p.userId, avatar: p.userId.avatar || hydratedAvatar, photoURL: p.userId.photoURL || hydratedAvatar, profilePicture: p.userId.profilePicture || hydratedAvatar } : p.userId;
              return { ...p, userAvatar: hydratedAvatar, avatar: hydratedAvatar, photoURL: hydratedAvatar, profilePicture: hydratedAvatar, userId: hydratedUserObj };
            };
            setAllLoadedPosts(prev => (Array.isArray(prev) ? prev.map(apply) : prev));
            setPosts(prev => (Array.isArray(prev) ? prev.map(apply) : prev));
          })();
        });
      } else {
        setAllLoadedPosts(prev => {
          const updated = [...(Array.isArray(prev) ? prev : []), ...normalizedPosts];
          return Array.from(new Map(updated.map((p: any) => [String(p?.id || p?._id || ''), p])).values()).filter((p: any) => p && (p.id || p._id));
        });
        setPosts(prev => {
          const cur = Array.isArray(prev) ? prev : [];
          const seen = new Set(cur.map((p: any) => String(p?.id || p?._id || '')));
          const toAdd = normalizedPosts.filter(p => {
            const id = String(p?.id || p?._id || '');
            if (!id || seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          return [...cur, ...toAdd];
        });
      }
      return postsData;
    } catch (error: any) {
      console.error('[HomeFeed] Error loading posts:', error);
      return [];
    } finally {
      if (pageNum === 0 && !options?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const cached = await getCachedData<any[]>(HOME_CACHE_KEY);
        if (Array.isArray(cached) && cached.length > 0) {
          setAllLoadedPosts(cached);
          setPosts(cached);
          setLoading(false);
        }
      } catch {}

      if (!currentUserId) return;
      if (hasFetchedRef.current) return;
      hasFetchedRef.current = true;

      if (isOnline) {
        // Reset cursor for fresh load
        cursorRef.current = null;
        cursorDateRef.current = null;
        await loadInitialFeed(0);
      } else {
        setLoading(prev => (prev ? false : prev));
      }
    })();
  }, [HOME_CACHE_KEY, isOnline, currentUserId]);

  const loadMorePosts = useCallback(() => {
    if (loadingMore || loading || !hasMorePosts) return;
    setLoadingMore(true);
    // pageNum is still tracked for the recommended fallback logic
    const nextPage = cursorRef.current ? 1 : 0; // Any non-zero triggers cursor path
    loadInitialFeed(nextPage > 0 ? nextPage : 1).then((res: any) => {
      const newData = Array.isArray(res) ? res : (res?.data || []);
      if (newData.length > 0) {
        if (newData.length < 20) setHasMorePosts(false);
      } else {
        setHasMorePosts(false);
      }
    }).finally(() => setLoadingMore(false));
  }, [loadingMore, loading, hasMorePosts, loadInitialFeed]);

  return {
    posts,
    setPosts,
    allLoadedPosts,
    setAllLoadedPosts,
    loading,
    loadingMore,
    hasMorePosts,
    setHasMorePosts,
    loadInitialFeed,
    loadMorePosts,
    createMixedFeed,
    HOME_CACHE_KEY
  };
}
