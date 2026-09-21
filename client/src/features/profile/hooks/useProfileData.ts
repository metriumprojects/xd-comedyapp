import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { InteractionManager } from 'react-native';
import { apiService } from '@/src/_services/apiService';
import { fetchBlockedUserIds, filterOutReportedAndBlocked } from '@/services/moderation';
import { getCachedData, setCachedData, removeCachedData } from '@/hooks/useOffline';
import { feedEventEmitter } from '@/lib/feedEventEmitter';
import { patchListAvatars, readProfileUpdatePayload } from '@/src/utils/patchUserAvatar';

/** Instagram-style profile grid page (~6 rows × 3). Backend default is 20; we paginate past it. */
export const PROFILE_POSTS_PAGE_SIZE = 18;

type ProfilePostsInfinite = { pages: { items: any[]; nextSkip: number }[]; pageParams: number[] };

function profilePostsKey(viewedUserId: string, currentUserId: string | null) {
  return ['profilePosts', viewedUserId, currentUserId] as const;
}

function postIdKey(item: any): string {
  return String(item?.id || item?._id || '').split('-loop')[0].trim();
}

/** IG keeps one merged list — dedupe so FlashList keys stay unique when pages overlap. */
function dedupePostsById(items: any[]): any[] {
  const out: any[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const id = postIdKey(item);
    if (!id) {
      out.push(item);
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(item);
  }
  return out;
}

function flattenProfilePosts(data: ProfilePostsInfinite | any[] | undefined | null): any[] {
  if (!data) return [];
  if (Array.isArray(data)) return dedupePostsById(data);
  if (Array.isArray((data as ProfilePostsInfinite).pages)) {
    return dedupePostsById(
      (data as ProfilePostsInfinite).pages.flatMap((p) => (Array.isArray(p?.items) ? p.items : []))
    );
  }
  return [];
}

function mapProfilePostsCache(
  old: ProfilePostsInfinite | any[] | undefined,
  mapper: (posts: any[]) => any[]
): ProfilePostsInfinite | any[] | undefined {
  if (!old) return old;
  if (Array.isArray(old)) return mapper(old);
  const flat = mapper(flattenProfilePosts(old));
  return {
    pages: [{ items: flat, nextSkip: flat.length }],
    pageParams: [0],
  };
}

/** Load every profile page up front — avoids FlashList/infinite-query pagination misses. */
async function fetchAllProfilePosts(viewedUserId: string, currentUserId: string | null): Promise<any[]> {
  const merged: any[] = [];
  const seen = new Set<string>();
  let skip = 0;
  const limit = 24;

  for (let page = 0; page < 50; page++) {
    const res = await apiService.getUserPosts(viewedUserId, {
      skip,
      limit,
      viewerId: currentUserId,
      bypassDedupe: true,
    });
    const batch = res?.success && Array.isArray(res.data) ? res.data : [];
    if (!batch.length) break;

    let added = 0;
    for (const item of batch) {
      const id = postIdKey(item);
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      merged.push(item);
      added++;
    }

    skip += limit;

    // Stop when backend returns zero items or no new posts were added (end of list)
    if (batch.length === 0 || added === 0) break;
  }

  return merged;
}

/** Warm profile cache while user is on home — makes profile tab feel instant */
export function prefetchOwnProfile(client: QueryClient, userId: string) {
  if (!userId) return;
  void client.prefetchQuery({
    queryKey: ['profile', userId, userId],
    queryFn: async () => {
      const res = await apiService.get(`/users/${userId}/aggregated`, { requesterUserId: userId });
      return res?.success ? res.data : null;
    },
    staleTime: 1000 * 60 * 5,
  });
  void client.prefetchQuery({
    queryKey: profilePostsKey(userId, userId),
    queryFn: () => fetchAllProfilePosts(userId, userId),
    staleTime: 1000 * 60 * 2,
  });
}

interface UseProfileDataParams {
  viewedUserId: string | undefined;
  currentUserId: string | null;
  enabled: boolean;
  activeTab?: 'grid' | 'tagged' | 'heart' | 'star' | 'stats';
}

export function useProfileData({ viewedUserId, currentUserId, enabled, activeTab = 'grid' }: UseProfileDataParams) {
  const isValidUserId = (val: any): boolean => {
    if (val == null) return false;
    const s = String(val).trim();
    return s !== '' && s !== 'undefined' && s !== 'null' && s !== '[object Object]' && s !== '0';
  };
  const isCleanUserId = isValidUserId(viewedUserId);

  const queryClient = useQueryClient();
  const cacheKey = useMemo(
    () => `profile_data_cache_v6_${isCleanUserId ? viewedUserId : 'unknown'}`,
    [viewedUserId, isCleanUserId]
  );

  const [cachedData, setCachedDataState] = useState<any>(null);
  const [isSeedingCache, setIsSeedingCache] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState<Set<string>>(new Set());
  const [hasMorePostsState, setHasMorePostsState] = useState<boolean>(true);
  const [isFetchingMoreState, setIsFetchingMoreState] = useState<boolean>(false);

  // Fetch blocked users for current user to filter out blocked content
  useEffect(() => {
    if (!currentUserId) return;
    fetchBlockedUserIds(currentUserId).then(setBlockedUsers).catch(() => {});
  }, [currentUserId]);

  // Seed React Query cache from local AsyncStorage on mount
  useEffect(() => {
    if (!isCleanUserId || !enabled) return;

    async function seedCache() {
      try {
        const cached = await getCachedData<any>(cacheKey);
        if (cached) {
          setCachedDataState(cached);
          if (cached.profile) {
            queryClient.setQueryData(['profile', viewedUserId, currentUserId], cached.profile);
          }
          if (cached.sections && cached.sections.length > 0) {
            queryClient.setQueryData(['profileSections', viewedUserId], cached.sections);
          }
          if (cached.stories && cached.stories.length > 0) {
            queryClient.setQueryData(['profileStories', viewedUserId], cached.stories);
          }
          if (cached.savedPosts && cached.savedPosts.length > 0) {
            queryClient.setQueryData(['profileSavedPosts', viewedUserId], cached.savedPosts);
          }
          if (cached.taggedPosts && cached.taggedPosts.length > 0) {
            queryClient.setQueryData(['profileTaggedPosts', viewedUserId], cached.taggedPosts);
          }
          if (cached.likedPosts && cached.likedPosts.length > 0) {
            queryClient.setQueryData(['profileLikedPosts', viewedUserId], cached.likedPosts);
          }
          if (cached.highlights && cached.highlights.length > 0) {
            queryClient.setQueryData(['profileHighlights', viewedUserId], cached.highlights);
          }
        }
      } catch (err) {
        console.warn('[useProfileData] Cache seeding failed:', err);
      } finally {
        setIsSeedingCache(false);
      }
    }

    seedCache();
  }, [viewedUserId, currentUserId, enabled, queryClient, cacheKey, isCleanUserId]);

  // 1. Fetch Aggregated Profile Data
  const profileQuery = useQuery({
    queryKey: ['profile', viewedUserId, currentUserId],
    queryFn: async () => {
      if (!isCleanUserId) return null;
      const [blockedSet, profileRes] = await Promise.all([
        currentUserId ? fetchBlockedUserIds(currentUserId) : Promise.resolve(new Set<string>()),
        apiService.get(`/users/${viewedUserId}/aggregated`, { requesterUserId: currentUserId }),
      ]);

      if (!profileRes.success || !profileRes.data) {
        throw new Error(profileRes.error || 'Failed to fetch profile');
      }
      return profileRes.data;
    },
    enabled: enabled && isCleanUserId,
    staleTime: 1000 * 30, // 30 seconds — keep follow/follower state fresh
    gcTime: 1000 * 60 * 30,
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000),
  });

  const profileData = profileQuery.data || cachedData?.profile;
  // Prefer server isSelf — viewedUserId and currentUserId may be different ID forms (mongo vs firebase)
  const isOwnProfile = !!(
    profileData?.isSelf ||
    profileData?.isOwnProfile ||
    (viewedUserId && currentUserId && (
      String(viewedUserId) === String(currentUserId) ||
      String(profileData?._id || '') === String(currentUserId || '') ||
      String(profileData?.firebaseUid || '') === String(currentUserId || '')
    ))
  );
  // Default to true while loading so queries run in parallel. Only block if explicitly private with no access.
  const isExplicitlyLocked = !!(
    profileData &&
    profileData.isPrivate &&
    !isOwnProfile &&
    !profileData.hasAccess &&
    !profileData.canViewPrivateProfile
  );
  const canViewPrivateProfile = !isExplicitlyLocked;

  // Defer secondary profile fetches until after first paint (grid + header stay snappy)
  const [secondaryReady, setSecondaryReady] = useState(false);
  useEffect(() => {
    setSecondaryReady(false);
    if (!enabled || !isCleanUserId || !canViewPrivateProfile) return;
    const task = InteractionManager.runAfterInteractions(() => {
      setSecondaryReady(true);
    });
    return () => {
      try { task.cancel?.(); } catch {}
    };
  }, [enabled, isCleanUserId, canViewPrivateProfile, viewedUserId]);

  // 2. Fetch ALL user posts up front (IG-style merged grid — no scroll pagination dependency)
  const postsQuery = useQuery({
    queryKey: profilePostsKey(viewedUserId!, currentUserId),
    queryFn: () => {
      const targetId = profileQuery.data?._id || profileQuery.data?.firebaseUid || viewedUserId!;
      return fetchAllProfilePosts(targetId, currentUserId);
    },
    enabled: enabled && isCleanUserId && canViewPrivateProfile,
    staleTime: 0,
    refetchOnMount: 'always',
    gcTime: 1000 * 60 * 30,
    retry: 2,
  });

  // 3. Fetch User Sections (Collections)
  const sectionsQuery = useQuery({
    queryKey: ['profileSections', viewedUserId],
    queryFn: async () => {
      if (!isCleanUserId) return [];
      const res = await apiService.get(`/users/${viewedUserId}/sections`, { viewerId: currentUserId });
      return res?.success && Array.isArray(res.data) ? res.data : [];
    },
    enabled: enabled && isCleanUserId && canViewPrivateProfile,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  // 4. Fetch User Stories
  const storiesQuery = useQuery({
    queryKey: ['profileStories', viewedUserId],
    queryFn: async () => {
      if (!isCleanUserId) return [];
      try {
        const res = await apiService.get(`/users/${viewedUserId}/stories`);
        return res?.success && Array.isArray(res.data) ? res.data : [];
      } catch (error: any) {
        if (error.response?.status === 404) return [];
        throw error;
      }
    },
    enabled: enabled && isCleanUserId && canViewPrivateProfile,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 15,
  });

  // 5. Fetch Saved Posts (if viewing own profile) — deferred after first paint
  const savedPostsQuery = useQuery({
    queryKey: ['profileSavedPosts', viewedUserId],
    queryFn: async () => {
      if (!isCleanUserId) return [];
      try {
        const res = await apiService.get(`/users/${viewedUserId}/saved`);
        return res?.success && Array.isArray(res.data) ? res.data : [];
      } catch (error: any) {
        if (error.response?.status === 404) return [];
        throw error;
      }
    },
    enabled: enabled && isCleanUserId && isOwnProfile && secondaryReady,
    staleTime: 1000 * 60 * 5,
  });

  // 6. Fetch Tagged Posts — deferred after first paint
  const taggedPostsQuery = useQuery({
    queryKey: ['profileTaggedPosts', viewedUserId],
    queryFn: async () => {
      if (!isCleanUserId) return [];
      try {
        const res = await apiService.get(`/users/${viewedUserId}/tagged-posts`);
        return res?.success && Array.isArray(res.data) ? res.data : [];
      } catch (error: any) {
        if (error.response?.status === 404) return [];
        throw error;
      }
    },
    enabled: enabled && isCleanUserId && canViewPrivateProfile && secondaryReady,
    staleTime: 1000 * 60 * 10,
  });

  // 7. Fetch Highlights — deferred after first paint
  const highlightsQuery = useQuery({
    queryKey: ['profileHighlights', viewedUserId],
    queryFn: async () => {
      if (!isCleanUserId) return [];
      try {
        const res = await apiService.get(`/users/${viewedUserId}/highlights`);
        const rawHighlights = res?.success && Array.isArray(res.data) ? res.data : [];

        // Filter out duplicates by ID to prevent showing duplicate highlights
        const seen = new Set();
        const uniqueHighlights = [];
        for (const h of rawHighlights) {
          const key = String(h.id || h._id || '');
          if (key && !seen.has(key)) {
            seen.add(key);
            uniqueHighlights.push(h);
          }
        }

        return uniqueHighlights.map((h: any) => ({
          ...h,
          id: h.id || h._id || String(h._id || ''),
          coverImage: h.coverImage || h.cover || h.image || (h.items && h.items[0]?.imageUrl) || '',
        }));
      } catch (error: any) {
        if (error.response?.status === 404) return [];
        throw error;
      }
    },
    enabled: enabled && isCleanUserId && canViewPrivateProfile && secondaryReady,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  // 8. Fetch Liked Posts (ComedyApp unique heart tab — if viewing own profile) — deferred after first paint
  const likedPostsQuery = useQuery({
    queryKey: ['profileLikedPosts', viewedUserId],
    queryFn: async () => {
      if (!isCleanUserId) return [];
      try {
        const res = await apiService.get(`/users/${viewedUserId}/liked-posts`);
        return res?.success && Array.isArray(res.data) ? res.data : [];
      } catch (error: any) {
        if (error.response?.status === 404) return [];
        throw error;
      }
    },
    enabled: enabled && isCleanUserId && isOwnProfile && secondaryReady,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // Cache fresh data to AsyncStorage on updates
  const postsDataFlat = useMemo(() => dedupePostsById(postsQuery.data || []), [postsQuery.data]);
  const sectionsData = sectionsQuery.data;
  const storiesData = storiesQuery.data;
  const savedPostsData = savedPostsQuery.data;
  const taggedPostsData = taggedPostsQuery.data;
  const likedPostsData = likedPostsQuery.data;
  const highlightsData = highlightsQuery.data;

  useEffect(() => {
    if (!viewedUserId || !profileQuery.data) return;

    setCachedData(
      cacheKey,
      {
        profile: profileQuery.data,
        posts: postsDataFlat,
        sections: sectionsData || [],
        stories: storiesData || [],
        savedPosts: savedPostsData || [],
        taggedPosts: taggedPostsData || [],
        likedPosts: likedPostsData || [],
        highlights: highlightsData || [],
      },
      { ttl: 24 * 60 * 60 * 1000 }
    ).catch((e) => {
      console.warn('[useProfileData] Caching failed:', e);
    });
  }, [
    viewedUserId,
    cacheKey,
    profileQuery.data,
    postsDataFlat,
    sectionsData,
    storiesData,
    savedPostsData,
    taggedPostsData,
    likedPostsData,
    highlightsData,
  ]);

  // Listen for feed events to invalidate or update the cache instantly
  useEffect(() => {
    if (!viewedUserId) return;

    try {
      const unsub = feedEventEmitter.onFeedUpdate((event: any) => {
        if (event.type === 'POST_CREATED') {
          removeCachedData(cacheKey).catch(() => {});
          queryClient.invalidateQueries({ queryKey: profilePostsKey(viewedUserId, currentUserId) });
          queryClient.invalidateQueries({ queryKey: ['profilePosts', viewedUserId] });
          queryClient.invalidateQueries({ queryKey: ['profile', viewedUserId, currentUserId] });
          queryClient.invalidateQueries({ queryKey: ['profileSavedPosts', viewedUserId] });
          queryClient.invalidateQueries({ queryKey: ['profileLikedPosts', viewedUserId] });
          queryClient.invalidateQueries({ queryKey: ['profileSections', viewedUserId] });
          queryClient.invalidateQueries({ queryKey: ['profileTaggedPosts', viewedUserId] });
        } else if (event.type === 'POST_DELETED' && event.postId) {
          const targetId = String(event.postId).split('-loop')[0].trim();
          const removePost = (old: any) =>
            mapProfilePostsCache(old, (list) =>
              list.filter((p) => {
                const pid = String(p?.id || p?._id || '').split('-loop')[0].trim();
                return pid !== targetId;
              })
            );

          queryClient.setQueryData(profilePostsKey(viewedUserId, currentUserId), removePost);
          queryClient.setQueryData(['profilePosts', viewedUserId], removePost);
          queryClient.setQueryData(['profileTaggedPosts', viewedUserId], (old: any) =>
            Array.isArray(old)
              ? old.filter((p: any) => {
                  const pid = String(p?.id || p?._id || '').split('-loop')[0].trim();
                  return pid !== targetId;
                })
              : []
          );
          queryClient.setQueryData(['profileSavedPosts', viewedUserId], (old: any) =>
            Array.isArray(old)
              ? old.filter((p: any) => {
                  const pid = String(p?.id || p?._id || '').split('-loop')[0].trim();
                  return pid !== targetId;
                })
              : []
          );
          queryClient.setQueryData(['profileLikedPosts', viewedUserId], (old: any) =>
            Array.isArray(old)
              ? old.filter((p: any) => {
                  const pid = String(p?.id || p?._id || '').split('-loop')[0].trim();
                  return pid !== targetId;
                })
              : []
          );

          queryClient.invalidateQueries({ queryKey: profilePostsKey(viewedUserId, currentUserId) });
          queryClient.invalidateQueries({ queryKey: ['profilePosts', viewedUserId] });
          queryClient.invalidateQueries({ queryKey: ['profileTaggedPosts', viewedUserId] });
          queryClient.invalidateQueries({ queryKey: ['profile', viewedUserId, currentUserId] });
          queryClient.invalidateQueries({ queryKey: ['profileSavedPosts', viewedUserId] });
          queryClient.invalidateQueries({ queryKey: ['profileLikedPosts', viewedUserId] });
          queryClient.invalidateQueries({ queryKey: ['profileSections', viewedUserId] });
        } else if (event.type === 'POST_UPDATED' && event.postId) {
          const patch = event.data && typeof event.data === 'object' ? event.data : {};
          const patchPostsList = (old: any) =>
            mapProfilePostsCache(old, (list) =>
              list.map((p) => {
                const pid = String(p?._id || p?.id || '');
                return pid === String(event.postId) ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p;
              })
            );

          queryClient.setQueryData(profilePostsKey(viewedUserId, currentUserId), patchPostsList);
          queryClient.setQueryData(['profilePosts', viewedUserId], patchPostsList);
          queryClient.setQueryData(['profileSavedPosts', viewedUserId], (old: any) =>
            Array.isArray(old)
              ? old.map((p: any) => {
                  const pid = String(p?._id || p?.id || '');
                  return pid === String(event.postId) ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p;
                })
              : old
          );
          queryClient.setQueryData(['profileLikedPosts', viewedUserId], (old: any) =>
            Array.isArray(old)
              ? old.map((p: any) => {
                  const pid = String(p?._id || p?.id || '');
                  return pid === String(event.postId) ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p;
                })
              : old
          );
          queryClient.setQueryData(['profileTaggedPosts', viewedUserId], (old: any) =>
            Array.isArray(old)
              ? old.map((p: any) => {
                  const pid = String(p?._id || p?.id || '');
                  return pid === String(event.postId) ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p;
                })
              : old
          );

          queryClient.invalidateQueries({ queryKey: profilePostsKey(viewedUserId, currentUserId) });
          queryClient.invalidateQueries({ queryKey: ['profilePosts', viewedUserId] });
          queryClient.invalidateQueries({ queryKey: ['profileSavedPosts', viewedUserId] });
          queryClient.invalidateQueries({ queryKey: ['profileLikedPosts', viewedUserId] });
          queryClient.invalidateQueries({ queryKey: ['profileSections', viewedUserId] });
          queryClient.invalidateQueries({ queryKey: ['profileTaggedPosts', viewedUserId] });
        } else if (event.type === 'USER_BLOCKED') {
          const blockedUserId = String(event.userId || (event as any).blockedUserId || '').trim();
          if (blockedUserId) {
            setBlockedUsers((prev) => new Set([...prev, blockedUserId]));

            const removeBlockedUserPosts = (old: any) =>
              mapProfilePostsCache(old, (list) =>
                list.filter((p) => {
                  const authorId =
                    p?.userId && typeof p.userId === 'object'
                      ? String(p.userId._id || p.userId.id || p.userId.uid || '')
                      : String(p?.userId || '');
                  return authorId !== blockedUserId;
                })
              );

            queryClient.setQueryData(profilePostsKey(viewedUserId, currentUserId), removeBlockedUserPosts);
            queryClient.setQueryData(['profilePosts', viewedUserId], removeBlockedUserPosts);
            queryClient.setQueryData(['profileTaggedPosts', viewedUserId], (old: any) =>
              Array.isArray(old)
                ? old.filter((p: any) => {
                    const authorId =
                      p?.userId && typeof p.userId === 'object'
                        ? String(p.userId._id || p.userId.id || p.userId.uid || '')
                        : String(p?.userId || '');
                    return authorId !== blockedUserId;
                  })
                : []
            );
            queryClient.setQueryData(['profileSavedPosts', viewedUserId], (old: any) =>
              Array.isArray(old)
                ? old.filter((p: any) => {
                    const authorId =
                      p?.userId && typeof p.userId === 'object'
                        ? String(p.userId._id || p.userId.id || p.userId.uid || '')
                        : String(p?.userId || '');
                    return authorId !== blockedUserId;
                  })
                : []
            );
            queryClient.setQueryData(['profileLikedPosts', viewedUserId], (old: any) =>
              Array.isArray(old)
                ? old.filter((p: any) => {
                    const authorId =
                      p?.userId && typeof p.userId === 'object'
                        ? String(p.userId._id || p.userId.id || p.userId.uid || '')
                        : String(p?.userId || '');
                    return authorId !== blockedUserId;
                  })
                : []
            );

            queryClient.invalidateQueries({ queryKey: profilePostsKey(viewedUserId, currentUserId) });
            queryClient.invalidateQueries({ queryKey: ['profilePosts', viewedUserId] });
            queryClient.invalidateQueries({ queryKey: ['profileTaggedPosts', viewedUserId] });
            queryClient.invalidateQueries({ queryKey: ['profileSavedPosts', viewedUserId] });
            queryClient.invalidateQueries({ queryKey: ['profileLikedPosts', viewedUserId] });
          }
        }
      });

      const sub = feedEventEmitter.addListener('feedUpdated', () => {
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['profile', viewedUserId] });
        queryClient.invalidateQueries({ queryKey: ['profileTaggedPosts', viewedUserId] });
        queryClient.invalidateQueries({ queryKey: ['profileSavedPosts', viewedUserId] });
        queryClient.invalidateQueries({ queryKey: ['profileLikedPosts', viewedUserId] });
        queryClient.invalidateQueries({ queryKey: ['profileSections', viewedUserId] });
        queryClient.invalidateQueries({ queryKey: ['profileHighlights', viewedUserId] });
      });

      const avatarSub = feedEventEmitter.addListener('USER_PROFILE_UPDATED', (data: any) => {
        const payload = readProfileUpdatePayload(data);
        if (!payload) return;
        const { uid, avatar, displayName, username } = payload;
        const patchPosts = (old: any) =>
          mapProfilePostsCache(old, (list) => patchListAvatars(list, uid, avatar, displayName, username));

        queryClient.setQueryData(profilePostsKey(viewedUserId, currentUserId), patchPosts);
        queryClient.setQueryData(['profilePosts', viewedUserId], patchPosts);
        queryClient.setQueryData(['profileSavedPosts', viewedUserId], (old: any) =>
          Array.isArray(old) ? patchListAvatars(old, uid, avatar, displayName, username) : old
        );
        queryClient.setQueryData(['profileLikedPosts', viewedUserId], (old: any) =>
          Array.isArray(old) ? patchListAvatars(old, uid, avatar, displayName, username) : old
        );
        queryClient.setQueryData(['profileTaggedPosts', viewedUserId], (old: any) =>
          Array.isArray(old) ? patchListAvatars(old, uid, avatar, displayName, username) : old
        );

        if (String(viewedUserId) === String(uid)) {
          queryClient.setQueryData(['profile', viewedUserId, currentUserId], (old: any) => {
            if (!old || typeof old !== 'object') return old;
            return {
              ...old,
              avatar,
              photoURL: avatar,
              displayName: displayName || old.displayName,
              name: displayName || old.name,
              username: username || old.username,
            };
          });
        }
      });

      return () => {
        unsub();
        sub.remove();
        avatarSub.remove();
      };
    } catch (e) {
      console.warn('[useProfileData] Failed to bind feedEventEmitter:', e);
    }
  }, [viewedUserId, currentUserId, queryClient, cacheKey]);

  const showSpinner = (isSeedingCache && !cachedData?.profile) || (profileQuery.isLoading && !profileData);

  const rawPosts = postsQuery.data !== undefined ? postsDataFlat : cachedData?.posts || [];
  const rawSaved = savedPostsQuery.data || cachedData?.savedPosts || [];
  const rawTagged = taggedPostsQuery.data || cachedData?.taggedPosts || [];
  const rawLiked = likedPostsQuery.data || cachedData?.likedPosts || [];

  return {
    profile: profileData,
    posts: filterOutReportedAndBlocked(rawPosts, blockedUsers),
    sections: sectionsQuery.data || cachedData?.sections || [],
    userStories: filterOutReportedAndBlocked(storiesQuery.data || cachedData?.stories || [], blockedUsers),
    savedSectionPosts: filterOutReportedAndBlocked(rawSaved, blockedUsers),
    taggedPosts: filterOutReportedAndBlocked(rawTagged, blockedUsers),
    likedPosts: filterOutReportedAndBlocked(rawLiked, blockedUsers),
    highlights: (() => {
      const raw = highlightsQuery.data || cachedData?.highlights || [];
      const seen = new Set();
      const unique = [];
      for (const h of raw) {
        const key = String(h.id || h._id || '');
        if (key && !seen.has(key)) {
          seen.add(key);
          unique.push(h);
        }
      }
      return unique.map((h: any) => ({
        ...h,
        id: h.id || h._id || String(h._id || ''),
        coverImage: h.coverImage || h.cover || h.image || (h.items && h.items[0]?.imageUrl) || '',
      }));
    })(),
    isLoading: showSpinner,
    isError: profileQuery.isError,
    isRefetching: profileQuery.isRefetching,
    hasMorePosts: hasMorePostsState,
    isFetchingMorePosts: isFetchingMoreState,
    loadMorePosts: async () => {
      if (!viewedUserId || isFetchingMoreState || !hasMorePostsState) return;
      setIsFetchingMoreState(true);
      try {
        const currentList = postsDataFlat;
        const skip = currentList.length;
        const limit = 24;
        const targetId = profileQuery.data?._id || profileQuery.data?.firebaseUid || viewedUserId;
        const res = await apiService.getUserPosts(targetId, {
          skip,
          limit,
          viewerId: currentUserId,
          bypassDedupe: true,
        });
        const batch = res?.success && Array.isArray(res.data) ? res.data : [];
        if (batch.length === 0) {
          setHasMorePostsState(false);
        } else {
          const updatedMerged = dedupePostsById([...currentList, ...batch]);
          if (updatedMerged.length === currentList.length) {
            setHasMorePostsState(false);
          } else {
            queryClient.setQueryData(profilePostsKey(viewedUserId, currentUserId), updatedMerged);
            queryClient.setQueryData(['profilePosts', viewedUserId], updatedMerged);
            if (batch.length < limit) {
              setHasMorePostsState(false);
            }
          }
        }
      } catch (err) {
        console.warn('[useProfileData] loadMorePosts failed:', err);
      } finally {
        setIsFetchingMoreState(false);
      }
    },
    refetchAll: async () => {
      await Promise.all([
        profileQuery.refetch(),
        postsQuery.refetch(),
        sectionsQuery.refetch(),
        storiesQuery.refetch(),
        taggedPostsQuery.refetch(),
        highlightsQuery.refetch(),
        isOwnProfile ? savedPostsQuery.refetch() : Promise.resolve(),
        isOwnProfile ? likedPostsQuery.refetch() : Promise.resolve(),
      ]);
    },
  };
}
