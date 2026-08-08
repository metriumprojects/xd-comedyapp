import { useEffect } from 'react';
import { useQuery, useQueryClient, QueryClient } from '@tanstack/react-query';
import { apiService } from '@/src/_services/apiService';
import { fetchBlockedUserIds } from '@/services/moderation';
import AsyncStorage from '@/lib/storage';

interface UseProfileDataParams {
  viewedUserId: string | undefined;
  currentUserId: string | null;
  enabled: boolean;
  activeTab?: 'grid' | 'tagged' | 'heart' | 'star' | 'stats';
}

async function fetchProfileAggregate(viewedUserId: string, currentUserId: string | null) {
  if (viewedUserId === 'davis_press_id') {
    return {
      _id: 'davis_press_id',
      displayName: 'Davis Press',
      username: 'davis_press',
      avatar: 'https://i.pravatar.cc/150?img=33',
      bio: 'Comedy enthusiast & content creator. Making people laugh daily!',
      followersCount: 1420,
      followingCount: 382,
      postsCount: 1,
      interests: 'Stand Up, Pranks, Comics',
      isPrivate: false,
      hasAccess: true
    };
  }
  if (viewedUserId === 'paul_zuak_id') {
    return {
      _id: 'paul_zuak_id',
      displayName: 'Paul Zuak',
      username: 'paul_zuak',
      avatar: 'https://i.pravatar.cc/150?img=12',
      bio: 'Just another guy trying to be funny. Member of the local standup club.',
      followersCount: 980,
      followingCount: 412,
      postsCount: 1,
      interests: 'Humour, Memes',
      isPrivate: false,
      hasAccess: true
    };
  }
  if (viewedUserId === 'nolan22_id') {
    return {
      _id: 'nolan22_id',
      displayName: 'Nolan22',
      username: 'nolan22',
      avatar: 'https://i.pravatar.cc/150?img=60',
      bio: 'Pranks and comedy vlogs. Subscriber to funny creators.',
      followersCount: 2300,
      followingCount: 890,
      postsCount: 1,
      interests: 'Vlogs, Comedy',
      isPrivate: false,
      hasAccess: true
    };
  }

  const profileRes = await apiService.get(`/users/${viewedUserId}/aggregated`, { requesterUserId: currentUserId });
  if (!profileRes.success || !profileRes.data) {
    throw new Error(profileRes.error || 'Failed to fetch profile');
  }
  void AsyncStorage.setItem(`swr_profile_${viewedUserId}`, JSON.stringify(profileRes.data));
  return profileRes.data;
}

/** Warm profile cache while user is on home — makes profile tab feel instant */
export function prefetchOwnProfile(client: QueryClient, userId: string) {
  if (!userId) return;
  void client.prefetchQuery({
    queryKey: ['profile', userId, userId],
    queryFn: () => fetchProfileAggregate(userId, userId),
    staleTime: 1000 * 60 * 5,
  });
  void client.prefetchQuery({
    queryKey: ['profilePosts', userId],
    queryFn: async () => {
      const res = await apiService.getUserPosts(userId, { viewerId: userId });
      return res?.success && Array.isArray(res.data) ? res.data : [];
    },
    staleTime: 1000 * 60 * 2,
  });
}

