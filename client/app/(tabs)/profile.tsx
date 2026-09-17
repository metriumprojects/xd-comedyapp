import { Feather, Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@/lib/storage';
import { Image as ExpoImage } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
// Firebase removed - using Backend API
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { safeRouterBack } from '@/lib/safeRouterBack';
import { useAppDialog } from '@/src/_components/AppDialogProvider';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { API_BASE_URL, BACKEND_URL } from '../../lib/api';
import { createStory, getUserHighlights, getUserSectionsSorted, getUserStories } from '../../lib/firebaseHelpers';
import { followUser, sendFollowRequest, unfollowUser } from '../../lib/firebaseHelpers/follow';
import { likePost, unlikePost } from '../../lib/firebaseHelpers/post';
import { getOptimizedImageUrl } from '../../lib/imageHelpers';
import { buildProfileDeepLink, buildProfileWebLink, sharePost, shareProfile } from '../../lib/postShare';

import { userService } from '../../lib/userService';
import { fetchBlockedUserIds, filterOutBlocked } from '../../services/moderation';
import HighlightCarousel from '@/src/_components/HighlightCarousel';
import StoriesViewer from '@/src/_components/StoriesViewer';
import { useQueryClient } from '@tanstack/react-query';
import { useHeaderVisibility, useHeaderHeight } from './_layout';

import { getTaggedPosts, getUserHighlights as getUserHighlightsAPI, getUserPosts as getUserPostsAPI, getUserProfile as getUserProfileAPI, getUserSections as getUserSectionsAPI } from '@/src/_services/firebaseService';
import { apiService } from '@/src/_services/apiService';
import { getKeyboardOffset, getModalHeight } from '@/utils/responsive';
import { getPassportData } from '../../lib/firebaseHelpers/passport';
import { feedEventEmitter } from '@/lib/feedEventEmitter';
import { useAssetPreloader } from '@/hooks/useAssetPreloader';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ResizeMode, Video } from 'expo-av';
import { resolveCanonicalUserId } from '../../lib/currentUser';
import { hapticLight, hapticMedium } from '../../lib/haptics';
import { getCachedData, setCachedData, useNetworkStatus, useOfflineBanner } from '../../hooks/useOffline';

// Shared Utilities & Components
import { normalizeMediaUrl, normalizeAvatarUrl, isVideoUrl } from '../../lib/utils/media';
import { toDate, getRelativeTime } from '../../lib/utils/date';
import ProfileGridItem from '@/src/_components/profile/ProfileGridItem';
import { ProfilePostMarker } from '@/src/_components/profile/ProfilePostMarker';

import ProfileHeader from '@/src/_components/profile/ProfileHeader';
import ProfileStats from '@/src/_components/profile/ProfileStats';
import COLORS from '@/src/theme/colors';

import ProfileSections from '@/src/_components/profile/ProfileSections';
import ProfileModals from '@/src/features/profile/components/ProfileModals';
import ProfileGrid from '@/src/features/profile/components/ProfileGrid';
import { useProfileActions } from '@/hooks/useProfileActions';
import { useProfileData } from '@/src/features/profile/hooks/useProfileData';
import { SubscriptionModal } from '@/src/_components/profile/SubscriptionModal';
import { subscriptionService } from '@/src/_services/subscriptionService';
import { ProfileSkeleton } from '@/src/_components/profile/ProfileSkeleton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const isSmallDevice = SCREEN_HEIGHT < 700;

const responsiveValues = {
  imageHeight: isSmallDevice ? 240 : 340,
  titleSize: isSmallDevice ? 16 : 18,
  labelSize: isSmallDevice ? 13 : 14,
  inputSize: isSmallDevice ? 14 : 15,
  spacing: isSmallDevice ? 12 : 16,
  spacingLarge: isSmallDevice ? 16 : 20,
  inputHeight: isSmallDevice ? 44 : 48,
  modalPadding: isSmallDevice ? 20 : 20,
};

const MapView = Platform.OS === 'web' ? null : require('react-native-maps').default;
const Marker = Platform.OS === 'web' ? null : require('react-native-maps').Marker;

// Default avatar URL
import { DEFAULT_AVATAR_URL } from '@/lib/api';
const DEFAULT_IMAGE_URL = DEFAULT_AVATAR_URL;
const DEFAULT_AVATAR_SOURCE = { uri: DEFAULT_AVATAR_URL };

function getInitials(nameOrUsername: any): string {
  if (typeof nameOrUsername !== 'string') return 'U';
  const cleaned = nameOrUsername.trim();
  if (!cleaned) return 'U';

  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
}

function normalizeExternalUrl(input: any): string | null {
  if (typeof input !== 'string') return null;
  const raw = input.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (lower.startsWith('http://') || lower.startsWith('https://')) return raw;
  return `https://${raw}`;
}

function isObjectLike(value: any): value is Record<string, any> {
  return value !== null && typeof value === 'object';
}

type ProfileLinkPlatform =
  | 'facebook'
  | 'instagram'
  | 'twitter'
  | 'whatsapp'
  | 'youtube'
  | 'linkedin'
  | 'website'
  | 'unknown';

