import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
  Alert,
  Animated,
  PanResponder,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Keyboard
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useReelsStore } from '@/store/useReelsStore';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { CommentSection } from './CommentSection';
import ShareModal from './ShareModal';
import SaveToCollectionModal from './SaveToCollectionModal';
import StoriesViewer from './StoriesViewer';
import { storyForStoriesViewer } from '../../lib/storyViewer';
import { likePost, unlikePost, sendPostMessage, followUser, unfollowUser } from '../../lib/firebaseHelpers';
import { apiService } from '@/src/_services/apiService';
import { normalizeAvatarUrl, getOptimizedMediaUrl, isVideoUrl } from '../../lib/utils/media';
import { getVideoThumbnailUrl } from '../../lib/imageHelpers';
import { isLocallyCached, getLocalCachePath } from '@/src/media/videoCache';
import { ReelBufferSkeleton } from './HomeReelSkeleton';
import { feedEventEmitter } from '../../lib/feedEventEmitter';
import { userService } from '../../lib/userService';
import { hapticLight } from '@/lib/haptics';
import { useUser } from './UserContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@/lib/storage';
import { SubscriptionModal } from './profile/SubscriptionModal';
import { subscriptionService } from '@/src/_services/subscriptionService';
import COLORS from '@/src/theme/colors';
import { resolveCanonicalUserId } from '@/lib/currentUser';
import { ReelReactionBurst, FloatingParticleItem, ReactionType } from './ReelReactionBurst';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Helper: safely extracts clean string user ID from any post/user shape
const getTargetCreatorId = (p: any): string => {
  if (!p) return '';
  const u = p.userId || p.user || p.author || p.authorData;
  if (typeof u === 'string' && u.trim() && u !== '[object Object]') return u.trim();
  if (typeof u === 'object' && u !== null) {
    const id = u._id || u.id || u.uid || u.firebaseUid;
    if (typeof id === 'string' && id.trim() && id !== '[object Object]') return id.trim();
    if (id && typeof id === 'object' && id._id) return String(id._id);
  }
  return '';
};

// Module-level caches to eliminate per-reel AsyncStorage and network thrashing
let cachedCanonicalUserId: string | null = null;
const creatorStoriesCache = new Map<string, { stories: any[]; timestamp: number }>();
let cachedSeenStoryIds: Set<string> | null = null;

interface ReelItemProps {
  post: any;
  currentUser: any;
  index: number;
  isScreenFocused: boolean;
  isMuted: boolean;
  toggleMute: () => void;
  containerHeight: number;
  isFullscreenMode: boolean;
  onToggleFullscreen: () => void;
  followedStories?: any[];
  isHomeStoriesViewerVisible?: boolean;
}