export function useProfileData({ viewedUserId, currentUserId, enabled, activeTab = 'grid' }: UseProfileDataParams) {
  const queryClient = useQueryClient();

  // Instant SWR Hydration from AsyncStorage Cache
  useEffect(() => {
    if (!viewedUserId || !enabled) return;
    let isMounted = true;

    const hydrateFromStorage = async () => {
      try {
        const [profStr, postsStr] = await Promise.all([
          AsyncStorage.getItem(`swr_profile_${viewedUserId}`),
          AsyncStorage.getItem(`swr_posts_${viewedUserId}`),
        ]);

        if (!isMounted) return;

        if (profStr) {
          const parsedProf = JSON.parse(profStr);
          queryClient.setQueryData(['profile', viewedUserId, currentUserId], (old: any) => old ?? parsedProf);
        }

        if (postsStr) {
          const parsedPosts = JSON.parse(postsStr);
          queryClient.setQueryData(['profilePosts', viewedUserId], (old: any) => old ?? parsedPosts);
        }
      } catch (e) {
        // Silent
      }
    };

    hydrateFromStorage();
    return () => { isMounted = false; };
  }, [viewedUserId, currentUserId, enabled, queryClient]);

  // 1. Fetch Aggregated Profile Data
  const profileQuery = useQuery({
    queryKey: ['profile', viewedUserId, currentUserId],
    queryFn: async () => {
      if (!viewedUserId) return null;
      await (currentUserId ? fetchBlockedUserIds(currentUserId) : Promise.resolve(new Set<string>()));
      return fetchProfileAggregate(viewedUserId, currentUserId);
    },
    enabled: enabled && !!viewedUserId,
    staleTime: 1000 * 30, // 30s SWR background revalidation
    gcTime: 1000 * 60 * 60 * 24, // 24hr cache persistence
    placeholderData: (previousData) => {
      if (previousData && (previousData._id === viewedUserId || previousData.id === viewedUserId)) {
        return previousData;
      }
      return undefined;
    },
  });

  const profileData = profileQuery.data;
  const canViewPrivateProfile = !!profileData?.hasAccess;

  // 2. Fetch User Posts
  const postsQuery = useQuery({
    queryKey: ['profilePosts', viewedUserId],
    queryFn: async () => {
      if (!viewedUserId) return [];

      if (viewedUserId === 'davis_press_id') {
        return [
          {
            _id: 'davis_press_post_1',
            userId: 'davis_press_id',
            userName: 'davis_press',
            userAvatar: 'https://i.pravatar.cc/150?img=33',
            caption: 'When you try to code in React Native at 3 AM 😂 #developer #coding',
            media: [{ url: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=500' }],
            laughCount: 45,
            tomatoCount: 2,
            commentCount: 8,
            createdAt: new Date().toISOString()
          }
        ];
      }
      if (viewedUserId === 'paul_zuak_id') {
        return [
          {
            _id: 'paul_zuak_post_1',
            userId: 'paul_zuak_id',
            userName: 'paul_zuak',
            userAvatar: 'https://i.pravatar.cc/150?img=12',
            caption: 'My first standup show went like this... 🎤💀 #humour #comedy',
            media: [{ url: 'https://images.unsplash.com/photo-1585699324551-f6c309eed262?w=500' }],
            laughCount: 82,
            tomatoCount: 12,
            commentCount: 15,
            createdAt: new Date().toISOString()
          }
        ];
      }
      if (viewedUserId === 'nolan22_id') {
        return [
          {
            _id: 'nolan22_post_1',
            userId: 'nolan22_id',
            userName: 'nolan22',
            userAvatar: 'https://i.pravatar.cc/150?img=60',
            caption: 'Asking strangers funny questions in public 🤫 #prank #vlog',
            media: [{ url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=500' }],
            laughCount: 112,
            tomatoCount: 8,
            commentCount: 34,
            createdAt: new Date().toISOString()
          }
        ];
      }

      const res = await apiService.getUserPosts(viewedUserId, { viewerId: currentUserId });
      const postsList = res?.success && Array.isArray(res.data) ? res.data : [];
      if (postsList.length > 0) {
        void AsyncStorage.setItem(`swr_posts_${viewedUserId}`, JSON.stringify(postsList));
      }
      return postsList;
    },
    enabled: enabled && !!viewedUserId && canViewPrivateProfile,
    staleTime: 1000 * 30, // 30s SWR background revalidation
    gcTime: 1000 * 60 * 60 * 24, // 24hr cache persistence
    placeholderData: (previousData) => previousData ?? [],
  });

  // 3. Fetch User Sections (Collections)
  const sectionsQuery = useQuery({
    queryKey: ['profileSections', viewedUserId],
    queryFn: async () => {
      if (!viewedUserId) return [];
      const res = await apiService.get(`/users/${viewedUserId}/sections`, { viewerId: currentUserId });
      if (!res?.success || !Array.isArray(res.data)) return [];
      const seen = new Set<string>();
      return res.data.filter((item: any) => {
        if (!item || !item.name) return false;
        const key = (item._id || item.id || item.name).toString().toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
    enabled: enabled && !!viewedUserId && canViewPrivateProfile,
    staleTime: 1000 * 60 * 5,
  });

  // 4. Fetch User Stories
  const storiesQuery = useQuery({
    queryKey: ['profileStories', viewedUserId],
    queryFn: async () => {
      if (!viewedUserId) return [];
      try {
        const res = await apiService.get(`/stories/user/${viewedUserId}`);
        return res?.success && Array.isArray(res.data) ? res.data : [];
      } catch (error: any) {
        if (error.response?.status === 404) return [];
        throw error;
      }
    },
    enabled: enabled && !!viewedUserId && canViewPrivateProfile,
    staleTime: 1000 * 60 * 1, // Stories change frequently
  });

  // 5. Fetch Saved Posts (if viewing own profile)
  const isOwnProfile = viewedUserId === currentUserId;
  const savedPostsQuery = useQuery({
    queryKey: ['profileSavedPosts', viewedUserId],
    queryFn: async () => {
      if (!viewedUserId) return [];
      try {
        const res = await apiService.get(`/users/${viewedUserId}/saved-posts`);
        return res?.success && Array.isArray(res.data) ? res.data : [];
      } catch (error: any) {
        if (error.response?.status === 404) return [];
        throw error;
      }
    },
    enabled: enabled && !!viewedUserId && isOwnProfile,
    staleTime: 1000 * 60 * 5,
  });

  // 6. Fetch Tagged Posts
  const taggedPostsQuery = useQuery({
    queryKey: ['profileTaggedPosts', viewedUserId],
    queryFn: async () => {
      if (!viewedUserId) return [];
      try {
        const res = await apiService.get(`/users/${viewedUserId}/tagged-posts`);
        return res?.success && Array.isArray(res.data) ? res.data : [];
      } catch (error: any) {
        if (error.response?.status === 404) return [];
        throw error;
      }
    },
    enabled: enabled && !!viewedUserId && canViewPrivateProfile,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 60 * 24,
  });

  // 7. Fetch Highlights
  const highlightsQuery = useQuery({
    queryKey: ['profileHighlights', viewedUserId],
    queryFn: async () => {
      if (!viewedUserId) return [];
      try {
        const res = await apiService.get(`/users/${viewedUserId}/highlights`);
        const rawList = res?.success && Array.isArray(res.data) ? res.data : [];
        
        // Filter out duplicates by ID or title to prevent showing duplicate highlights
        const seen = new Set();
        const uniqueHighlights = [];
        for (const h of rawList) {
          const key = String(h.id || h._id || h.title || '').trim();
          if (key && !seen.has(key)) {
            seen.add(key);
            uniqueHighlights.push(h);
          }
        }

        return uniqueHighlights.map((h: any) => ({
          ...h,
          id: String(h?._id || h?.id || ''),
          title: h?.title || h?.name || 'Highlight',
          coverImage: h?.coverImage || h?.cover || h?.image || h?.imageUrl || '',
        })).filter((h: any) => !!h.id);
      } catch (error: any) {
        if (error.response?.status === 404) return [];
        throw error;
      }
    },
    enabled: enabled && !!viewedUserId && canViewPrivateProfile,
    staleTime: 1000 * 60 * 5,
  });

  // 8. Fetch Liked Posts (if viewing own profile)
  const likedPostsQuery = useQuery({
    queryKey: ['profileLikedPosts', viewedUserId],
    queryFn: async () => {
      if (!viewedUserId) return [];
      try {
        const res = await apiService.get(`/users/${viewedUserId}/liked-posts`);
        return res?.success && Array.isArray(res.data) ? res.data : [];
      } catch (error: any) {
        if (error.response?.status === 404) return [];
        throw error;
      }
    },
    enabled: enabled && !!viewedUserId && isOwnProfile,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 60 * 24,
  });

  return {
    profile: profileQuery.data,
    posts: postsQuery.data || [],
    sections: sectionsQuery.data || [],
    userStories: storiesQuery.data || [],
    savedSectionPosts: savedPostsQuery.data || [],
    taggedPosts: taggedPostsQuery.data || [],
    likedPosts: likedPostsQuery.data || [],
    highlights: highlightsQuery.data || [],
    isLoading: profileQuery.isPending && !profileQuery.data,
    isError: profileQuery.isError,
    isRefetching: profileQuery.isFetching && !!profileQuery.data,
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
    }
  };
}
