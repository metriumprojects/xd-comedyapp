import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { InteractionManager } from 'react-native';
import { apiService } from '../src/_services/apiService';
import { getCachedData, setCachedData } from '../hooks/useOffline';

export function useHomeFeed(
  currentUserId: string | null,
  isOnline: boolean,
  category: string = ''
) {
  const [posts, setPosts] = useState<any[]>([]);
  const [allLoadedPosts, setAllLoadedPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);

  const normalizedCategory = (category || '').trim();

  // Cursor-based and offset pagination state
  const cursorRef = useRef<string | null>(null);
  const cursorDateRef = useRef<string | null>(null);
  const pageRef = useRef<number>(0);
  const loadingMoreRef = useRef<boolean>(false);
  const categoryRef = useRef<string>(normalizedCategory);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, []);

  const avatarHydrateReqIdRef = useRef(0);
  const avatarHydrateTaskRef = useRef<any>(null);
  const allLoadedPostsRef = useRef<any[]>([]);

  useEffect(() => {
    categoryRef.current = normalizedCategory;
  }, [normalizedCategory]);

  useEffect(() => {
    allLoadedPostsRef.current = Array.isArray(allLoadedPosts) ? allLoadedPosts : [];
  }, [allLoadedPosts]);

  const HOME_CACHE_KEY = useMemo(
    () => `home_feed_v3_${String(currentUserId || 'anon')}_${normalizedCategory ? normalizedCategory.toLowerCase() : 'all'}`,
    [currentUserId, normalizedCategory]
  );

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

  const loadInitialFeed = async (
    pageNum = 0,
    options?: { silent?: boolean; [key: string]: any }
  ) => {
    const activeCategory = categoryRef.current;
    if (pageNum === 0) {
      cursorRef.current = null;
      cursorDateRef.current = null;
      pageRef.current = 0;
      setHasMorePosts(true);
    }
    if (pageNum === 0 && !options?.silent) setLoading(true);

    try {
      const limit = 25;

      // Build params — pass category filter to backend
      const params: any = {
        limit,
        requesterUserId: currentUserId || undefined,
        viewerId: currentUserId || undefined,
        category: activeCategory || undefined,
        ...options,
      };

      if (pageNum > 0 && cursorRef.current) {
        params.cursor = cursorRef.current;
        params.cursorDate = cursorDateRef.current;
      } else if (pageNum > 0) {
        params.skip = pageNum * limit;
      }

      const response = await apiService.getPosts(params);

      // Guard: Ignore response if category changed while request was in-flight
      if (activeCategory !== categoryRef.current) {
        return [];
      }

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
      cursorRef.current = nextCursor;
      cursorDateRef.current = nextCursorDate;
      pageRef.current = pageNum;

      // If main feed returned nothing, try recommended endpoint for unseen posts
      if (pageNum > 0 && postsData.length === 0) {
        const excludeIds = (allLoadedPostsRef.current || [])
          .map((p: any) => String(p?.id || p?._id || ''))
          .filter(Boolean)
          .slice(-180);
        try {
          const recRes = await apiService.getRecommendedPosts({
            limit,
            category: activeCategory || undefined,
            excludeIds: excludeIds.join(','),
            requesterUserId: currentUserId || undefined,
          });
          if (recRes?.success && Array.isArray(recRes.data) && recRes.data.length > 0) {
            postsData = recRes.data;
          }
        } catch {}
      }

      // Instagram Reels continuous discovery: If all posts in DB have been seen,
      // sample reels excluding only the last 8 so feed never terminates
      if (pageNum > 0 && postsData.length === 0) {
        const recentExclude = (allLoadedPostsRef.current || [])
          .map((p: any) => String(p?.id || p?._id || ''))
          .filter(Boolean)
          .slice(-8);
        try {
          const loopRes = await apiService.getRecommendedPosts({
            limit,
            category: activeCategory || undefined,
            excludeIds: recentExclude.join(','),
            requesterUserId: currentUserId || undefined,
          });
          if (loopRes?.success && Array.isArray(loopRes.data) && loopRes.data.length > 0) {
            postsData = loopRes.data;
          }
        } catch {}
      }

      setHasMorePosts(postsData.length > 0);

      const normalizedPosts = postsData.map((p, idx) => ({
        ...p,
        id: p.id || p._id,
        feedInstanceId: `${String(p.id || p._id || 'reel')}-p${pageNum}-${idx}-${Date.now().toString(36)}`,
        isPrivate: p.isPrivate ?? false,
        allowedFollowers: p.allowedFollowers || [],
      }));

      // Redundant safety filter for blocked users and reported posts
      const blockedSet = new Set<string>();
      let isPostReportedFn = (id: string) => false;
      try {
        const { fetchBlockedUserIds, isPostReported, initModerationStore } = await import('../services/moderation');
        await initModerationStore();
        isPostReportedFn = isPostReported;
        const ids = await fetchBlockedUserIds(currentUserId || '');
        ids.forEach((id) => blockedSet.add(String(id)));
      } catch {}

      const filteredPosts = normalizedPosts.filter((p) => {
        const pid = String(p.id || p._id || '').split('-loop')[0];
        if (isPostReportedFn(pid)) return false;

        const authorId =
          p.userId && typeof p.userId === 'object'
            ? String(p.userId._id || p.userId.id || '')
            : String(p.userId || '');
        return !blockedSet.has(authorId);
      });

      if (pageNum === 0) {
        try {
          await setCachedData(HOME_CACHE_KEY, filteredPosts, { ttl: 24 * 60 * 60 * 1000 });
        } catch {}
        setAllLoadedPosts(filteredPosts);
        setPosts(filteredPosts);

        avatarHydrateReqIdRef.current += 1;
        const reqId = avatarHydrateReqIdRef.current;
        try {
          avatarHydrateTaskRef.current?.cancel?.();
        } catch {}
        avatarHydrateTaskRef.current = InteractionManager.runAfterInteractions(() => {
          (async () => {
            if (reqId !== avatarHydrateReqIdRef.current) return;

            const needsHydration = normalizedPosts.filter((p) => {
              const direct = normalizeAvatar(
                p.userAvatar ||
                  p.avatar ||
                  p.photoURL ||
                  p.profilePicture ||
                  p?.userId?.avatar ||
                  p?.userId?.photoURL
              );
              return !direct;
            });
            if (needsHydration.length === 0) return;

            const authorIds = Array.from(
              new Set(needsHydration.map((p) => getPostAuthorId(p)).filter(Boolean))
            );
            const avatarMap: Record<string, string> = {};
            const idsToFetch = authorIds.slice(0, 15);

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
            if (Object.keys(avatarMap).length === 0) return;

            const apply = (p: any) => {
              const authorId = getPostAuthorId(p);
              const directAvatar = normalizeAvatar(
                p.userAvatar ||
                  p.avatar ||
                  p.photoURL ||
                  p.profilePicture ||
                  p?.userId?.avatar ||
                  p?.userId?.photoURL ||
                  p?.userId?.profilePicture
              );
              if (directAvatar) return p;
              const hydratedAvatar = avatarMap[authorId] || '';
              if (!hydratedAvatar) return p;
              const hydratedUserObj =
                p.userId && typeof p.userId === 'object'
                  ? {
                      ...p.userId,
                      avatar: p.userId.avatar || hydratedAvatar,
                      photoURL: p.userId.photoURL || hydratedAvatar,
                      profilePicture: p.userId.profilePicture || hydratedAvatar,
                    }
                  : p.userId;
              return {
                ...p,
                userAvatar: hydratedAvatar,
                avatar: hydratedAvatar,
                photoURL: hydratedAvatar,
                profilePicture: hydratedAvatar,
                userId: hydratedUserObj,
              };
            };
            setAllLoadedPosts((prev) => (Array.isArray(prev) ? prev.map(apply) : prev));
            setPosts((prev) => (Array.isArray(prev) ? prev.map(apply) : prev));
          })();
        });
      } else {
        setAllLoadedPosts((prev) => {
          const updated = [...(Array.isArray(prev) ? prev : []), ...normalizedPosts];
          return Array.from(
            new Map(updated.map((p: any) => [String(p?.id || p?._id || ''), p])).values()
          ).filter((p: any) => p && (p.id || p._id));
        });
        setPosts((prev) => {
          const cur = Array.isArray(prev) ? prev : [];
          // Prevent immediate back-to-back duplicates from the last 3 items
          const recentSeen = new Set(cur.slice(-3).map((p: any) => String(p?.id || p?._id || '')));
          const toAdd = normalizedPosts.filter((p) => {
            const id = String(p?.id || p?._id || '');
            return id && !recentSeen.has(id);
          });
          if (toAdd.length === 0) {
            return cur;
          }
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

  // Re-fetch or load cache whenever category or user changes
  useEffect(() => {
    let isCancelled = false;

    (async () => {
      // 1. Try instant cache for snappy transition
      try {
        const cached = await getCachedData<any[]>(HOME_CACHE_KEY);
        if (!isCancelled && Array.isArray(cached) && cached.length > 0) {
          setAllLoadedPosts(cached);
          setPosts(cached);
          setLoading(false);
        } else if (!isCancelled) {
          setPosts([]);
          setLoading(true);
        }
      } catch {
        if (!isCancelled) setLoading(true);
      }

      if (isOnline) {
        cursorRef.current = null;
        cursorDateRef.current = null;
        pageRef.current = 0;
        setHasMorePosts(true);
        await loadInitialFeed(0, { silent: false });
      } else if (!isCancelled) {
        setLoading(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [HOME_CACHE_KEY, isOnline, currentUserId, normalizedCategory]);

  const loadMorePosts = useCallback(async () => {
    if (loadingMoreRef.current || loading || !hasMorePosts) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);

    try {
      const nextPage = pageRef.current + 1;
      const res = await loadInitialFeed(nextPage);
      if (res && res.length > 0) {
        if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      }
    } catch (err) {
      console.error('[HomeFeed] loadMore error:', err);
      // Silent auto-retry once after 2.5s on network glitch
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = setTimeout(() => {
        if (!loadingMoreRef.current) {
          loadMorePosts();
        }
      }, 2500);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [loading, hasMorePosts, loadInitialFeed]);

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
    HOME_CACHE_KEY,
  };
}