export const ReelItem = React.memo<ReelItemProps>(({
  post,
  currentUser,
  index,
  isScreenFocused,
  isMuted,
  toggleMute,
  containerHeight,
  isFullscreenMode,
  onToggleFullscreen,
  followedStories = [],
  isHomeStoriesViewerVisible = false
}) => {
  const router = useRouter();
  const user = useUser();
  const directUserId = typeof currentUser === 'string'
    ? currentUser
    : (currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid || '');
  const [resolvedUserId, setResolvedUserId] = useState<string>(directUserId || cachedCanonicalUserId || '');

  const isModalOpen = useReelsStore((state) => state.isModalOpen);
  const isActive = useReelsStore((state) => state.activeIndex === index) && isScreenFocused && !isModalOpen;
  // High-performance preload: active reel + immediate adjacent reel (±1)
  // Dedicates full device bandwidth and decoder pipeline to the next upcoming video without saturating hardware decoders
  const shouldLoad = useReelsStore((state) => Math.abs(index - state.activeIndex) <= 1);

  useEffect(() => {
    if (resolvedUserId || cachedCanonicalUserId) return;
    const fetchCanonicalId = async () => {
      try {
        const canonicalId = await resolveCanonicalUserId();
        if (canonicalId) {
          cachedCanonicalUserId = canonicalId;
          setResolvedUserId(canonicalId);
        }
      } catch (e) {
        // Silently continue
      }
    };
    fetchCanonicalId();
  }, [resolvedUserId]);




  const insets = useSafeAreaInsets();

  const [isLoaded, setIsLoaded] = useState(false);
  const [showThumb, setShowThumb] = useState(true);
  const thumbOpacity = useRef(new Animated.Value(1)).current;

  // Smoothly fade out thumbnail when video is readyToPlay so custom aspect ratio thumbnails never show behind video
  useEffect(() => {
    if (isLoaded) {
      Animated.timing(thumbOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(() => {
        setShowThumb(false);
      });
    } else {
      setShowThumb(true);
      thumbOpacity.setValue(1);
    }
  }, [isLoaded, thumbOpacity]);

  // Reset thumbnail placeholder when unmounted / scrolled out of window
  useEffect(() => {
    if (!shouldLoad) {
      setIsLoaded(false);
      setShowThumb(true);
      thumbOpacity.setValue(1);
    }
  }, [shouldLoad, thumbOpacity]);

  const [isBuffering, setIsBuffering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isLiked, setIsLiked] = useState(() => {
    if (post?.isLiked !== undefined) return post.isLiked;
    const myId = String(currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid || '');
    if (myId && Array.isArray(post?.likes)) {
      return post.likes.some((id: any) => {
        const lid = String(id?._id || id?.id || id?.uid || id?.firebaseUid || id || '');
        return lid === myId;
      });
    }
    return false;
  });
  const [likeCount, setLikeCount] = useState(post?.likeCount || post?.likesCount || 0);
  const [commentCount, setCommentCount] = useState(
    post?.commentCount !== undefined ? post.commentCount : (post?.commentsCount || 0)
  );

  const [showComments, setShowComments] = useState(false);
  const [autoFocusComment, setAutoFocusComment] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [shareCount, setShareCount] = useState<number>(post?.shareCount || 0);
  const [isFollowing, setIsFollowing] = useState(post?.isFollowing || false);
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);

  const rawHashtags = useMemo(() => {
    const list: string[] = [];
    if (Array.isArray(post?.hashtags)) {
      post.hashtags.forEach((h: any) => {
        if (typeof h === 'string') {
          const clean = h.replace(/^#/, '').trim();
          if (clean && !list.includes(clean)) list.push(clean);
        }
      });
    }
    if (Array.isArray(post?.tags)) {
      post.tags.forEach((t: any) => {
        if (typeof t === 'string') {
          const clean = t.replace(/^#/, '').trim();
          if (clean && !list.includes(clean)) list.push(clean);
        }
      });
    }
    const captionStr = post?.caption || post?.text || '';
    const matches = captionStr.match(/#([a-zA-Z0-9_\u0600-\u06FF]+)/g);
    if (matches) {
      matches.forEach((m: string) => {
        const clean = m.replace(/^#/, '').trim();
        if (clean && !list.includes(clean)) list.push(clean);
      });
    }
    return list;
  }, [post?.hashtags, post?.tags, post?.caption, post?.text]);
  const [isSaved, setIsSaved] = useState(() => {
    if (post?.isSaved !== undefined) return post.isSaved;
    const myId = String(currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid || '');
    if (myId && Array.isArray(post?.savedBy)) {
      return post.savedBy.includes(myId);
    }
    return false;
  });
  const [savedCount, setSavedCount] = useState<number>(
    post?.savedCount ?? post?.savesCount ?? (post?.isSaved ? 1 : 0)
  );

  // Laugh & Tomato Ratings States
  const [laughCount, setLaughCount] = useState(post?.laughCount || 0);
  const [tomatoCount, setTomatoCount] = useState(post?.tomatoCount || 0);
  const [hasLaughed, setHasLaughed] = useState(false);
  const [hasTomatoed, setHasTomatoed] = useState(false);

  // Floating +1 😂 rising animation states
  const floatingAnim = useRef(new Animated.Value(0)).current;
  const floatingOpacity = useRef(new Animated.Value(0)).current;

  // Floating +1 🍅 rising animation states
  const floatingTomatoAnim = useRef(new Animated.Value(0)).current;
  const floatingTomatoOpacity = useRef(new Animated.Value(0)).current;

  // Hold & Scale animation states for Laugh and Tomato buttons
  const laughScaleAnim = useRef(new Animated.Value(1)).current;
  const tomatoScaleAnim = useRef(new Animated.Value(1)).current;

  // TikTok / IG Live style continuous particle stream
  const [particles, setParticles] = useState<FloatingParticleItem[]>([]);
  const [comboCount, setComboCount] = useState<number>(0);
  const [chargeProgress, setChargeProgress] = useState<number>(0);
  const [isHoldingReaction, setIsHoldingReaction] = useState<boolean>(false);
  const [holdingReactionType, setHoldingReactionType] = useState<ReactionType | null>(null);
  const [isMegaExploded, setIsMegaExploded] = useState<boolean>(false);
  const [explodedType, setExplodedType] = useState<ReactionType | null>(null);

  const emitterIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pressStartTimeRef = useRef<number>(0);
  const comboCountRef = useRef<number>(0);
  const isHoldingRef = useRef<boolean>(false);

  const handleParticleComplete = useCallback((id: string) => {
    setParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const emitParticle = useCallback((type: ReactionType, isMega = false) => {
    const startX = SCREEN_WIDTH - 54;
    const startY = containerHeight * 0.72;

    if (isMega) {
      // Mega Firework Shower: 40 full-screen explosion particles covering entire screen!
      const newFireworkParticles: FloatingParticleItem[] = Array.from({ length: 40 }).map((_, i) => {
        const angle = (i / 40) * 2 * Math.PI + (Math.random() - 0.5) * 0.4;
        const speed = 100 + Math.random() * 220;
        return {
          id: `firework_${Date.now()}_${i}_${Math.random()}`,
          type,
          startX: SCREEN_WIDTH * 0.5 + (Math.random() - 0.5) * 80,
          startY: containerHeight * 0.45 + (Math.random() - 0.5) * 80,
          swayWidth: 0,
          riseHeight: 0,
          scale: 0.7 + Math.random() * 0.65,
          rotation: (Math.random() - 0.5) * 90,
          duration: 1300 + Math.random() * 500,
          isFirework: true,
          angle,
          speed,
        };
      });
      setParticles((prev) => [...prev.slice(-40), ...newFireworkParticles]);
      return;
    }

    // Single Floating Fountain Particle drifting inwards towards screen center
    const newParticle: FloatingParticleItem = {
      id: `particle_${Date.now()}_${Math.random()}`,
      type,
      startX: startX + (Math.random() - 0.5) * 16,
      startY: startY + (Math.random() - 0.5) * 10,
      swayWidth: 40 + Math.random() * 70, // Drifts well into the screen
      riseHeight: 280 + Math.random() * 150,
      scale: 0.85 + Math.random() * 0.45,
      rotation: (Math.random() - 0.5) * 30,
      duration: 1500 + Math.random() * 400,
    };

    setParticles((prev) => [...prev.slice(-35), newParticle]);
  }, [containerHeight]);

  const triggerLaughAnimation = useCallback(() => {
    floatingAnim.setValue(0);
    floatingOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(floatingAnim, {
        toValue: -50,
        duration: 850,
        useNativeDriver: true,
      }),
      Animated.timing(floatingOpacity, {
        toValue: 0,
        duration: 850,
        useNativeDriver: true,
      }),
    ]).start();
  }, [floatingAnim, floatingOpacity]);

  const triggerTomatoAnimation = useCallback(() => {
    floatingTomatoAnim.setValue(0);
    floatingTomatoOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(floatingTomatoAnim, {
        toValue: -50,
        duration: 850,
        useNativeDriver: true,
      }),
      Animated.timing(floatingTomatoOpacity, {
        toValue: 0,
        duration: 850,
        useNativeDriver: true,
      }),
    ]).start();
  }, [floatingTomatoAnim, floatingTomatoOpacity]);

  // Views tracking state & ref
  const [viewsCount, setViewsCount] = useState(post?.viewsCount || 0);
  const hasViewedRef = useRef(false);

  // Reset hasViewedRef when active post ID changes
  useEffect(() => {
    hasViewedRef.current = false;
    setViewsCount(post?.viewsCount || 0);
  }, [post?._id]);

  // Track real view when video has been active on screen for >1.5 seconds (Creator excluded & unique views)
  useEffect(() => {
    if (!isActive || !post?._id || hasViewedRef.current) return;

    // Creator Exclusion: Never track creator viewing their own post
    const targetCreator = getTargetCreatorId(post);
    const myId = String(currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid || resolvedUserId || '');
    if (myId && targetCreator && myId === targetCreator) {
      return;
    }

    const timer = setTimeout(async () => {
      if (hasViewedRef.current) return;
      hasViewedRef.current = true;

      try {
        const cleanId = String(post._id).split('-loop')[0];
        const res: any = await apiService.post(`/posts/${cleanId}/view`, {});
        // Only increment view count if counted (not duplicate / not creator)
        if (res?.counted) {
          setViewsCount((prev: number) => prev + 1);
        }
      } catch (e) {
        console.warn('[ReelItem] View tracking failed:', e);
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [isActive, post?._id, currentUser, resolvedUserId]);

  // Save Toast & Collection selector states
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);
  const ratingDebounceTimerRef = useRef<any>(null);
  const lastRatingTimeRef = useRef<number>(0);
  const hasLaughedRef = useRef(false);
  const hasTomatoedRef = useRef(false);

  useEffect(() => {
    hasLaughedRef.current = hasLaughed;
  }, [hasLaughed]);

  useEffect(() => {
    hasTomatoedRef.current = hasTomatoed;
  }, [hasTomatoed]);

  // Stories States & Fetching
  const [creatorStories, setCreatorStories] = useState<any[]>([]);
  const [storiesViewerVisible, setStoriesViewerVisible] = useState(false);
  const [activeViewerStories, setActiveViewerStories] = useState<any[]>([]);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [seenStoryIds, setSeenStoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (!shouldLoad) return;
    const creatorUserId = getTargetCreatorId(post);
    const creatorFirebaseUid = String(post?.userId?.firebaseUid || post?.user?.firebaseUid || post?.userId?.uid || '');
    if (!creatorUserId && !creatorFirebaseUid) return;

    // 1. Check followedStories passed from home.tsx (0ms instant!)
    if (Array.isArray(followedStories) && followedStories.length > 0) {
      const matchedGroup = followedStories.find((g: any) => {
        const sUid = String(g?.userId?._id || g?.userId?.id || g?.userId || g?.uid || '');
        return sUid && (sUid === creatorUserId || (creatorFirebaseUid && sUid === creatorFirebaseUid));
      });
      if (matchedGroup && Array.isArray(matchedGroup.stories) && matchedGroup.stories.length > 0) {
        setCreatorStories(matchedGroup.stories);
        return;
      }
    }

    const targetLookupId = creatorUserId || creatorFirebaseUid;
    if (!targetLookupId) return;

    // 2. Check in-memory cache (TTL: 30 seconds)
    const cached = creatorStoriesCache.get(targetLookupId);
    if (cached && Date.now() - cached.timestamp < 30000) {
      setCreatorStories(cached.stories);
      return;
    }

    // 3. Only fetch from API if not in cache
    let isMounted = true;
    apiService.get(`/stories/user/${targetLookupId}`)
      .then((res) => {
        if (!isMounted) return;
        const raw = res?.success && Array.isArray(res.data) ? res.data : [];
        const formatted = raw.map((s: any, idx: number) => storyForStoriesViewer(s, idx));
        creatorStoriesCache.set(targetLookupId, { stories: formatted, timestamp: Date.now() });
        setCreatorStories(formatted);
      })
      .catch(() => {
        if (isMounted) setCreatorStories([]);
      });

    return () => { isMounted = false; };
  }, [post?.userId, post?.user, shouldLoad, followedStories]);

  useEffect(() => {
    const handleFeedUpdate = () => {
      creatorStoriesCache.clear();
      const creatorUserId = getTargetCreatorId(post);
      const creatorFirebaseUid = String(post?.userId?.firebaseUid || post?.user?.firebaseUid || post?.userId?.uid || '');
      const targetLookupId = creatorUserId || creatorFirebaseUid;
      if (targetLookupId) {
        apiService.get(`/stories/user/${targetLookupId}`)
          .then((res) => {
            const raw = res?.success && Array.isArray(res.data) ? res.data : [];
            const formatted = raw.map((s: any, idx: number) => storyForStoriesViewer(s, idx));
            creatorStoriesCache.set(targetLookupId, { stories: formatted, timestamp: Date.now() });
            setCreatorStories(formatted);
          })
          .catch(() => {});
      }
    };

    feedEventEmitter.on('feedUpdated', handleFeedUpdate);
    return () => {
      feedEventEmitter.off('feedUpdated', handleFeedUpdate);
    };
  }, [post?.userId, post?.user]);

  const loadSeenStoryIds = useCallback(async () => {
    if (cachedSeenStoryIds) {
      setSeenStoryIds(Array.from(cachedSeenStoryIds));
      return;
    }
    try {
      const raw = await AsyncStorage.getItem('seenStoryIds');
      const arr = raw ? JSON.parse(raw) : [];
      const idList = Array.isArray(arr) ? arr.map((x: any) => String(x)) : [];
      cachedSeenStoryIds = new Set(idList);
      setSeenStoryIds(idList);
    } catch {
      setSeenStoryIds([]);
    }
  }, []);

  useEffect(() => {
    loadSeenStoryIds();
  }, [loadSeenStoryIds, isActive, isScreenFocused, creatorStories]);

  const creatorStoriesSeen = useMemo(() => {
    if (creatorStories.length === 0) return false;
    return creatorStories.every((s: any) => seenStoryIds.includes(String(s._id || s.id || '')));
  }, [creatorStories, seenStoryIds]);

  const activeUserId = useMemo(() => {
    if (resolvedUserId) return resolvedUserId;
    return (
      (typeof currentUser === 'string' ? currentUser : (currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid)) ||
      user?._id || user?.id || user?.uid || ''
    );
  }, [resolvedUserId, currentUser, user]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Synchronize local states when switching to a different post or currentUser changes
  useEffect(() => {
    if (!post) return;
    const myId = String(currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid || '');

    // Sync isSaved and savedCount
    let currentSaved = false;
    if (post.isSaved !== undefined) {
      currentSaved = !!post.isSaved;
      setIsSaved(currentSaved);
    } else if (myId && Array.isArray(post.savedBy)) {
      currentSaved = post.savedBy.some((id: any) => String(id) === myId);
      setIsSaved(currentSaved);
    } else {
      setIsSaved(false);
    }
    const targetCount = post.savedCount !== undefined 
      ? post.savedCount 
      : (post.savesCount !== undefined ? post.savesCount : (currentSaved ? 1 : 0));
    setSavedCount(targetCount);

    // Sync isLiked
    if (post.isLiked !== undefined) {
      setIsLiked(post.isLiked);
    } else if (myId && Array.isArray(post.likes)) {
      setIsLiked(post.likes.some((id: any) => {
        const lid = String(id?._id || id?.id || id?.uid || id?.firebaseUid || id || '');
        return lid === myId;
      }));
    } else {
      setIsLiked(false);
    }

    // Sync counts and user ratings/actions
    setLikeCount(post.likeCount || post.likesCount || 0);
    setCommentCount(post.commentCount !== undefined ? post.commentCount : (post.commentsCount || 0));
    setLaughCount(post.laughCount || 0);
    setTomatoCount(post.tomatoCount || 0);
    setShareCount(post.shareCount || 0);
    setIsFollowing(post.isFollowing || false);
  }, [post?._id, post?.isSaved, post?.savedCount, post?.savesCount, post?.isLiked, post?.likeCount, post?.likesCount, post?.commentCount, currentUser]);

  // Sync hasLaughed/hasTomatoed ONLY when switching to a different post (post._id changes)
  // This prevents the parent feed re-render from overwriting the user's local selection state
  useEffect(() => {
    if (!post) return;
    const myId = String(currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid || '');

    if (post.hasLaughed !== undefined) {
      setHasLaughed(!!post.hasLaughed);
    } else if (myId && Array.isArray(post.laughedBy)) {
      setHasLaughed(post.laughedBy.some((id: any) => String(id?._id || id?.id || id) === myId));
    } else {
      setHasLaughed(false);
    }

    if (post.hasTomatoed !== undefined) {
      setHasTomatoed(!!post.hasTomatoed);
    } else if (myId && Array.isArray(post.tomatoedBy)) {
      setHasTomatoed(post.tomatoedBy.some((id: any) => String(id?._id || id?.id || id) === myId));
    } else {
      setHasTomatoed(false);
    }
  }, [post?._id]);

  // Reset index indicator and loading state ONLY when active post ID changes
  useEffect(() => {
    setCurrentImageIndex(0);
    setIsLoaded(false);
    setIsBuffering(false);
  }, [post?._id]);

  // Subscribe to real-time updates for this specific post
  useEffect(() => {
    if (!post?._id) return;
    const cid = String(post?.userId?._id || post?.userId || '');
    const sub = feedEventEmitter.onPostUpdated(post._id, (pid, data) => {
      if (!data) return;

      // Ignore incoming counts if user recently rated, to prevent stale socket events from overwriting active UI
      const timeSinceLastRate = Date.now() - lastRatingTimeRef.current;
      const isRatingActive = timeSinceLastRate < 2500;

      if (data.isSaved !== undefined) {
        setIsSaved(data.isSaved);
      }
      if (data.savedCount !== undefined) {
        setSavedCount(data.savedCount);
      } else if (data.savesCount !== undefined) {
        setSavedCount(data.savesCount);
      }
      if (data.isLiked !== undefined) {
        setIsLiked(data.isLiked);
      }
      if (data.likeCount !== undefined) {
        setLikeCount(data.likeCount);
      }
      if (data.commentCount !== undefined) {
        setCommentCount(data.commentCount);
      } else if (data.commentsCount !== undefined) {
        setCommentCount(data.commentsCount);
      }
      if (!isRatingActive) {
        if (data.laughCount !== undefined) {
          setLaughCount(data.laughCount);
        }
        if (data.tomatoCount !== undefined) {
          setTomatoCount(data.tomatoCount);
        }
      }
      if (data.isFollowing !== undefined) {
        setIsFollowing(data.isFollowing);
      }
      if (data.shareCount !== undefined) {
        setShareCount(data.shareCount);
      }
    });

    const unsubFollow = feedEventEmitter.onFeedUpdate((event) => {
      if (event.type === 'USER_FOLLOW_CHANGED' && event.userId) {
        const targetUserId = String(event.userId).toLowerCase();
        const extraTargetIds = Array.isArray(event.data?.targetUserIds)
          ? event.data.targetUserIds.map((id: any) => String(id).toLowerCase())
          : [];
        const allTargetIds = [targetUserId, ...extraTargetIds];

        const creatorIds = [
          post?.userId?._id,
          post?.userId?.id,
          post?.userId?.firebaseUid,
          post?.userId?.uid,
          post?.userId,
          post?.user?._id,
          post?.user?.id,
          post?.user?.firebaseUid,
          post?.user?.uid,
          post?.creatorId,
          post?.creator?._id,
          post?.creator?.id
        ].filter(Boolean).map(id => String(id).toLowerCase());

        const matches = creatorIds.some(cid => allTargetIds.includes(cid));
        if (matches) {
          setIsFollowing(!!event.data?.isFollowing);
        }
      }
    });

    return () => {
      sub.remove();
      unsubFollow();
    };
  }, [post?._id, post?.userId, post?.user, post?.creatorId, post?.creator]);

  // Subscribe to comment count updates for this post
  useEffect(() => {
    if (!post?._id) return;
    // @ts-ignore - custom event from CommentSection
    const subCount = feedEventEmitter.addListener('commentCountUpdated', (data: any) => {
      if (data?.postId === post._id && data?.count !== undefined) {
        setCommentCount(data.count);
      }
    });
    // @ts-ignore - custom event from CommentSection
    const subAdded = feedEventEmitter.addListener('commentAdded', (data: any) => {
      if (data?.postId === post._id) {
        setCommentCount((prev: number) => prev + 1);
      }
    });
    // @ts-ignore - custom event from CommentSection
    const subDeleted = feedEventEmitter.addListener('commentDeleted', (data: any) => {
      if (data?.postId === post._id) {
        setCommentCount((prev: number) => Math.max(0, prev - 1));
      }
    });
    return () => {
      subCount.remove();
      subAdded.remove();
      subDeleted.remove();
    };
  }, [post?._id]);

  const translateY = useRef(new Animated.Value(0)).current;

  // Pan Responder for dragging down comments modal
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        Keyboard.dismiss();
      },
      onPanResponderMove: (e, gestureState) => {
        if (gestureState.dy > 0) {
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        if (gestureState.dy > 100 || gestureState.vy > 0.5) {
          setShowComments(false);
          translateY.setValue(0);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (!showComments) {
      translateY.setValue(0);
    }
  }, [showComments]);

  // Handle Play/Pause based on screen activity & tab focus
  useEffect(() => {
    if (isActive) {
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [isActive]);

  // Handle like toggle
  const handleLike = useCallback(async () => {
    const activeUserId =
      (typeof currentUser === 'string' ? currentUser : (currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid)) ||
      user?._id || user?.id || user?.uid;

    if (!activeUserId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newLiked = !isLiked;
    setIsLiked(newLiked);
    setLikeCount((prev: number) => newLiked ? prev + 1 : prev - 1);

    try {
      if (newLiked) await likePost(post._id, activeUserId);
      else await unlikePost(post._id, activeUserId);
      feedEventEmitter.emitFeedUpdate({
        type: 'POST_UPDATED',
        postId: post._id,
        data: { isLiked: newLiked, likeCount: newLiked ? likeCount + 1 : likeCount - 1 }
      });
    } catch (err) {
      setIsLiked(!newLiked);
      setLikeCount((prev: number) => !newLiked ? prev + 1 : prev - 1);
    }
  }, [isLiked, post._id, currentUser, likeCount]);

  // Handle Save
  const handleSave = useCallback(async () => {
    const activeUserId =
      (typeof currentUser === 'string' ? currentUser : (currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid)) ||
      user?._id || user?.id || user?.uid;
    if (!activeUserId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newSaved = !isSaved;
    const newCount = newSaved ? savedCount + 1 : Math.max(0, savedCount - 1);
    setIsSaved(newSaved);
    setSavedCount(newCount);

    // Clear any existing toast timer
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }

    if (newSaved) {
      setShowSavedToast(true);
      toastTimerRef.current = setTimeout(() => {
        setShowSavedToast(false);
      }, 4000);
    } else {
      setShowSavedToast(false);
    }

    try {
      if (newSaved) {
        await apiService.post(`/users/${activeUserId}/saved`, { postId: post._id });
      } else {
        await apiService.delete(`/users/${activeUserId}/saved/${post._id}`);
      }
    } catch (err) {
      setIsSaved(!newSaved);
      setSavedCount(savedCount);
      setShowSavedToast(false);
      Alert.alert("Error", "Failed to save post");
    }
  }, [isSaved, savedCount, post._id, currentUser, user]);

  // Handle Follow
  const handleFollow = useCallback(async () => {
    const myId = activeUserId;
    const creatorId = post?.userId?._id || post?.userId;
    if (!myId || !creatorId) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newFollowing = !isFollowing;
    setIsFollowing(newFollowing);

    try {
      if (newFollowing) {
        const res = await followUser(String(myId), String(creatorId));
        if (!res.success) throw new Error(res.error || 'Failed to follow');
      } else {
        const res = await unfollowUser(String(myId), String(creatorId));
        if (!res.success) throw new Error(res.error || 'Failed to unfollow');
      }
      
      // Emit follow status update globally for this creator
      feedEventEmitter.emitUserFollowChanged(String(creatorId), newFollowing);
    } catch (err: any) {
      setIsFollowing(!newFollowing);
      Alert.alert("Error", err.message || "Failed to perform follow action");
    }

    // Emit feed event so other ReelItems from the same creator update their follow state
    feedEventEmitter.emitFeedUpdate({
      type: 'POST_UPDATED',
      postId: post._id,
      data: { isFollowing: newFollowing }
    });
  }, [isFollowing, post?.userId, activeUserId, post._id]);

  // Handle Laugh (😂) Rating Press
  const handleLaughPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    lastRatingTimeRef.current = Date.now();
    const currentLaughed = hasLaughedRef.current;
    const currentTomatoed = hasTomatoedRef.current;
    const newLaughed = !currentLaughed;

    // Synchronously update refs to prevent race conditions on rapid multi-taps
    hasLaughedRef.current = newLaughed;
    setHasLaughed(newLaughed);
    setLaughCount((prev: number) => newLaughed ? prev + 1 : Math.max(0, prev - 1));

    if (newLaughed) {
      triggerLaughAnimation();
    }

    // Toggle off tomato if user had rated it bad
    if (newLaughed && currentTomatoed) {
      hasTomatoedRef.current = false;
      setHasTomatoed(false);
      setTomatoCount((prev: number) => Math.max(0, prev - 1));
    }

    // Debounce the backend API call so rapid taps produce 1 clean final request
    if (ratingDebounceTimerRef.current) {
      clearTimeout(ratingDebounceTimerRef.current);
    }

    ratingDebounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await apiService.post(`/posts/${post._id}/rate`, { type: 'laugh', active: newLaughed });
        if (res?.success && res?.data) {
          // Sync backend totals safely if selection has not changed in the meantime
          if (hasLaughedRef.current === newLaughed) {
            if (typeof res.data.laughCount === 'number') setLaughCount(res.data.laughCount);
            if (typeof res.data.tomatoCount === 'number') setTomatoCount(res.data.tomatoCount);
          }
        }
      } catch (e) {
        console.warn('[ReelItem] Rate laugh failed:', e);
      }
    }, 300);
  }, [post._id, triggerLaughAnimation]);

  // Handle Tomato (🍅) Rating Press
  const handleTomatoPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });

    lastRatingTimeRef.current = Date.now();
    const currentTomatoed = hasTomatoedRef.current;
    const currentLaughed = hasLaughedRef.current;
    const newTomatoed = !currentTomatoed;

    // Synchronously update refs to prevent race conditions on rapid multi-taps
    hasTomatoedRef.current = newTomatoed;
    setHasTomatoed(newTomatoed);
    setTomatoCount((prev: number) => newTomatoed ? prev + 1 : Math.max(0, prev - 1));

    if (newTomatoed) {
      triggerTomatoAnimation();
    }

    // Toggle off laugh if user had rated it funny
    if (newTomatoed && currentLaughed) {
      hasLaughedRef.current = false;
      setHasLaughed(false);
      setLaughCount((prev: number) => Math.max(0, prev - 1));
    }

    // Debounce the backend API call so rapid taps produce 1 clean final request
    if (ratingDebounceTimerRef.current) {
      clearTimeout(ratingDebounceTimerRef.current);
    }

    ratingDebounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await apiService.post(`/posts/${post._id}/rate`, { type: 'tomato', active: newTomatoed });
        if (res?.success && res?.data) {
          // Sync backend totals safely if selection has not changed in the meantime
          if (hasTomatoedRef.current === newTomatoed) {
            if (typeof res.data.laughCount === 'number') setLaughCount(res.data.laughCount);
            if (typeof res.data.tomatoCount === 'number') setTomatoCount(res.data.tomatoCount);
          }
        }
      } catch (e) {
        console.warn('[ReelItem] Rate tomato failed:', e);
      }
    }, 300);
  }, [post._id, triggerTomatoAnimation]);

  // Press-in & Press-out handlers with 2.2s charge meter & 40-particle blast
  const startReactionHold = useCallback((type: ReactionType) => {
    pressStartTimeRef.current = Date.now();
    comboCountRef.current = 1;
    isHoldingRef.current = true;
    setIsHoldingReaction(true);
    setHoldingReactionType(type);
    setIsMegaExploded(false);
    setComboCount(1);
    setChargeProgress(0.05);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    emitParticle(type, false);

    const targetScaleAnim = type === 'laugh' ? laughScaleAnim : tomatoScaleAnim;
    Animated.spring(targetScaleAnim, {
      toValue: 1.15,
      friction: 4,
      tension: 40,
      useNativeDriver: true,
    }).start();

    if (emitterIntervalRef.current) clearInterval(emitterIntervalRef.current);

    const startTime = Date.now();
    const TOTAL_CHARGE_MS = 2200; // 2.2 seconds steady build up

    emitterIntervalRef.current = setInterval(() => {
      if (!isHoldingRef.current) return;
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / TOTAL_CHARGE_MS);
      setChargeProgress(progress);

      comboCountRef.current += 1;
      setComboCount(comboCountRef.current);

      // Scale button up smoothly as it charges
      Animated.timing(targetScaleAnim, {
        toValue: 1.15 + progress * 0.2, // scales smoothly up to 1.35x
        duration: 120,
        useNativeDriver: true,
      }).start();

      // Emit buoyant floating particle drifting inwards
      emitParticle(type, false);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});

      // When 100% full charge reached (~2.2s): DETONATE THE BIG BLAST!
      if (progress >= 1) {
        // Stop emitter interval immediately so zero vibration lingers
        if (emitterIntervalRef.current) {
          clearInterval(emitterIntervalRef.current);
          emitterIntervalRef.current = null;
        }

        // Heavy celebration haptic
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

        setExplodedType(type); // Lock the type at detonation moment
        setIsMegaExploded(true);
        emitParticle(type, true); // 40 emojis blast!

        // Spring button back
        Animated.spring(targetScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }).start();

        // Ensure post rating is recorded
        if (type === 'laugh') {
          if (!hasLaughedRef.current) {
            hasLaughedRef.current = true;
            setHasLaughed(true);
            setLaughCount((prev: number) => prev + 1);
            if (hasTomatoedRef.current) {
              hasTomatoedRef.current = false;
              setHasTomatoed(false);
              setTomatoCount((prev: number) => Math.max(0, prev - 1));
            }
            apiService.post(`/posts/${post._id}/rate`, { type: 'laugh', active: true }).catch(() => {});
          }
        } else {
          if (!hasTomatoedRef.current) {
            hasTomatoedRef.current = true;
            setHasTomatoed(true);
            setTomatoCount((prev: number) => prev + 1);
            if (hasLaughedRef.current) {
              hasLaughedRef.current = false;
              setHasLaughed(false);
              setLaughCount((prev: number) => Math.max(0, prev - 1));
            }
            apiService.post(`/posts/${post._id}/rate`, { type: 'tomato', active: true }).catch(() => {});
          }
        }
      }
    }, 140);
  }, [emitParticle, laughScaleAnim, tomatoScaleAnim, post._id]);

  const endReactionHold = useCallback((type: ReactionType) => {
    isHoldingRef.current = false;
    setIsHoldingReaction(false);
    setHoldingReactionType(null);
    setChargeProgress(0);

    // Stop emitter immediately so zero vibration lingers
    if (emitterIntervalRef.current) {
      clearInterval(emitterIntervalRef.current);
      emitterIntervalRef.current = null;
    }

    const targetScaleAnim = type === 'laugh' ? laughScaleAnim : tomatoScaleAnim;
    Animated.spring(targetScaleAnim, {
      toValue: 1,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }).start();

    const pressDuration = Date.now() - pressStartTimeRef.current;

    // If quick tap (< 350ms), toggle rating
    if (pressDuration < 350) {
      if (type === 'laugh') handleLaughPress();
      else handleTomatoPress();
    } else {
      if (type === 'laugh') {
        if (!hasLaughedRef.current) {
          hasLaughedRef.current = true;
          setHasLaughed(true);
          setLaughCount((prev: number) => prev + 1);
          if (hasTomatoedRef.current) {
            hasTomatoedRef.current = false;
            setHasTomatoed(false);
            setTomatoCount((prev: number) => Math.max(0, prev - 1));
          }
          apiService.post(`/posts/${post._id}/rate`, { type: 'laugh', active: true }).catch(() => {});
        }
      } else {
        if (!hasTomatoedRef.current) {
          hasTomatoedRef.current = true;
          setHasTomatoed(true);
          setTomatoCount((prev: number) => prev + 1);
          if (hasLaughedRef.current) {
            hasLaughedRef.current = false;
            setHasLaughed(false);
            setLaughCount((prev: number) => Math.max(0, prev - 1));
          }
          apiService.post(`/posts/${post._id}/rate`, { type: 'tomato', active: true }).catch(() => {});
        }
      }
    }
  }, [laughScaleAnim, tomatoScaleAnim, handleLaughPress, handleTomatoPress, post._id]);

  const postUserName = post?.userName || post?.user?.displayName || post?.user?.name || post?.userId?.displayName || post?.userId?.name || 'User';
  const postUserAvatar = normalizeAvatarUrl(
    post?.userAvatar || post?.user?.profilePicture || post?.user?.avatar || post?.user?.photoURL || post?.userId?.avatar || post?.userId?.profilePicture
  );

  const videoUrl = useMemo(() => {
    const media = Array.isArray(post?.media) ? post.media[0] : null;
    let url = media?.url || post?.mediaUrls?.[0] || post?.imageUrl || '';
    return getOptimizedMediaUrl(url);
  }, [post]);

  // Use local cached file if available for 0ms offline/disk instant playback
  const playableVideoUrl = useMemo(() => {
    if (!videoUrl) return '';
    if (isLocallyCached(videoUrl)) {
      return getLocalCachePath(videoUrl);
    }
    return videoUrl;
  }, [videoUrl]);

  const imageUrls = useMemo(() => {
    const urls = Array.isArray(post?.mediaUrls) ? [...post.mediaUrls] : [];
    if (urls.length === 0 && post?.imageUrl) {
      urls.push(post.imageUrl);
    }
    return urls.map((url: string) => {
      if (!url) return '';
      if (url.startsWith('http') || url.startsWith('data:') || url.startsWith('file:')) {
        return url;
      }
      const baseUrl = apiService.getBaseUrl ? apiService.getBaseUrl() : 'http://localhost:5000/api';
      const cleanBaseUrl = baseUrl.replace('/api', '');
      const path = url.startsWith('/') ? url : `/${url}`;
      return `${cleanBaseUrl}${path}`;
    }).filter(Boolean);
  }, [post]);

  const isImagePost = useMemo(() => {
    if (post?.mediaType === 'video') return false;
    if (post?.mediaType === 'image') return true;
    const media = Array.isArray(post?.media) ? post.media[0] : null;
    let url = media?.url || post?.mediaUrls?.[0] || post?.imageUrl || '';
    return !url || !isVideoUrl(url);
  }, [post]);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleScroll = useCallback((event: any) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    setCurrentImageIndex(index);
  }, []);

  const thumbUrl = useMemo(() => {
    let rawThumb = post?.thumbnailUrl || post?.imageUrl || '';
    if (rawThumb && isVideoUrl(rawThumb)) {
      rawThumb = '';
    }
    return getVideoThumbnailUrl(videoUrl, rawThumb);
  }, [post, videoUrl]);

  const isOwner = useMemo(() => {
    // Build all possible author IDs
    const authorIds = [
      post?.userId?._id,
      post?.userId?.id,
      post?.userId?.uid,
      post?.userId?.firebaseUid,
      // If userId is a plain string (not populated)
      typeof post?.userId === 'string' ? post.userId : null,
    ].filter(Boolean).map(String);

    // Build all possible viewer IDs
    const viewerIds: string[] = [];
    if (typeof currentUser === 'string') {
      viewerIds.push(currentUser);
    } else if (currentUser) {
      [currentUser._id, currentUser.id, currentUser.uid, currentUser.firebaseUid]
        .filter(Boolean)
        .forEach(id => viewerIds.push(String(id)));
    }

    if (authorIds.length === 0 || viewerIds.length === 0) return false;
    return authorIds.some(aid => viewerIds.includes(aid));
  }, [post, currentUser]);

  const creatorId = useMemo(() => {
    return String(post?.userId?._id || post?.userId || '');
  }, [post]);

  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subModalVisible, setSubModalVisible] = useState(false);
  const [creatorPrice, setCreatorPrice] = useState('10.00');

  const isLocked = useMemo(() => {
    return post?.visibility === 'Subscribers' && !isOwner && !isSubscribed;
  }, [post?.visibility, isOwner, isSubscribed]);

  const checkSubscriptionStatus = useCallback(async () => {
    if (!activeUserId || !creatorId || isOwner) {
      setIsSubscribed(false);
      return;
    }
    try {
      const tierId = post?.subscriptionTierId;
      const key = tierId 
        ? `sub_subscribed_${activeUserId}_to_tier_${tierId}` 
        : `sub_subscribed_${activeUserId}_to_${creatorId}`;

      const cachedVal = await AsyncStorage.getItem(key);
      if (cachedVal !== null) {
        setIsSubscribed(cachedVal === 'true');
      }

      const response = await subscriptionService.checkSubscriptionStatus(creatorId);
      if (response.success) {
        const activeTiers = response.data.activeTierIds || [];
        const isCurrentlySubbed = tierId 
          ? activeTiers.includes(String(tierId))
          : response.data.isSubscribed;

        // Don't downgrade from cached 'true' to API 'false' — 
        // the payment just happened and the webhook may not have fired yet
        if (isCurrentlySubbed || cachedVal !== 'true') {
          setIsSubscribed(isCurrentlySubbed);
          await AsyncStorage.setItem(key, isCurrentlySubbed ? 'true' : 'false');
        }
        
        // Always sync general creator-level cache
        if (response.data.isSubscribed) {
          await AsyncStorage.setItem(
            `sub_subscribed_${activeUserId}_to_${creatorId}`,
            'true'
          );
        }
      }
      
      const tiersResponse = await subscriptionService.getTiers(creatorId);
      if (tiersResponse.success && Array.isArray(tiersResponse.data) && tiersResponse.data.length > 0) {
        const matchedTier = tierId 
          ? tiersResponse.data.find(t => String(t._id) === String(tierId)) 
          : tiersResponse.data[0];
        if (matchedTier?.price) {
          setCreatorPrice(matchedTier.price);
        }
      }
    } catch (e) {
      console.warn('[ReelItem] Error checking subscription status:', e);
    }
  }, [activeUserId, creatorId, isOwner, post?.subscriptionTierId]);

  useEffect(() => {
    if (!shouldLoad) return;
    checkSubscriptionStatus();
  }, [checkSubscriptionStatus, isActive, shouldLoad]);

  useEffect(() => {
    if (!creatorId || isOwner) return;
    const unsub = feedEventEmitter.onFeedUpdate((event) => {
      if (event.type === 'USER_SUBSCRIBED' && String(event.userId).toLowerCase() === String(creatorId).toLowerCase()) {
        setIsSubscribed(true);
      }
    });
    return () => unsub();
  }, [creatorId, isOwner]);

  return (
    <View style={{ width: SCREEN_WIDTH, height: containerHeight, backgroundColor: COLORS.black }}>
      {/* Media elements: Image or Video */}
      {isImagePost ? (
        imageUrls.length > 0 ? (
          <FlatList
            data={imageUrls}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item, index) => index.toString()}
            style={StyleSheet.absoluteFill}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <ExpoImage
                source={{ uri: item }}
                style={{ width: SCREEN_WIDTH, height: containerHeight }}
                contentFit="contain"
                onLoad={() => setIsLoaded(true)}
                onError={() => setIsLoaded(true)}
              />
            )}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.black }]}>
            <Text style={{ color: COLORS.textLight }}>No Image Available</Text>
          </View>
        )
      ) : videoUrl ? (
        <>
          {/* Render thumbnail placeholder until video is loaded, then fade out so custom aspect ratio thumbnails never bleed through */}
          {thumbUrl && showThumb ? (
            <Animated.View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                { opacity: thumbOpacity }
              ]}
            >
              <ExpoImage
                source={{ uri: thumbUrl }}
                style={StyleSheet.absoluteFill}
                contentFit="contain"
                cachePolicy="memory-disk"
                priority="high"
              />
            </Animated.View>
          ) : null}

          {/* Mount video player for active and preloaded adjacent reels */}
          {shouldLoad && !storiesViewerVisible && !viewerVisible && !isHomeStoriesViewerVisible ? (
            <ReelVideoPlayer
              videoUrl={playableVideoUrl}
              isActive={isActive}
              isPlaying={isPlaying}
              isMuted={isMuted}
              isLocked={isLocked}
              storiesViewerVisible={storiesViewerVisible || viewerVisible || !!isHomeStoriesViewerVisible}
              setIsLoaded={setIsLoaded}
              setIsBuffering={setIsBuffering}
              aspectRatio={post?.aspectRatio}
            />
          ) : null}
        </>
      ) : (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.black }]}>
          <Text style={{ color: COLORS.textLight }}>No Video Available</Text>
        </View>
      )}

      {/* Centered Buffering Spinner: only show when active, buffering, and no thumbnail is present */}
      {isActive && isBuffering && !thumbUrl && (
        <ReelBufferSkeleton />
      )}

      {/* Tap overlay to play/pause or exit fullscreen */}
      {(!isImagePost || isFullscreenMode) && (
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            if (isFullscreenMode) {
              onToggleFullscreen();
            } else if (!isImagePost) {
              setIsPlaying(!isPlaying);
            }
          }}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Double Tap or Single Tap Pause icon overlay */}
      {!isPlaying && isLoaded && !isImagePost && (
        <View pointerEvents="none" style={styles.playPauseContainer}>
          <View style={styles.playPauseIcon}>
            <Ionicons name="play" size={36} color={COLORS.textLight} />
          </View>
        </View>
      )}

      {/* Center Mute Button Overlay (shown only when paused/with play button) */}
      {!isPlaying && isLoaded && !isImagePost && (
        <TouchableOpacity
          activeOpacity={0.7}
          style={styles.centerMuteBtn}
          onPress={toggleMute}
        >
          <Ionicons
            name={isMuted ? "volume-mute" : "volume-high"}
            size={18}
            color={COLORS.textLight}
          />
        </TouchableOpacity>
      )}

      {/* Bottom Gradient Overlay for caption readability */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.8)']}
        style={styles.bottomGradient}
        pointerEvents="none"
      />

      {/* Top Gradient Overlay for header controls readability */}
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'transparent']}
        style={styles.topGradient}
        pointerEvents="none"
      />
      {/* Floating exit fullscreen button at top right */}
      {isFullscreenMode && (
        <TouchableOpacity
          activeOpacity={0.7}
          style={[
            styles.floatingExitBtn,
            { top: Math.max(insets.top, 16) }
          ]}
          onPress={onToggleFullscreen}
        >
          <Ionicons name="contract" size={24} color={COLORS.textLight} />
        </TouchableOpacity>
      )}

      {/* Share and Comments buttons at bottom left in fullscreen mode */}
      {isFullscreenMode && (
        <View style={[styles.fullscreenBottomButtons, { bottom: Math.max(insets.bottom, 24) }]}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.fullscreenRoundBtn}
            onPress={() => setShowShare(true)}
          >
            <Ionicons name="arrow-undo" size={26} color={COLORS.textLight} />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.fullscreenRoundBtn}
            onPress={() => setShowComments(true)}
          >
            <Ionicons name="chatbubbles" size={24} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>
      )}

      {/* Side Actions Overlay (Hidden in Fullscreen Mode) */}
      {!isFullscreenMode && (
        <View style={[
          styles.rightOverlay,
          { top: (insets.top || 0) + 140 }
        ]}>
          <ScrollView
            style={{ width: '100%' }}
            contentContainerStyle={{ flexGrow: 1, justifyContent: 'flex-end', alignItems: 'center', gap: 16, paddingBottom: 10 }}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {/* Creator Profile Avatar */}
            <View style={[styles.avatarContainer, creatorStories.length > 0 && { borderWidth: 0 }]}>
              {creatorStories.length > 0 ? (
                <LinearGradient
                  colors={creatorStoriesSeen ? [COLORS.border, COLORS.border] : ['#F58529', '#DD2A7B', '#8134AF']}
                  style={styles.storyRing}
                >
                  <TouchableOpacity
                    activeOpacity={0.9}
                    style={styles.avatarTouch}
                    onPress={() => {
                      setStoriesViewerVisible(true);
                    }}
                  >
                    <ExpoImage
                      source={{ uri: postUserAvatar || 'https://via.placeholder.com/150' }}
                      style={styles.avatarInRing}
                    />
                  </TouchableOpacity>
                </LinearGradient>
              ) : (
                <TouchableOpacity
                  onPress={async () => {
                    const lookupId = getTargetCreatorId(post);
                    if (lookupId) {
                      try {
                        const res = await apiService.get(`/stories/user/${lookupId}`);
                        if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
                          const formatted = res.data.map((s: any, idx: number) => storyForStoriesViewer(s, idx));
                          creatorStoriesCache.set(lookupId, { stories: formatted, timestamp: Date.now() });
                          setCreatorStories(formatted);
                          setStoriesViewerVisible(true);
                          return;
                        }
                      } catch (_) {}
                    }
                    if (lookupId) router.push(`/user-profile?uid=${lookupId}`);
                  }}
                >
                  <ExpoImage
                    source={{ uri: postUserAvatar || 'https://via.placeholder.com/150' }}
                    style={styles.avatar}
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Follow Button */}
            {!isOwner && (
              <TouchableOpacity style={styles.actionBtn} onPress={handleFollow}>
                <MaterialCommunityIcons
                  name="account-multiple-plus"
                  size={30}
                  color={isFollowing ? "#4cd964" : COLORS.textLight}
                />
                <Text style={[styles.actionText, isFollowing && { color: "#4cd964" }]}>
                  {isFollowing ? "Following" : "Follow"}
                </Text>
              </TouchableOpacity>
            )}

            {/* Comment Button */}
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(true)}>
              <Ionicons name="chatbubbles" size={28} color={COLORS.textLight} />
              <Text style={styles.actionText}>{commentCount}</Text>
            </TouchableOpacity>

            {/* Like Button */}
            <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
              <Ionicons
                name={isLiked ? "heart" : "heart-outline"}
                size={28}
                color={isLiked ? COLORS.danger : COLORS.textLight}
              />
              <Text style={styles.actionText}>{likeCount}</Text>
            </TouchableOpacity>

            {/* Save Button */}
            <TouchableOpacity style={styles.actionBtn} onPress={handleSave}>
              <Ionicons
                name={isSaved ? "bookmark" : "bookmark-outline"}
                size={26}
                color={isSaved ? "#f1c40f" : COLORS.textLight}
              />
              <Text style={styles.actionText}>{savedCount}</Text>
            </TouchableOpacity>

            {/* Share Button */}
            <TouchableOpacity style={styles.actionBtn} onPress={() => setShowShare(true)}>
              <Ionicons name="arrow-redo" size={28} color={COLORS.textLight} />
              <Text style={styles.actionText}>{shareCount}</Text>
            </TouchableOpacity>

            {/* Fullscreen Focus Toggle Button (Scan Icon) */}
            <TouchableOpacity style={styles.actionBtn} onPress={onToggleFullscreen}>
              <Ionicons
                name="scan"
                size={26}
                color={COLORS.textLight}
              />
            </TouchableOpacity>

            {/* Options button (3 dots) at the bottom */}
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setShowMenu(true)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              activeOpacity={0.7}
            >
              <Ionicons name="ellipsis-horizontal" size={26} color={COLORS.textLight} />
            </TouchableOpacity>

            {/* Followed Users Vertical Stories */}
            {followedStories && followedStories.length > 0 && (
              <View style={styles.followedStoriesContainer}>
                {followedStories.map((item: any) => {
                  const isFollowedStorySeen = item.stories && item.stories.length > 0
                    ? item.stories.every((s: any) => seenStoryIds.includes(String(s.id || s._id || '')))
                    : false;

                  return (
                    <TouchableOpacity
                      key={item.userId}
                      style={styles.followedStoryBubble}
                      onPress={() => {
                        setActiveViewerStories(item.stories);
                        setViewerVisible(true);
                      }}
                    >
                      <LinearGradient
                        colors={isFollowedStorySeen ? [COLORS.border, COLORS.border] : ['#F58529', '#DD2A7B', '#8134AF']}
                        style={styles.followedStoryRing}
                      >
                        <ExpoImage
                          source={{ uri: item.userAvatar || 'https://via.placeholder.com/150' }}
                          style={styles.followedStoryAvatar}
                        />
                      </LinearGradient>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </ScrollView>
        </View>
      )}

      {/* Bottom Uploader details & Captions overlay */}
      {!isFullscreenMode && (
        <View style={styles.bottomOverlay} pointerEvents="box-none">
          {isImagePost && imageUrls.length > 1 && (
            <View style={styles.carouselIndicator}>
              {imageUrls.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentImageIndex ? styles.activeDot : styles.inactiveDot,
                  ]}
                />
              ))}
            </View>
          )}
          <View style={styles.captionContainer}>
            <TouchableOpacity
              onPress={() => {
                const uid = post?.userId?._id || post?.userId;
                if (uid) router.push(`/user-profile?uid=${uid}`);
              }}
            >
              <Text style={styles.usernameText}>@{postUserName}</Text>
            </TouchableOpacity>

            {/* Caption & Hashtags integrated flow */}
            {!!(post?.caption || post?.text || rawHashtags.length > 0) && (
              <View style={{ marginTop: 2 }}>
                {!!(post?.caption || post?.text) && (
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => setIsCaptionExpanded(prev => !prev)}
                  >
                    <Text
                      style={styles.captionText}
                      numberOfLines={isCaptionExpanded ? undefined : 2}
                    >
                      {post?.caption || post?.text || ''}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Inline hashtags on next line (tight flow, no gap) */}
                {rawHashtags.length > 0 && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: (post?.caption || post?.text) ? 2 : 0 }}>
                    {rawHashtags.slice(0, 5).map((tag, idx) => (
                      <TouchableOpacity
                        key={`tag-${tag}-${idx}`}
                        onPress={() => {
                          hapticLight();
                          router.push(`/hashtag-detail?tag=${encodeURIComponent(tag)}` as any);
                        }}
                        activeOpacity={0.7}
                        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
                        style={{ marginRight: 6, paddingVertical: 1 }}
                      >
                        <Text style={styles.inlineHashtagText}>#{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Expand / Collapse toggle */}
                {(post?.caption || post?.text || '').length > 60 && (
                  <TouchableOpacity
                    onPress={() => setIsCaptionExpanded(prev => !prev)}
                    activeOpacity={0.7}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    style={{ marginTop: 2 }}
                  >
                    <Text style={styles.moreText}>{isCaptionExpanded ? 'less' : '... more'}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={styles.inputAndEmojiRow} pointerEvents="box-none">
            {/* Add comment mock-input bar */}
            <TouchableOpacity
              style={styles.commentInputBarLeft}
              onPress={() => {
                setAutoFocusComment(true);
                setShowComments(true);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.commentPlaceholder}>Add comment...</Text>
            </TouchableOpacity>

            {/* Laugh & Tomato rating buttons */}
            <View style={styles.ratingContainer} pointerEvents="box-none">
              {/* Floating +1 Laugh Rising Badge */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.floatingBadge,
                  {
                    left: 0,
                    opacity: floatingOpacity,
                    transform: [{ translateY: floatingAnim }],
                  },
                ]}
              >
                <ExpoImage
                  source={require('@/assets/images/Laugh.png')}
                  style={{ width: 20, height: 20, marginRight: 4 }}
                  contentFit="contain"
                />
                <Text style={styles.floatingBadgeText}>+1</Text>
              </Animated.View>

              {/* Floating +1 Tomato Rising Badge */}
              <Animated.View
                pointerEvents="none"
                style={[
                  styles.floatingBadge,
                  {
                    left: 'auto',
                    right: 0,
                    backgroundColor: 'rgba(239, 68, 68, 0.95)',
                    opacity: floatingTomatoOpacity,
                    transform: [{ translateY: floatingTomatoAnim }],
                  },
                ]}
              >
                <ExpoImage
                  source={require('@/assets/images/Tomato.png')}
                  style={{ width: 20, height: 20, marginRight: 4 }}
                  contentFit="contain"
                />
                <Text style={styles.floatingBadgeText}>+1</Text>
              </Animated.View>

              <Animated.View style={{ transform: [{ scale: laughScaleAnim }] }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.ratingBtn, hasLaughed && styles.ratingBtnActiveLaugh]}
                  onPressIn={() => startReactionHold('laugh')}
                  onPressOut={() => endReactionHold('laugh')}
                  delayPressIn={0}
                >
                  <ExpoImage
                    source={require('@/assets/images/Laugh.png')}
                    style={{ width: 36, height: 36 }}
                    contentFit="contain"
                  />
                  <Text style={styles.ratingCount}>{laughCount}</Text>
                </TouchableOpacity>
              </Animated.View>

              <Animated.View style={{ transform: [{ scale: tomatoScaleAnim }] }}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[styles.ratingBtn, hasTomatoed && styles.ratingBtnActiveTomato]}
                  onPressIn={() => startReactionHold('tomato')}
                  onPressOut={() => endReactionHold('tomato')}
                  delayPressIn={0}
                >
                  <ExpoImage
                    source={require('@/assets/images/Tomato.png')}
                    style={{ width: 36, height: 36 }}
                    contentFit="contain"
                  />
                  <Text style={styles.ratingCount}>{tomatoCount}</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </View>
        </View>
      )}

      {/* Comments Drawer Modal - lazily mounted */}
      {showComments && (
        <Modal
          visible={showComments}
          animationType="slide"
          transparent={true}
          onRequestClose={() => {
            setShowComments(false);
            setAutoFocusComment(false);
          }}
        >
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <TouchableOpacity
              style={StyleSheet.absoluteFillObject}
              activeOpacity={1}
              onPress={() => {
                // Keyboard up: first tap just lowers it, like Instagram. Second tap closes the sheet.
                if (Keyboard.isVisible()) {
                  Keyboard.dismiss();
                  return;
                }
                setShowComments(false);
                setAutoFocusComment(false);
              }}
            />
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={{ flex: 1, justifyContent: 'flex-end' }}
              pointerEvents="box-none"
            >
              <Animated.View
                style={[
                  styles.commentsSheet,
                  { transform: [{ translateY }] }
                ]}
              >
                {/* Drag Handle */}
                <View
                  {...panResponder.panHandlers}
                  style={styles.commentsHandleContainer}
                >
                  <View style={styles.commentsHandle} />
                </View>

                <CommentSection
                  postId={post._id || post.id}
                  postOwnerId={post?.userId?._id || post?.userId}
                  currentAvatar={currentUser?.avatar || currentUser?.photoURL || ''}
                  currentUser={currentUser}
                  maxHeight={containerHeight * 0.8}
                  initialTab="comment"
                  autoFocusInput={autoFocusComment}
                />
              </Animated.View>
            </KeyboardAvoidingView>
          </View>
        </Modal>
      )}

      {/* Share Modal */}
      {showShare && (
        <ShareModal
          visible={showShare}
          onClose={() => setShowShare(false)}
          onSend={async (userIds) => {
            try {
              const activeUserId = currentUser?._id || currentUser?.id || currentUser?.uid;
              if (!activeUserId) return;

              for (const recipientId of userIds) {
                const participants = [String(activeUserId), String(recipientId)].sort();
                const convoId = `${participants[0]}_${participants[1]}`;
                await sendPostMessage(convoId, String(activeUserId), post, {
                  recipientId: String(recipientId)
                });
              }
            } catch (err) {
              Alert.alert('Error', 'Failed to share post');
            }
          }}
          currentUserId={currentUser?._id || currentUser?.id || currentUser?.uid}
          sharePayload={post}
          modalVariant="home"
        />
      )}

      {/* Post Options Menu Modal - lazily mounted */}
      {showMenu && (
        <Modal
          visible={showMenu}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowMenu(false)}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' }}
            onPress={() => setShowMenu(false)}
          />
          <View style={styles.menuSheet}>
            <View style={styles.menuHandle} />

            {isOwner ? (
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setShowMenu(false);
                  setTimeout(() => {
                    feedEventEmitter.emit('closePostViewer');
                    setTimeout(() => {
                      router.push(`/create-post?editPostId=${post._id}`);
                    }, 500);
                  }, 250);
                }}
              >
                <Feather name="edit-3" size={20} color={COLORS.textPrimary} />
                <Text style={styles.menuItemText}>Edit Reel</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenu(false);
                    Alert.alert(
                      "Report Reel",
                      "Why are you reporting this reel?",
                      [
                        { text: "Spam", onPress: () => {
                            apiService.reportContent({ targetId: post._id, targetType: 'post', reason: 'spam' });
                            feedEventEmitter.emitFeedUpdate({ type: 'POST_DELETED', postId: post._id });
                            Alert.alert("Reported", "This reel has been hidden from your feed.");
                        }},
                        { text: "Inappropriate", onPress: () => {
                            apiService.reportContent({ targetId: post._id, targetType: 'post', reason: 'inappropriate' });
                            feedEventEmitter.emitFeedUpdate({ type: 'POST_DELETED', postId: post._id });
                            Alert.alert("Reported", "This reel has been hidden from your feed.");
                        }},
                        { text: "Cancel", style: "cancel" }
                      ]
                    );
                  }}
                >
                  <Feather name="flag" size={20} color={COLORS.danger} />
                  <Text style={[styles.menuItemText, { color: COLORS.danger }]}>Report Reel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setShowMenu(false);
                    const targetAuthorId = post?.userId?._id || post?.userId?.id || post?.userId?.uid || post?.userId?.firebaseUid || post?.userId;
                    const myUserId = currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid;
                    if (!targetAuthorId || !myUserId) return;

                    Alert.alert(
                      "Block User",
                      `Block @${postUserName}? You won't see their posts in your feed anymore.`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Block",
                          style: "destructive",
                          onPress: async () => {
                            try {
                              await userService.blockUser(String(myUserId), String(targetAuthorId));
                              feedEventEmitter.emitFeedUpdate({ type: 'USER_BLOCKED', userId: String(targetAuthorId) });
                              Alert.alert("Blocked", `@${postUserName} has been blocked.`);
                            } catch (err) {
                              Alert.alert("Error", "Failed to block user.");
                            }
                          }
                        }
                      ]
                    );
                  }}
                >
                  <Ionicons name="ban-outline" size={20} color={COLORS.danger} />
                  <Text style={[styles.menuItemText, { color: COLORS.danger }]}>Block @{postUserName}</Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity
              style={styles.menuCancelBtn}
              onPress={() => setShowMenu(false)}
            >
              <Text style={styles.menuCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}

      {/* Saved Toast Banner Overlay */}
      {showSavedToast && (
        <TouchableOpacity
          activeOpacity={0.9}
          style={styles.savedToast}
          onPress={() => {
            setShowSavedToast(false);
            setShowCollectionModal(true);
          }}
        >
          <View style={styles.savedToastLeft}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.textLight} />
            <Text style={styles.savedToastText}>Saved</Text>
          </View>
          <View style={styles.savedToastRight}>
            <Text style={styles.savedToastActionText}>Add to a collection</Text>
            <Feather name="chevron-right" size={16} color={COLORS.textLight} />
          </View>
        </TouchableOpacity>
      )}

      {/* Save To Collection Modal */}
      {showCollectionModal && (
        <SaveToCollectionModal
          visible={showCollectionModal}
          onClose={() => setShowCollectionModal(false)}
          postId={post._id || post.id}
          postImageUrl={thumbUrl}
          currentUserId={activeUserId}
          onSaveChange={(saved) => {
            setIsSaved(saved);
          }}
          initialGloballySaved={isSaved}
        />
      )}

      {isLocked && (
        <View style={styles.lockedOverlay}>
          <LinearGradient
            colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.lockedContent}>
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={32} color={COLORS.warning} />
            </View>
            <Text style={styles.lockedTitle}>🌟 Subscribers Only</Text>
            <Text style={styles.lockedDesc}>
              Subscribe to @{postUserName} to unlock this post and support their work.
            </Text>

            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.lockedSubscribeBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
                setSubModalVisible(true);
              }}
            >
              <Text style={styles.lockedSubscribeText}>
                Subscribe to Unlock ${creatorPrice}/mo
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {subModalVisible && (
        <SubscriptionModal
          visible={subModalVisible}
          onClose={async () => {
            setSubModalVisible(false);
            await checkSubscriptionStatus();
          }}
          isOwnProfile={isOwner}
          creatorId={creatorId}
          onSubscriptionChange={(subscribed) => setIsSubscribed(subscribed)}
        />
      )}

      {(viewerVisible || storiesViewerVisible) && ((storiesViewerVisible ? creatorStories.length > 0 : activeViewerStories.length > 0)) && (
        <Modal
          visible={viewerVisible || storiesViewerVisible}
          animationType="fade"
          transparent={false}
          onRequestClose={() => {
            setViewerVisible(false);
            setStoriesViewerVisible(false);
          }}
        >
          <StoriesViewer
            stories={storiesViewerVisible ? creatorStories : activeViewerStories}
            onClose={async () => {
              const isCreatorStories = storiesViewerVisible;
              setViewerVisible(false);
              setStoriesViewerVisible(false);
              // Mark stories as seen and update gradient
              const storiesToMark = isCreatorStories ? creatorStories : activeViewerStories;
              if (storiesToMark.length > 0) {
                try {
                  const ids = storiesToMark.map((s: any) => String(s._id || s.id || '')).filter(Boolean);
                  const raw = await AsyncStorage.getItem('seenStoryIds');
                  const arr = raw ? JSON.parse(raw) : [];
                  const set = new Set<string>(Array.isArray(arr) ? arr.map((x: any) => String(x)) : []);
                  ids.forEach(id => set.add(id));
                  await AsyncStorage.setItem('seenStoryIds', JSON.stringify(Array.from(set)));
                  // Check if all creator stories are now seen
                  await loadSeenStoryIds();
                } catch {}
              }
            }}
          />
        </Modal>
      )}

      {/* TikTok / Instagram Live Floating Reaction Fountain & Firework System */}
      <ReelReactionBurst
        particles={particles}
        onParticleComplete={handleParticleComplete}
        comboCount={comboCount}
        chargeProgress={chargeProgress}
        isHolding={isHoldingReaction}
        holdingType={holdingReactionType}
        isMegaExploded={isMegaExploded}
        explodedType={explodedType}
      />
    </View>
  );
});

