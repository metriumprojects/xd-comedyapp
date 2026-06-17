import { useQuery } from '@tanstack/react-query';
import { apiService } from '@/src/_services/apiService';
import { fetchBlockedUserIds } from '@/services/moderation';

interface UseProfileDataParams {
  viewedUserId: string | undefined;
  currentUserId: string | null;
  enabled: boolean;
}

export function useProfileData({ viewedUserId, currentUserId, enabled }: UseProfileDataParams) {
  // 1. Fetch Aggregated Profile Data
  const profileQuery = useQuery({
    queryKey: ['profile', viewedUserId, currentUserId],
    queryFn: async () => {
      if (!viewedUserId) return null;

      // Mock fallbacks for seeded subscription users
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

      const [blockedSet, profileRes] = await Promise.all([
        currentUserId ? fetchBlockedUserIds(currentUserId) : Promise.resolve(new Set<string>()),
        apiService.get(`/users/${viewedUserId}/aggregated`, { requesterUserId: currentUserId }),
      ]);
      
      if (!profileRes.success || !profileRes.data) {
        throw new Error(profileRes.error || 'Failed to fetch profile');
      }
      return profileRes.data;
    },
    enabled: enabled && !!viewedUserId,
    staleTime: 1000 * 60 * 5, // 5 minutes cache
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
      return res?.success && Array.isArray(res.data) ? res.data : [];
    },
    enabled: enabled && !!viewedUserId && canViewPrivateProfile,
    staleTime: 1000 * 60 * 2,
  });

  // 3. Fetch User Sections (Collections)
  const sectionsQuery = useQuery({
    queryKey: ['profileSections', viewedUserId],
    queryFn: async () => {
      if (!viewedUserId) return [];
      const res = await apiService.get(`/users/${viewedUserId}/sections`, { viewerId: currentUserId });
      return res?.success && Array.isArray(res.data) ? res.data : [];
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
    staleTime: 1000 * 60 * 10,
  });

  // 7. Fetch Highlights
  const highlightsQuery = useQuery({
    queryKey: ['profileHighlights', viewedUserId],
    queryFn: async () => {
      if (!viewedUserId) return [];
      try {
        const res = await apiService.get(`/users/${viewedUserId}/highlights`);
        return res?.success && Array.isArray(res.data) ? res.data : [];
      } catch (error: any) {
        if (error.response?.status === 404) return [];
        throw error;
      }
    },
    enabled: enabled && !!viewedUserId && canViewPrivateProfile,
    staleTime: 1000 * 60 * 5,
  });

  return {
    profile: profileQuery.data,
    posts: postsQuery.data || [],
    sections: sectionsQuery.data || [],
    userStories: storiesQuery.data || [],
    savedSectionPosts: savedPostsQuery.data || [],
    taggedPosts: taggedPostsQuery.data || [],
    highlights: highlightsQuery.data || [],
    isLoading: profileQuery.isLoading,
    isRefetching: profileQuery.isRefetching,
    refetchAll: async () => {
      await Promise.all([
        profileQuery.refetch(),
        postsQuery.refetch(),
        sectionsQuery.refetch(),
        storiesQuery.refetch(),
        taggedPostsQuery.refetch(),
        highlightsQuery.refetch(),
        isOwnProfile ? savedPostsQuery.refetch() : Promise.resolve(),
      ]);
    }
  };
}