function splitProfileLinks(raw: any): string[] {
  if (typeof raw !== 'string') return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];
  return trimmed
    .split(/[\n,]+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function getUrlHost(url: string): string | null {
  try {
    const normalized = normalizeExternalUrl(url) || url;
    const withoutProto = normalized.replace(/^https?:\/\//i, '');
    const host = withoutProto.split('/')[0]?.trim();
    return host || null;
  } catch {
    return null;
  }
}

function detectProfileLinkPlatform(url: string): ProfileLinkPlatform {
  const host = (getUrlHost(url) || '').toLowerCase();
  if (!host) return 'unknown';
  if (host.includes('facebook.com') || host.includes('fb.com') || host.includes('fb.me')) return 'facebook';
  if (host.includes('instagram.com')) return 'instagram';
  if (host.includes('twitter.com') || host.includes('x.com')) return 'twitter';
  if (host.includes('whatsapp.com') || host.includes('wa.me')) return 'whatsapp';
  if (host.includes('youtube.com') || host.includes('youtu.be')) return 'youtube';
  if (host.includes('linkedin.com')) return 'linkedin';
  return 'website';
}

function getFaviconUrl(url: string): string {
  return `https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(url)}`;
}

// Utility to parse/sanitize coordinates
function parseCoord(val: any): number | null {
  if (typeof val === 'number' && isFinite(val)) return val;
  if (typeof val === 'string') {
    const n = parseFloat(val);
    return isFinite(n) ? n : null;
  }
  return null;
}

// isVideoUrl is imported from ../../lib/utils/media

// Types
type Highlight = {
  id: string;
  title: string;
  coverImage: string;
  stories: { id: string; image: string }[];
};

type ProfileData = {
  id: string;
  uid: string;
  name?: string;
  displayName?: string;  // Backend returns displayName, not name
  username?: string;
  email: string;
  avatar?: string;
  photoURL?: string;  // Firebase field name
  bio?: string;
  website?: string;
  location?: string;
  phone?: string;
  interests?: string;
  followersCount?: number;
  followingCount?: number;
  postsCount?: number;
  locationsCount?: number;
  followers?: string[];
  following?: string[];
  isPrivate?: boolean;
  approvedFollowers?: string[];
  isApprovedFollower?: boolean;
  followRequestPending?: boolean;
  firebaseUid?: string;  // Backend field
};

function getPostId(post: any): string {
  if (!post) return '';
  const id = post.id ?? post._id;
  return typeof id === 'string' ? id : String(id ?? '');
}

export default function Profile({ userIdProp }: any) {
  // Constants
  const insets = useSafeAreaInsets();
  const POSTS_PER_PAGE = 12;

  // State and context
  const [storiesViewerVisible, setStoriesViewerVisible] = useState(false);
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [selectedTierForModal, setSelectedTierForModal] = useState<string | undefined>(undefined);
  /** Instagram-style: tap profile photo to view full-screen (when not opening stories). */
  const [avatarPreviewUri, setAvatarPreviewUri] = useState<string | null>(null);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [userMenuVisible, setUserMenuVisible] = useState(false);
  const [highlightViewerVisible, setHighlightViewerVisible] = useState(false);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [createHighlightVisible, setCreateHighlightVisible] = useState(false);
  const [creatorTiers, setCreatorTiers] = useState<any[]>([]);
  const [activeSubscribedTierIds, setActiveSubscribedTierIds] = useState<string[]>([]);
  const [userSubscriptions, setUserSubscriptions] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserUidAlias, setCurrentUserUidAlias] = useState<string | null>(null);
  const [currentUserFirebaseAlias, setCurrentUserFirebaseAlias] = useState<string | null>(null);
  const [authResolved, setAuthResolved] = useState(false);
  const router = useRouter();
  const { showSuccess } = useAppDialog();
  const params = useLocalSearchParams();

  // Get current user ID and aliases from AsyncStorage (token-based auth)
  useEffect(() => {
    const getUserId = async () => {
      try {
        const [userId, uid, firebaseUid] = await Promise.all([
          resolveCanonicalUserId(),
          AsyncStorage.getItem('uid'),
          AsyncStorage.getItem('firebaseUid'),
        ]);
        setCurrentUserId(userId);
        if (uid) setCurrentUserUidAlias(uid);
        if (firebaseUid) setCurrentUserFirebaseAlias(firebaseUid);
      } catch (error) {}
      finally {
        setAuthResolved(true);
      }
    };
    getUserId();
  }, []);

  // Extract viewedUserId - handle all parameter variants across the app
  let viewedUserId: string | undefined;
  if (userIdProp) {
    viewedUserId = userIdProp;
  } else if (params.id) {
    viewedUserId = Array.isArray(params.id) ? params.id[0] : params.id;
  } else if (params.uid) {
    viewedUserId = Array.isArray(params.uid) ? params.uid[0] : params.uid;
  } else if (params.user) {
    viewedUserId = Array.isArray(params.user) ? params.user[0] : params.user;
  } else {
    viewedUserId = currentUserId || undefined;
  }

  // Avoid noisy logs on a hot screen

  // Determine if viewing own profile - compare IDs or check if no explicit user passed
  const selfIds = new Set(
    [currentUserId, currentUserUidAlias, currentUserFirebaseAlias]
      .filter(Boolean)
      .map((v) => String(v))
  );
  const isOwnProfile = (viewedUserId && selfIds.has(String(viewedUserId))) || (!userIdProp && !params.user && selfIds.size > 0);

  if (viewedUserId && selfIds.has(String(viewedUserId)) && currentUserId && viewedUserId !== currentUserId) {
    viewedUserId = currentUserId;
  }

  // Avoid noisy logs on a hot screen

  const [segmentTab, setSegmentTab] = useState<'grid' | 'tagged' | 'heart' | 'star' | 'stats'>('grid');

  // ── Centralized Data Hook ──
  const {
    profile,
    posts,
    sections,
    userStories,
    savedSectionPosts,
    taggedPosts,
    likedPosts: fetchedLikedPosts,
    highlights,
    isLoading: profileLoading,
    isError: profileIsError,
    refetchAll
  } = useProfileData({
    viewedUserId: viewedUserId as string,
    currentUserId,
    enabled: !!viewedUserId,
    activeTab: segmentTab,
  });

  const [initialStoryIndex, setInitialStoryIndex] = useState(0);
  const storyOpenedRef = useRef(false);

  // Auto-open story viewer if navigated from notification with openStory=true or storyId
  useEffect(() => {
    const shouldOpenStory = params.openStory === 'true' || !!params.storyId;
    if (shouldOpenStory && !storyOpenedRef.current && userStories && userStories.length > 0) {
      storyOpenedRef.current = true;
      if (params.storyId) {
        const targetStoryId = String(params.storyId);
        const foundIdx = userStories.findIndex((s: any) => String(s._id || s.id) === targetStoryId);
        if (foundIdx >= 0) {
          setInitialStoryIndex(foundIdx);
        }
      }
      setStoriesViewerVisible(true);
    }
  }, [params.openStory, params.storyId, userStories]);

  useAssetPreloader(posts, (item: any) => [
    item.imageUrl, 
    item.thumbnailUrl, 
    item.media?.[0]?.url,
    item.userAvatar
  ].filter(Boolean));

  const loading = profileLoading;
  const awaitingOwnUserId = authResolved && isOwnProfile && !viewedUserId && !userIdProp && !params.user && !params.uid && !params.id;
  const showProfileSkeleton = !profile && (!authResolved || awaitingOwnUserId || profileLoading);
  const showProfileError = authResolved && !!viewedUserId && !profileLoading && !profile && profileIsError;
  const passportLocationsCount = Number(profile?.passportCount ?? profile?.locationsCount ?? 0);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [postViewerVisible, setPostViewerVisible] = useState<boolean>(false);
  const [selectedPostIndex, setSelectedPostIndex] = useState<number>(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const [editSectionsModal, setEditSectionsModal] = useState<boolean>(false);
  const [viewCollectionsModal, setViewCollectionsModal] = useState<boolean>(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [likedPosts, setLikedPosts] = useState<{ [key: string]: boolean }>({});
  const [savedPosts, setSavedPosts] = useState<{ [key: string]: boolean }>({});
  const [commentModalVisible, setCommentModalVisible] = useState(false);
  const [commentModalPostId, setCommentModalPostId] = useState<string>('');
  const [commentModalAvatar, setCommentModalAvatar] = useState<string>('');
  const { isOnline } = useNetworkStatus();
  const PROFILE_CACHE_KEY = useMemo(
    () => `profile_v3_${String(viewedUserId || 'unknown')}_${String(currentUserId || 'anon')}`,
    [viewedUserId, currentUserId]
  );

  const { hideHeader, showHeader } = useHeaderVisibility();
  const [refreshing, setRefreshing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [creatorHasTier, setCreatorHasTier] = useState(false);
  const [subscriptionTitle, setSubscriptionTitle] = useState<string>('Subscription');

  // Combined effect to load creator's tiers and user's subscription status
  useEffect(() => {
    const loadSubscriptionData = async () => {
      const creatorId = profile?._id || profile?.id || viewedUserId;
      if (!creatorId) return;

      try {
        // 1. Load creator's subscription tiers (backend returns active + archived
        // that still have posts/subscribers). Keep all in creatorTiers so archived
        // folders still render for owner + existing subscribers, but only count
        // ACTIVE tiers for the "hasTier" UI signals (star icon, subscribe button, etc.).
        const tiersResponse = await subscriptionService.getTiers(creatorId);
        if (tiersResponse.success && Array.isArray(tiersResponse.data)) {
          setCreatorTiers(tiersResponse.data);
          const activeOnly = tiersResponse.data.filter((t: any) => !(t?.isArchived || t?.isActive === false));
          setCreatorHasTier(activeOnly.length > 0);
          if (activeOnly.length > 0) {
            setSubscriptionTitle(activeOnly[0].title || 'Subscription');
          }
          await AsyncStorage.setItem(`sub_tiers_${creatorId}`, JSON.stringify(tiersResponse.data));
        }

        // 2. Load active subscribed tier IDs for the current user
        if (currentUserId && currentUserId !== creatorId) {
          const statusResponse = await subscriptionService.checkSubscriptionStatus(creatorId);
          if (statusResponse.success && statusResponse.data) {
            const freshSubscribed = statusResponse.data.isSubscribed;
            setIsSubscribed(freshSubscribed);
            
            const activeTiers = statusResponse.data.activeTierIds || [];
            setActiveSubscribedTierIds(activeTiers);
            setUserSubscriptions(statusResponse.data.subscriptions || []);

            // Sync cache
            await AsyncStorage.setItem(`sub_subscribed_${currentUserId}_to_${creatorId}`, freshSubscribed ? 'true' : 'false');
            for (const tierId of activeTiers) {
              await AsyncStorage.setItem(`sub_subscribed_${currentUserId}_to_tier_${tierId}`, 'true');
            }
          }
        }
      } catch (e) {
        console.warn('[Profile] Error loading subscription data:', e);
      }
    };

    loadSubscriptionData();
  }, [currentUserId, viewedUserId, profile?._id, profile?.id, subModalVisible]);

  // Listen for real-time subscription changes on profile page
  useEffect(() => {
    const creatorId = profile?._id || profile?.id || viewedUserId;
    if (!creatorId || isOwnProfile) return;
    const unsub = feedEventEmitter.onFeedUpdate(async (event) => {
      if (event.type === 'USER_SUBSCRIBED' && String(event.userId).toLowerCase() === String(creatorId).toLowerCase()) {
        try {
          const statusResponse = await subscriptionService.checkSubscriptionStatus(creatorId);
          if (statusResponse.success) {
            setIsSubscribed(statusResponse.data.isSubscribed);
            setActiveSubscribedTierIds(statusResponse.data.activeTierIds || []);
            setUserSubscriptions(statusResponse.data.subscriptions || []);
          } else {
            setIsSubscribed(true);
          }
        } catch (e) {
          setIsSubscribed(true);
        }
      }
    });
    return () => unsub();
  }, [viewedUserId, profile?._id, profile?.id, isOwnProfile]);

  // Listen for feed/stories/highlight/follow updates to refetch profile state
  useEffect(() => {
    const sub = feedEventEmitter.addListener('feedUpdated', () => {
      refetchAll().catch(() => {});
    });

    const unsubFeed = feedEventEmitter.onFeedUpdate((event) => {
      if (
        event.type === 'HIGHLIGHT_DELETED' ||
        event.type === 'POST_DELETED' ||
        event.type === 'POST_CREATED' ||
        event.type === 'USER_FOLLOW_CHANGED'
      ) {
        refetchAll().catch(() => {});
      }
    });

    return () => {
      sub.remove();
      unsubFeed();
    };
  }, [refetchAll]);

  // Reset tab to grid if viewing another user's profile and currently on a private/creator tab
  useEffect(() => {
    if (!isOwnProfile && (segmentTab === 'star' || segmentTab === 'stats' || segmentTab === 'heart')) {
      setSegmentTab('grid');
    }
  }, [isOwnProfile, segmentTab]);

  // Story Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchAll();
    setRefreshing(false);
  }, [refetchAll]);

  // Header padding is handled by Tabs sceneStyle (see (tabs)/_layout.tsx)
  const headerHeight = 0;

  // Always show the TopMenu when this tab gains focus
  // (fixes: header stays hidden if Home screen hid it before user switches to Profile)
  useFocusEffect(
    useCallback(() => {
      showHeader();
      headerHiddenRef.current = false;
    }, [showHeader])
  );

  const lastScrollYRef = useRef(0);
  const lastEmitTsRef = useRef(0);
  const headerHiddenRef = useRef(false);

  // Handle return from story-creator
  useEffect(() => {
    const uri = params?.storyMediaUri != null ? String(params.storyMediaUri) : '';
    const type = params?.storyMediaType != null ? String(params.storyMediaType) : 'photo';
    if (!uri) return;
    setSelectedMedia({ uri, type });
    setShowUploadModal(true);
  }, [params?.storyMediaUri]);

  // Location suggestions for stories
  useEffect(() => {
    if (locationQuery.length < 2) {
      setLocationSuggestions([]);
      return;
    }
    setLoadingLocations(true);
    const timer = setTimeout(async () => {
      try {
        const { mapService } = require('../../services');
        const suggestions = await mapService.getAutocompleteSuggestions(locationQuery);
        const predictions = suggestions.map((s: any) => ({
          placeId: s.placeId,
          name: s.mainText || s.description || 'Location',
          address: s.description || '',
        }));
        setLocationSuggestions(predictions);
      } catch (err) {
        setLocationSuggestions([]);
      } finally {
        setLoadingLocations(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [locationQuery]);

  const handleAddStory = () => {
    if (!currentUserId) {
      Alert.alert('Login required', 'Please login to create a story');
      return;
    }
    hapticLight();
    router.push('/story-creator' as any);
  };

  const sectionSourcePosts = useMemo(() => {
    return posts;
  }, [posts]);

  const subscriptionPosts = useMemo(() => {
    return posts.filter((p: any) => p.visibility === 'Subscribers');
  }, [posts]);

  // One subscription folder per tier: each tier renders as its own box with
  // its own title, its own cover, and only the posts that belong to that tier.
  const tierSections = useMemo(() => {
    const tiers = Array.isArray(creatorTiers) ? creatorTiers : [];
    if (tiers.length === 0) {
      // Backward-compat: if we know the creator has a tier but tiers detail
      // hasn't loaded yet, still show a single subscription folder so the box
      // doesn't disappear briefly on refresh.
      if (creatorHasTier || subscriptionPosts.length > 0) {
        return [{
          _id: 'subscription-folder',
          tierId: null,
          name: subscriptionTitle || 'Subscription',
          postIds: subscriptionPosts.map((p: any) => getPostId(p)),
          coverImage:
            subscriptionPosts[0]?.imageUrl ||
            subscriptionPosts[0]?.mediaUrl ||
            subscriptionPosts[0]?.media?.[0]?.url ||
            subscriptionPosts[0]?.mediaUrls?.[0] ||
            DEFAULT_IMAGE_URL,
          visibility: 'public',
          isSubscriptionFolder: true,
        }];
      }
      return [];
    }

    return tiers.map((tier: any) => {
      const tierId = String(tier?._id || '');
      const tierPosts = subscriptionPosts.filter(
        (p: any) => String(p?.subscriptionTierId || '') === tierId
      );
      const firstPost = tierPosts[0];
      const isArchived = tier?.isArchived === true || tier?.isActive === false;
      return {
        _id: `subscription-folder-${tierId || tier?.title || Math.random()}`,
        tierId,
        name: tier?.title || 'Subscription',
        postIds: tierPosts.map((p: any) => getPostId(p)),
        coverImage:
          firstPost?.imageUrl ||
          firstPost?.mediaUrl ||
          firstPost?.media?.[0]?.url ||
          firstPost?.mediaUrls?.[0] ||
          DEFAULT_IMAGE_URL,
        visibility: 'public',
        isSubscriptionFolder: true,
        isArchived,
      };
    });
  }, [creatorTiers, subscriptionPosts, creatorHasTier, subscriptionTitle]);

  const isSubscriptionSectionSelected = useMemo(() => {
    if (!selectedSection) return false;
    return tierSections.some((t: any) => t.name === selectedSection);
  }, [selectedSection, tierSections]);

  const selectedTierSection = useMemo(() => {
    if (!selectedSection) return null;
    return tierSections.find((t: any) => t.name === selectedSection) || null;
  }, [selectedSection, tierSections]);

  const mergedSections = useMemo(() => {
    // Own profile: show all sections so tapping a private/specific collection works.
    // Other profiles: only public collections (or ones the viewer collaborates on).
    // IMPORTANT: always spread into a new array. Returning the `sections` reference
    // for own-profile and then mutating it (unshift) produced duplicate boxes on
    // re-renders — always build a fresh list.
    const base = isOwnProfile
      ? [...(sections || [])]
      : (sections || []).filter((s: any) => {
          if (s.visibility === 'public') return true;
          const collaborators = Array.isArray(s.collaborators) ? s.collaborators : [];
          const viewerId = String(currentUserId || '');
          return collaborators.some((c: any) => {
            const cid = typeof c === 'string' ? c : (c.userId || c.uid || c._id || c.firebaseUid);
            return String(cid) === viewerId;
          });
        });

    // Strip any subscription-folder entries that were mutated into `sections`
    // by the previous buggy code path — those should always come from tierSections.
    const cleaned = base.filter(
      (s: any) =>
        !s?.isSubscriptionFolder &&
        !(typeof s?._id === 'string' && s._id.startsWith('subscription-folder'))
    );

    const list: any[] = [...tierSections];

    // Dedupe user-created sections by _id and by name; also skip any section
    // whose name matches a subscription tier so we don't render duplicates.
    const seenIds = new Set<string>();
    const seenNames = new Set<string>(
      tierSections.map((t: any) => String(t.name || '').toLowerCase()).filter(Boolean)
    );
    for (const s of cleaned) {
      const idKey = s?._id ? String(s._id) : '';
      const nameKey = s?.name ? String(s.name).toLowerCase() : '';
      if (idKey && seenIds.has(idKey)) continue;
      if (nameKey && seenNames.has(nameKey)) continue;
      if (idKey) seenIds.add(idKey);
      if (nameKey) seenNames.add(nameKey);
      list.push(s);
    }

    return list;
  }, [sections, tierSections, isOwnProfile, currentUserId]);

  const defaultGridPosts = useMemo(() => {
    if (isOwnProfile) {
      return posts.filter((p: any) => p.visibility !== 'Subscribers');
    }
    return posts.filter((p: any) => {
      if (p.visibility !== 'Subscribers') return true;
      if (p.subscriptionTierId && activeSubscribedTierIds.includes(String(p.subscriptionTierId))) {
        return true;
      }
      return false;
    });
  }, [posts, isOwnProfile, activeSubscribedTierIds]);

  const visiblePosts = useMemo(() => {
    if (!selectedSection) return defaultGridPosts;

    // If a specific tier folder is selected, show only that tier's posts.
    if (isSubscriptionSectionSelected) {
      if (!selectedTierSection?.tierId) return subscriptionPosts;
      const tierIdStr = String(selectedTierSection.tierId);
      return subscriptionPosts.filter(
        (p: any) => String(p?.subscriptionTierId || '') === tierIdStr
      );
    }

    const section = mergedSections.find((s: any) => s.name === selectedSection);

    // Section not resolvable (stale/removed) — show empty grid so the user gets clear "no posts" feedback
    // instead of the default profile grid, which would look like the click did nothing.
    if (!section) return [];

    // Backend populates full post documents inside the section — use those directly.
    // This lets us render posts saved from other users (their posts aren't in the current user's `posts`).
    if (Array.isArray(section.posts) && section.posts.length > 0) {
      return section.posts;
    }

    const postIds = Array.isArray(section.postIds) ? section.postIds : [];
    if (postIds.length === 0) return [];

    return posts.filter((p: any) => postIds.includes(getPostId(p)));
  }, [selectedSection, isSubscriptionSectionSelected, selectedTierSection, defaultGridPosts, subscriptionPosts, mergedSections, posts]);

  // Whether a non-subscription section is selected and resolved to zero posts.
  const isSelectedSectionEmpty = useMemo(() => {
    if (!selectedSection || isSubscriptionSectionSelected) return false;
    return visiblePosts.length === 0;
  }, [selectedSection, isSubscriptionSectionSelected, visiblePosts]);

  const PROFILE_MAP_ENABLED = false;

  useEffect(() => {
    if (!PROFILE_MAP_ENABLED && (segmentTab as string) === 'map') {
      setSegmentTab('grid');
    }
  }, [PROFILE_MAP_ENABLED, segmentTab]);

  // Hook for actions
  const queryClient = useQueryClient();
  const {
    followLoading: actionFollowLoading,
    handleFollowToggle,
    handleMessage: hookHandleMessage,
    handleLikePost,
    handleBlockUser
  } = useProfileActions({
    currentUserId,
    viewedUserId: viewedUserId ?? null,
    isOwnProfile,
    isPrivate: !!profile?.isPrivate,
    isFollowing: !!profile?.isFollowing,
    setIsFollowing: (val: boolean) => {
      queryClient.setQueryData(['profile', viewedUserId, currentUserId], (old: any) => {
        if (!old) return old;
        const currentCount = Number(old.followersCount ?? old.followers ?? 0);
        return {
          ...old,
          isFollowing: val,
          followersCount: val ? currentCount + 1 : Math.max(0, currentCount - 1),
        };
      });
    },
    setProfile: (val: any) => {
      queryClient.setQueryData(['profile', viewedUserId, currentUserId], (old: any) => {
        if (typeof val === 'function') return val(old);
        return val ? { ...old, ...val } : old;
      });
    },
    setApprovedFollower: () => {}, 
    setFollowRequestPending: () => {},
    likedPosts,
    setLikedPosts,
    savedPosts,
    setSavedPosts,
    router
  });

  // Sync loading state
  useEffect(() => {
    setFollowLoading(actionFollowLoading);
  }, [actionFollowLoading]);

  const handleMessage = () => {
    hookHandleMessage(profile, !!profile?.isApprovedFollower);
  };

  const handleSavePost = async (post: any) => {
    if (!currentUserId || !post?.id) return;
    const isSaved = savedPosts[post.id];
    setSavedPosts((prev: any) => ({ ...prev, [post.id]: !isSaved }));
  };

  const handleSharePost = async (post: any) => {
    try {
      await sharePost(post);
    } catch (e) {
      if (__DEV__) console.log('Share error:', e);
    }
  };

  // Report user handler
  const handleReportUser = () => {
    setUserMenuVisible(false);
    Alert.alert(
      'Report User',
      'What would you like to report?',
      [
        { text: 'Spam', onPress: () => submitReport('spam') },
        { text: 'Inappropriate Content', onPress: () => submitReport('inappropriate') },
        { text: 'Harassment', onPress: () => submitReport('harassment') },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const submitReport = async (reason: string) => {
    if (!currentUserId || !viewedUserId) return;

    try {
      // Report user via backend API
      const success = await userService.reportUser(
        viewedUserId,
        currentUserId,
        reason
      );

      if (success) {
        Alert.alert('Report Submitted', 'Thank you for your report. We will review it shortly.');
      } else {
        throw new Error('Report request failed');
      }
    } catch (error) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  // Add missing highlight handler
  const handlePressHighlight = (highlight: Highlight) => {
    setSelectedHighlightId(highlight.id);
    setHighlightViewerVisible(true);
  };

  // Effects handled by useProfileData hook

  const handleAvatarPick = async () => {
    try {
      // Pick image
      const picker = require('expo-image-picker');
      const result = await picker.launchImageLibraryAsync({
        mediaTypes: picker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
        base64: false
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri && currentUserId) {
        try {
          const { uploadImage: uploadImageFn, updateUserProfile } = require('../../lib/firebaseHelpers');
          const imageUri = result.assets[0].uri;

          if (!imageUri) {
            Alert.alert('Error', 'Image URI is invalid');
            return;
          }

          const uploadRes = await uploadImageFn(imageUri, `avatars/${currentUserId}`);

          if (uploadRes.success && uploadRes.url) {
            // Update backend profile
            const updateRes = await updateUserProfile(currentUserId, { avatar: uploadRes.url });
            if (updateRes.success) {
              // 4. Manual Refetch (Pull to Refresh)
              await refetchAll(); // Refresh data to show new avatar
              await AsyncStorage.setItem('userAvatar', String(uploadRes.url));
              showSuccess('Profile picture updated!');
            } else {
              Alert.alert('Error', 'Failed to update profile avatar: ' + (updateRes.error || 'Unknown error'));
            }
          } else {
            Alert.alert('Error', 'Image upload failed: ' + (uploadRes.error || 'Unknown error'));
          }
        } catch (uploadError: any) {
          console.error('Avatar upload error:', uploadError);
          Alert.alert('Error', 'Error uploading image: ' + uploadError.message);
        }
      }
    } catch (error: any) {
      console.error('Image picker error:', error);
      Alert.alert('Error', 'Error picking image: ' + error.message);
    }
  };

  // Listen for feed updates (refetch if something changed)
  useEffect(() => {
    const unsub = feedEventEmitter.onFeedUpdate(() => {
      refetchAll();
    });
    const sub = feedEventEmitter.addListener('feedUpdated', () => {
      refetchAll();
    });
    return () => {
      unsub();
      sub.remove();
    };
  }, [refetchAll]);


  const renderProfileHeader = useMemo(() => {
    return (
      <View style={styles.content}>
        {/* Edit Button Bubble & Profile Header */}
        <View style={{ position: 'relative' }}>
          <ProfileHeader 
            profile={profile}
            userStories={userStories}
            isOwnProfile={isOwnProfile}
            isPrivate={!!profile?.isPrivate}
            approvedFollower={!!profile?.isApprovedFollower}
            hasSubscriptionTier={isOwnProfile ? true : creatorHasTier}
            onPressAvatar={() => {
              hapticLight();
              if (userStories.length > 0) {
                setStoriesViewerVisible(true);
              } else if (isOwnProfile) {
                handleAddStory();
              }
            }}
            onAddStory={handleAddStory}
            onPressPassport={() => {
              hapticLight();
              router.push({ pathname: '/passport', params: { user: viewedUserId } } as any);
            }}
            onEditProfile={() => {
              hapticLight();
              router.push({ pathname: '/edit-profile', params: { userId: viewedUserId } } as any);
            }}
            onManageSubscription={() => {
              hapticLight();
              setSubModalVisible(true);
            }}
            onSubscribe={() => {
              hapticLight();
              setSubModalVisible(true);
            }}
            isFollowing={!!profile?.isFollowing}
            followRequestPending={!!profile?.followRequestPending}
            followLoading={followLoading}
            onFollowToggle={handleFollowToggle}
            onMessage={handleMessage}
            followersCount={Math.max(0, Number(profile?.followersCount ?? profile?.followers ?? 0))}
            followingCount={Math.max(0, Number(profile?.followingCount ?? profile?.following ?? 0))}
            onPressFollowers={() => {
              router.push(`/friends?userId=${viewedUserId}&tab=followers` as any);
            }}
            onPressFollowing={() => {
              router.push(`/friends?userId=${viewedUserId}&tab=following` as any);
            }}
            postsCount={Number(profile?.postsCount ?? posts.length)}
            laughsCount={Number(profile?.laughsCount || 0)}
            isSubscribed={isSubscribed}
          />
        </View>

        {/* Highlights Carousel */}
        {(!profile?.isPrivate || isOwnProfile || !!profile?.isApprovedFollower) && highlights && (highlights.length > 0 || isOwnProfile) && (
          <View style={{ marginTop: 14, marginBottom: 10 }}>
            <View style={{ paddingHorizontal: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={{ fontSize: 13, fontWeight: '500', color: COLORS.textMuted, letterSpacing: 0.5 }}>HIGHLIGHTS</Text>
              {isOwnProfile && (
                <TouchableOpacity 
                  style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, gap: 4 }}
                  onPress={handleAddStory}
                >
                  <Feather name="plus" size={12} color={COLORS.black} />
                  <Text style={{ fontSize: 12, fontWeight: '600', color: COLORS.black }}>Add a story</Text>
                </TouchableOpacity>
              )}
            </View>
            <HighlightCarousel 
              highlights={highlights} 
              onPressHighlight={handlePressHighlight} 
              isOwnProfile={isOwnProfile} 
              onAddHighlight={() => setCreateHighlightVisible(true)}
            />
          </View>
        )}

        {/* Clean dynamic Tab Selector Switcher */}
        {(!profile?.isPrivate || isOwnProfile || !!profile?.isApprovedFollower) && (
          <View style={styles.customProfileTabBar}>
            <TouchableOpacity 
              style={styles.customProfileTabItem}
              onPress={() => { setSegmentTab('grid'); setSelectedSection(null); }}
            >
              <Feather name="grid" size={20} color={segmentTab === 'grid' ? COLORS.primary : COLORS.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.customProfileTabItem}
              onPress={() => { setSegmentTab('tagged'); setSelectedSection(null); }}
            >
              <Feather name="user" size={20} color={segmentTab === 'tagged' ? COLORS.primary : COLORS.textMuted} />
            </TouchableOpacity>
            {isOwnProfile && (
              <TouchableOpacity 
                style={styles.customProfileTabItem}
                onPress={() => { setSegmentTab('heart'); setSelectedSection(null); }}
              >
                <Feather name="heart" size={20} color={segmentTab === 'heart' ? COLORS.primary : COLORS.textMuted} />
              </TouchableOpacity>
            )}
            {isOwnProfile && (
              <TouchableOpacity 
                style={styles.customProfileTabItem}
                onPress={() => { setSegmentTab('star'); setSelectedSection(null); }}
              >
                <Feather name="star" size={20} color={segmentTab === 'star' ? COLORS.primary : COLORS.textMuted} />
              </TouchableOpacity>
            )}
            {isOwnProfile && (
              <TouchableOpacity 
                style={styles.customProfileTabItem}
                onPress={() => { setSegmentTab('stats'); setSelectedSection(null); }}
              >
                <Ionicons name="bar-chart" size={20} color={segmentTab === 'stats' ? COLORS.primary : COLORS.textMuted} />
              </TouchableOpacity>
            )}

            {/* Real-time Sliding Orange Indicator Line */}
            {(() => {
              const activeTabsCount = isOwnProfile ? 5 : 2;
              const tabWidth = SCREEN_WIDTH / activeTabsCount;
              const indicatorTranslateX = scrollX.interpolate({
                inputRange: [0, (activeTabsCount - 1) * SCREEN_WIDTH],
                outputRange: [0, (activeTabsCount - 1) * tabWidth],
                extrapolate: 'clamp',
              });
              return (
                <Animated.View
                  style={[
                    styles.activeIndicatorLine,
                    {
                      width: tabWidth,
                      transform: [{ translateX: indicatorTranslateX }],
                    },
                  ]}
                />
              );
            })()}
          </View>
        )}
      </View>
    );
  }, [profile, userStories, isOwnProfile, profileLoading, passportLocationsCount, posts.length, highlights, highlightViewerVisible, selectedHighlightId, segmentTab, followLoading, viewedUserId, currentUserId, scrollX]);

  const currentPostsArray = useMemo(() => {
    if (segmentTab === 'grid') {
      return visiblePosts;
    }
    if (segmentTab === 'tagged') return taggedPosts;
    if (segmentTab === 'heart') {
      return fetchedLikedPosts || [];
    }
    return [];
  }, [segmentTab, visiblePosts, taggedPosts, fetchedLikedPosts, likedPosts, posts, currentUserId]);

  // UI
  // Show error if not logged in on own profile tab
  if (authResolved && !currentUserId && isOwnProfile) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 18, color: COLORS.textMuted, marginBottom: 20 }}>Please log in to view your profile</Text>
          <TouchableOpacity
            style={{ backgroundColor: COLORS.info, paddingHorizontal: 30, paddingVertical: 12, borderRadius: 8 }}
            onPress={() => {
              hapticLight();
              router.push('/login' as any);
            }}
          >
            <Text style={{ color: COLORS.textLight, fontSize: 16, fontWeight: 'bold' }}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (showProfileSkeleton) {
    return (
      <SafeAreaView style={styles.container} edges={[]}>
        <ProfileSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {/* Header for other users' profiles */}
      {!isOwnProfile && (
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingTop: 6,
          paddingBottom: 6,
          backgroundColor: COLORS.background,
          minHeight: 40,
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexShrink: 1, marginRight: 8 }}>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                safeRouterBack();
              }}
              style={[styles.headerBackBtn, { marginRight: 8 }]}
            >
              <Feather name="arrow-left" size={20} color={COLORS.black} />
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {(!profile?.isPrivate || !!profile?.isApprovedFollower) && (
              <TouchableOpacity 
                onPress={() => {
                  hapticLight();
                  handleMessage();
                }} 
                style={styles.headerMenuBtn}
              >
                <Feather name="message-circle" size={20} color={COLORS.black} strokeWidth={2.5} />
              </TouchableOpacity>
            )}
            <TouchableOpacity 
              onPress={() => { 
                hapticLight(); 
                if (isOwnProfile) {
                  feedEventEmitter.emit('openSettingsMenu');
                } else {
                  setUserMenuVisible(true); 
                }
              }} 
              style={styles.headerMenuBtn}
            >
              <Feather name="more-vertical" size={20} color={COLORS.black} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {showProfileError && (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ fontSize: 16, color: COLORS.textSecondary, marginBottom: 12 }}>Failed to load profile.</Text>
          <TouchableOpacity onPress={refetchAll} style={{ backgroundColor: COLORS.info, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 }}>
            <Text style={{ color: COLORS.textLight, fontWeight: 'bold' }}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {profile && !showProfileError && (
        <>

      {(!profile?.isPrivate || isOwnProfile || !!profile?.isApprovedFollower) ? (
        <ProfileGrid
          scrollX={scrollX}
          gridPosts={visiblePosts}
          taggedPosts={taggedPosts}
          likedPosts={fetchedLikedPosts || []}
          loading={loading}
          refreshing={refreshing}
          onRefresh={onRefresh}
          renderHeader={renderProfileHeader}
          onPressPost={(item, idx) => {
            const postCreatorId = String(item.userId?._id || item.userId || profile?._id || profile?.id || '');
            const postIsOwner = [currentUserId, currentUserFirebaseAlias, currentUserUidAlias]
              .filter(Boolean)
              .map(id => String(id).toLowerCase())
              .includes(postCreatorId.toLowerCase());

            if (item.visibility === 'Subscribers' && !postIsOwner) {
              const tierSubscribed = item.subscriptionTierId
                ? activeSubscribedTierIds.includes(String(item.subscriptionTierId))
                : isSubscribed;

              if (!tierSubscribed) {
                setSubModalVisible(true);
                return;
              }
            }

            const targetId = String(item?.id || item?._id || '');
            const modalIndex = currentPostsArray.findIndex((p: any) => String(p?.id || p?._id || '') === targetId);
            setSelectedPostIndex(modalIndex >= 0 ? modalIndex : idx);
            setPostViewerVisible(true);
          }}
          normalizeMediaUrl={normalizeMediaUrl}
          isVideoUrl={isVideoUrl}
          DEFAULT_IMAGE_URL={DEFAULT_IMAGE_URL}
          insetsBottom={insets.bottom}
          segmentTab={segmentTab}
          onSelectTab={(newTab) => {
            setSegmentTab(newTab);
            setSelectedSection(null);
          }}
          currentUserId={currentUserId}
          creatorPosts={posts}
          mergedSections={mergedSections}
          selectedSection={selectedSection}
          isSelectedSectionEmpty={isSelectedSectionEmpty}
          onSelectSection={(secName) => {
            // Per-tier folder: if the viewer isn't subscribed to THIS specific
            // tier, open the subscription modal so they can join. Archived
            // tiers can't be subscribed to anymore, so just open the folder
            // (subscribers keep access; non-subscribers see the empty/locked view).
            const targetTier = tierSections.find((t: any) => t.name === secName);
            if (targetTier && !isOwnProfile && !targetTier.isArchived) {
              const tierId = targetTier.tierId ? String(targetTier.tierId) : '';
              const subscribedToThisTier = tierId
                ? activeSubscribedTierIds.includes(tierId)
                : isSubscribed;
              if (!subscribedToThisTier) {
                setSubModalVisible(true);
              }
            }
            setSelectedSection(secName);
            if (secName) {
              setSegmentTab('grid');
            }
          }}
          subscriptionTitle={subscriptionTitle}
          isSubscribed={isSubscribed}
          activeSubscribedTierIds={activeSubscribedTierIds}
          sectionSourcePosts={sectionSourcePosts}
          getPostId={getPostId}
          isOwnProfile={isOwnProfile}
          onEditSections={() => setEditSectionsModal(true)}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          {renderProfileHeader}
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="lock-closed" size={48} color={COLORS.border} />
            <Text style={{ marginTop: 10, color: COLORS.textMuted }}>This account is private</Text>
            <Text style={{ textAlign: 'center', color: COLORS.textMuted, marginTop: 4 }}>Follow to see their posts and photos.</Text>
          </View>
        </ScrollView>
      )}

      <ProfileModals
        {...{
          viewCollectionsModal, setViewCollectionsModal, sections, selectedSection, setSelectedSection,
          postViewerVisible, setPostViewerVisible, currentPostsArray, selectedPostIndex, profile, currentUserId,
          likedPosts, savedPosts, handleLikePost, handleSavePost, handleSharePost, setCommentModalPostId, setCommentModalAvatar, setCommentModalVisible,
          avatarPreviewUri, setAvatarPreviewUri, isOwnProfile, handleAvatarPick,
          commentModalVisible, commentModalPostId, commentModalAvatar, posts, getKeyboardOffset, getModalHeight,
          viewedUserId: viewedUserId || null, editSectionsModal, setEditSectionsModal, refetchAll,
          userMenuVisible, setUserMenuVisible, handleBlockUser, handleReportUser, shareProfile,
          isSubscribed: isSubscribed || activeSubscribedTierIds.length > 0,
          onManageSubscription: () => {
            setSelectedTierForModal(undefined);
            setSubModalVisible(true);
          },
          showUploadModal, setShowUploadModal, selectedMedia, setSelectedMedia, locationQuery, setLocationQuery, locationSuggestions, setLocationSuggestions,
          uploading, setUploading, uploadProgress, setUploadProgress, showSuccess,
          highlightViewerVisible, setHighlightViewerVisible, selectedHighlightId,
          storiesViewerVisible, setStoriesViewerVisible, userStories, initialStoryIndex,
          createHighlightVisible, setCreateHighlightVisible
        }}
      />

      <SubscriptionModal
        visible={subModalVisible}
        onClose={() => {
          setSubModalVisible(false);
          setSelectedTierForModal(undefined);
        }}
        initialTierId={selectedTierForModal}
        isOwnProfile={isOwnProfile}
        creatorId={profile?._id || profile?.id || viewedUserId || 'unknown'}
        onSubscriptionChange={(subscribed) => {
          setIsSubscribed(subscribed);
          if (subscribed) {
            subscriptionService.checkSubscriptionStatus(profile?._id || profile?.id || viewedUserId || '')
              .then((res) => {
                if (res.success && res.data) {
                  setActiveSubscribedTierIds(res.data.activeTierIds || []);
                  setUserSubscriptions(res.data.subscriptions || []);
                }
              })
              .catch(() => {});
          }
        }}
      />
      </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  offlineBanner: {
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 2,
    backgroundColor: COLORS.textPrimary,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    opacity: 0.92,
  },
  offlineBannerText: { color: COLORS.textLight, fontWeight: '700', textAlign: 'center' },
  headerBackBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.textPrimary, maxWidth: 200, textAlign: 'left' },
  headerMenuBtn: { padding: 4 },
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  menuSheet: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  menuSheetContent: { paddingBottom: 20 },
  handleContainer: { width: '100%', alignItems: 'center', paddingTop: 10, paddingBottom: 10 },
  menuHandle: { width: 40, height: 4, backgroundColor: COLORS.border, borderRadius: 2 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, paddingHorizontal: 20 },
  menuIconContainer: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  menuItemText: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: COLORS.border, justifyContent: 'space-between' },
  topIcon: { padding: 4 },
  topTitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  content: { paddingHorizontal: 0, paddingBottom: 0 },
  avatarContainer: { alignItems: 'center', paddingVertical: 12, marginTop: 4 },
  avatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: COLORS.inputBg, borderWidth: 2, borderColor: COLORS.primary },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primaryLight },
  avatarInitials: { fontSize: 26, fontWeight: '800', color: COLORS.textSecondary },
  statsRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, gap: 24 },
  statItem: { alignItems: 'center', minWidth: 60, gap: 4 },
  statNum: { fontWeight: '700', fontSize: 18, color: COLORS.textPrimary },
  statLbl: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4, fontWeight: '600' },
  infoBlock: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16 },
  displayName: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  username: { fontSize: 13, color: COLORS.primary, marginTop: 2, fontWeight: '500' },
  bio: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center', lineHeight: 18 },
  linksBlock: { marginTop: 6, width: '100%' },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  linkIconWrap: { width: 22, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  linkFavicon: { width: 16, height: 16, borderRadius: 4 },
  linkText: { flex: 1, fontSize: 12, color: COLORS.info },
  location: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  phone: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3 },
  interests: { fontSize: 12, color: COLORS.textSecondary, marginTop: 3, fontStyle: 'italic' },
  passportBtnLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 24,
    marginTop: 12,
    marginBottom: 8,
    backgroundColor: COLORS.card,
    minWidth: 140,
  },
  passportBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  pillRow: { flexDirection: 'row', gap: 8, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 0 },
  pillBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.inputBg, paddingVertical: 8, borderRadius: 6, borderWidth: 1, borderColor: COLORS.border },
  pillText: { fontSize: 12, fontWeight: '500', color: COLORS.textPrimary },
  followBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary, paddingVertical: 8, borderRadius: 6 },
  followingBtn: { backgroundColor: COLORS.inputBg, borderWidth: 1, borderColor: COLORS.border },
  followText: { fontSize: 12, fontWeight: '600', color: COLORS.textLight },
  followingText: { color: COLORS.textPrimary },
  customProfileTabBar: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 10,
    backgroundColor: COLORS.background,
    position: 'relative',
  },
  customProfileTabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
  },
  customProfileTabItemActive: {},
  activeIndicatorLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    height: 2.5,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
});