interface ReelVideoPlayerProps {
  videoUrl: string;
  isActive: boolean;
  isPlaying: boolean;
  isMuted: boolean;
  isLocked: boolean;
  storiesViewerVisible: boolean;
  setIsLoaded: (val: boolean) => void;
  setIsBuffering: (val: boolean) => void;
  aspectRatio?: number;
}

const ReelVideoPlayer: React.FC<ReelVideoPlayerProps> = ({
  videoUrl,
  isActive,
  isPlaying,
  isMuted,
  isLocked,
  storiesViewerVisible,
  setIsLoaded,
  setIsBuffering,
  aspectRatio,
}) => {
  const shouldPlay = isActive && isPlaying && !isLocked && !storiesViewerVisible;

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = isMuted;
    p.staysActiveInBackground = false;
    if (shouldPlay) {
      p.play();
    }
  });

  // Sync mute state
  useEffect(() => {
    player.muted = isMuted;
  }, [player, isMuted]);

  // Sync play/pause state
  useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, shouldPlay]);

  // Listen to statusChange to toggle loading/buffering states
  useEffect(() => {
    if (player.status === 'readyToPlay') {
      setIsLoaded(true);
      setIsBuffering(false);
    } else if (player.status === 'loading') {
      setIsBuffering(true);
    }

    const subscription = player.addListener('statusChange', (statusChange) => {
      const status = (typeof statusChange === 'object' && statusChange !== null && 'status' in statusChange)
        ? (statusChange as any).status
        : statusChange;
      
      if (status === 'readyToPlay') {
        setIsLoaded(true);
        setIsBuffering(false);
      } else if (status === 'loading') {
        setIsBuffering(true);
      } else if (status === 'error') {
        setIsLoaded(true);
        setIsBuffering(false);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [player, setIsLoaded, setIsBuffering]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="contain"
      nativeControls={false}
    />
  );
};

const styles = StyleSheet.create({
  playPauseContainer: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  },
  playPauseIcon: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4
  },
  bottomGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 250,
    zIndex: 5
  },
  topGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    zIndex: 5
  },
  rightOverlay: {
    position: 'absolute',
    right: 5,
    bottom: 80,
    width: 60,
    alignItems: 'center',
    zIndex: 30,
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: COLORS.textLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,

  },
  avatar: {
    width: 47,
    height: 47,
    borderRadius: 23.5
  },
  storyRing: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTouch: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: COLORS.black,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  followBtn: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: COLORS.info,
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.textLight
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2
  },
  bottomOverlay: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    zIndex: 15,
    gap: 12
  },
  captionContainer: {
    alignItems: 'flex-start',
    gap: 4,
    paddingRight: 60
  },
  usernameText: {
    color: COLORS.textLight,
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2
  },
  captionText: {
    color: COLORS.textLight,
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2
  },
  inlineHashtagText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  hashtagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
    paddingVertical: 2,
  },
  hashtagTouch: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  moreText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  commentInputBar: {
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16
  },
  commentPlaceholder: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14
  },
  commentEmojis: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  emojiIcon: {
    fontSize: 18
  },
  commentsSheet: {
    height: '80%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    marginTop: 'auto',
    elevation: 5,
    shadowOpacity: 0.15,
    shadowRadius: 10
  },
  commentsHandleContainer: {
    height: 30,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.background
  },
  commentsHandle: {
    height: 4,
    width: 40,
    backgroundColor: COLORS.border,
    borderRadius: 2
  },
  menuSheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    marginTop: 'auto',
    paddingHorizontal: 16
  },
  menuHandle: {
    height: 4,
    width: 40,
    backgroundColor: COLORS.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 12
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.textPrimary
  },
  menuCancelBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.info
  },
  centerMuteBtn: {
    position: 'absolute',
    alignSelf: 'center',
    top: '39%', // Shifted higher to increase gap between play button (50%) and mute button
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 12,
  },
  floatingExitBtn: {
    position: 'absolute',
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 25,
  },
  inputAndEmojiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  commentInputBarLeft: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ratingBtn: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    minWidth: 32,
  },
  ratingBtnActiveLaugh: {
    backgroundColor: 'transparent',
  },
  ratingBtnActiveTomato: {
    backgroundColor: 'transparent',
  },
  floatingBadge: {
    position: 'absolute',
    top: -36,
    left: -4,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 149, 0, 0.95)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    zIndex: 99,
  },
  floatingBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  ratingEmoji: {
    fontSize: 16,
  },
  ratingCount: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 1,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  carouselIndicator: {
    flexDirection: 'row',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  activeDot: {
    backgroundColor: COLORS.background,
    transform: [{ scale: 1.2 }],
  },
  inactiveDot: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  savedToast: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(38, 38, 38, 0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    zIndex: 99,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  savedToastLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  savedToastText: {
    color: COLORS.textLight,
    fontSize: 15,
    fontWeight: '600',
  },
  savedToastRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedToastActionText: {
    color: COLORS.textLight,
    fontSize: 14,
    fontWeight: '600',
  },
  fullscreenBottomButtons: {
    position: 'absolute',
    left: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    zIndex: 25,
  },
  fullscreenRoundBtn: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  lockedOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  lockedContent: {
    paddingHorizontal: 32,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  lockBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 214, 10, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 214, 10, 0.3)',
  },
  lockedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textLight,
    marginBottom: 8,
    textAlign: 'center',
  },
  lockedDesc: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  lockedSubscribeBtn: {
    backgroundColor: COLORS.warning,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 28,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  lockedSubscribeText: {
    color: COLORS.black,
    fontSize: 15,
    fontWeight: '700',
  },
  followedStoriesContainer: {
    width: '100%',
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
    paddingTop: 16,
    alignItems: 'center',
    gap: 12,
  },
  followedStoryBubble: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followedStoryRing: {
    width: 42,
    height: 42,
    borderRadius: 21,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followedStoryAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: COLORS.black,
  },
});

export default ReelItem;
