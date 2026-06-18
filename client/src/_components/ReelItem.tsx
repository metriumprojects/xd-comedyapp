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
  ActivityIndicator,
  FlatList
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { CommentSection } from './CommentSection';
import ShareModal from './ShareModal';
import SaveToCollectionModal from './SaveToCollectionModal';
import { likePost, unlikePost, sendPostMessage, followUser, unfollowUser } from '../../lib/firebaseHelpers';
import { apiService } from '@/src/_services/apiService';
import { normalizeAvatarUrl, getOptimizedMediaUrl, isVideoUrl } from '../../lib/utils/media';
import { getVideoThumbnailUrl } from '../../lib/imageHelpers';
import { feedEventEmitter } from '../../lib/feedEventEmitter';
import { useUser } from './UserContext';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@/lib/storage';
import { SubscriptionModal } from './profile/SubscriptionModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ReelItemProps {
  post: any;
  currentUser: any;
  isActive: boolean;
  isMuted: boolean;
  toggleMute: () => void;
  containerHeight: number;
  isFullscreenMode: boolean;
  onToggleFullscreen: () => void;
}

export const ReelItem: React.FC<ReelItemProps> = ({
  post,
  currentUser,
  isActive,
  isMuted,
  toggleMute,
  containerHeight,
  isFullscreenMode,
  onToggleFullscreen
}) => {
  const router = useRouter();
  const user = useUser();
  const insets = useSafeAreaInsets();
  const videoRef = useRef<Video>(null);

  const [isLoaded, setIsLoaded] = useState(false);
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
  const [showShare, setShowShare] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isFollowing, setIsFollowing] = useState(post?.isFollowing || false);
  const [isSaved, setIsSaved] = useState(() => {
    if (post?.isSaved !== undefined) return post.isSaved;
    const myId = String(currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid || '');
    if (myId && Array.isArray(post?.savedBy)) {
      return post.savedBy.includes(myId);
    }
    return false;
  });

  // Laugh & Tomato Ratings States
  const [laughCount, setLaughCount] = useState(post?.laughCount || 0);
  const [tomatoCount, setTomatoCount] = useState(post?.tomatoCount || 0);
  const [hasLaughed, setHasLaughed] = useState(false);
  const [hasTomatoed, setHasTomatoed] = useState(false);

  // Save Toast & Collection selector states
  const [showSavedToast, setShowSavedToast] = useState(false);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

  const activeUserId = useMemo(() => {
    return (
      (typeof currentUser === 'string' ? currentUser : (currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid)) ||
      user?._id || user?.id || user?.uid || ''
    );
  }, [currentUser, user]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // Synchronize local states when the post prop or currentUser changes
  useEffect(() => {
    if (!post) return;
    const myId = String(currentUser?._id || currentUser?.id || currentUser?.uid || currentUser?.firebaseUid || '');

    // Sync isSaved
    if (post.isSaved !== undefined) {
      setIsSaved(post.isSaved);
    } else if (myId && Array.isArray(post.savedBy)) {
      setIsSaved(post.savedBy.includes(myId));
    } else {
      setIsSaved(false);
    }

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
    setIsFollowing(post.isFollowing || false);
    setHasLaughed(post.hasLaughed || false);
    setHasTomatoed(post.hasTomatoed || false);
  }, [post, currentUser]);

  // Reset index indicator and loading state ONLY when active post ID changes
  useEffect(() => {
    setCurrentImageIndex(0);
    setIsLoaded(false);
    setIsBuffering(false);
  }, [post?._id]);

  // Subscribe to real-time updates for this specific post
  useEffect(() => {
    if (!post?._id) return;
    const sub = feedEventEmitter.onPostUpdated(post._id, (pid, data) => {
      if (!data) return;
      if (data.isSaved !== undefined) {
        setIsSaved(data.isSaved);
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
      if (data.laughCount !== undefined) {
        setLaughCount(data.laughCount);
      }
      if (data.tomatoCount !== undefined) {
        setTomatoCount(data.tomatoCount);
      }
      if (data.isFollowing !== undefined) {
        setIsFollowing(data.isFollowing);
      }
    });

    return () => {
      sub.remove();
    };
  }, [post?._id]);

  const translateY = useRef(new Animated.Value(0)).current;

  // Pan Responder for dragging down comments modal
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
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
      if (videoRef.current) {
        videoRef.current.playAsync().catch(() => { });
      }
    } else {
      setIsPlaying(false);
      if (videoRef.current) {
        videoRef.current.pauseAsync().catch(() => { });
      }
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
    setIsSaved(newSaved);

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
      feedEventEmitter.emitFeedUpdate({
        type: 'POST_UPDATED',
        postId: post._id,
        data: { isSaved: newSaved }
      });
    } catch (err) {
      setIsSaved(!newSaved);
      setShowSavedToast(false);
      Alert.alert("Error", "Failed to save post");
    }
  }, [isSaved, post._id, currentUser, user]);

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
    } catch (err: any) {
      setIsFollowing(!newFollowing);
      Alert.alert("Error", err.message || "Failed to perform follow action");
    }
  }, [isFollowing, post?.userId, activeUserId]);

  // Handle Laugh (😂) Rating Press
  const handleLaughPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    const newLaughed = !hasLaughed;
    setHasLaughed(newLaughed);
    setLaughCount((prev: number) => newLaughed ? prev + 1 : prev - 1);

    // Toggle off tomato if user had rated it bad
    if (newLaughed && hasTomatoed) {
      setHasTomatoed(false);
      setTomatoCount((prev: number) => prev - 1);
    }

    try {
      await apiService.post(`/posts/${post._id}/rate`, { type: 'laugh', active: newLaughed });
    } catch (e) {
      // Local state is enough for offline/dev
    }
  }, [hasLaughed, hasTomatoed, post._id]);

  // Handle Tomato (🍅) Rating Press
  const handleTomatoPress = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
    const newTomatoed = !hasTomatoed;
    setHasTomatoed(newTomatoed);
    setTomatoCount((prev: number) => newTomatoed ? prev + 1 : prev - 1);

    // Toggle off laugh if user had rated it funny
    if (newTomatoed && hasLaughed) {
      setHasLaughed(false);
      setLaughCount((prev: number) => prev - 1);
    }

    try {
      await apiService.post(`/posts/${post._id}/rate`, { type: 'tomato', active: newTomatoed });
    } catch (e) {
      // Local state is enough for offline/dev
    }
  }, [hasTomatoed, hasLaughed, post._id]);

  const postUserName = post?.userName || post?.user?.displayName || post?.user?.name || post?.userId?.displayName || post?.userId?.name || 'User';
  const postUserAvatar = normalizeAvatarUrl(
    post?.userAvatar || post?.user?.profilePicture || post?.user?.avatar || post?.user?.photoURL || post?.userId?.avatar || post?.userId?.profilePicture
  );

  const videoUrl = useMemo(() => {
    const media = Array.isArray(post?.media) ? post.media[0] : null;
    let url = media?.url || post?.mediaUrls?.[0] || post?.imageUrl || '';
    return getOptimizedMediaUrl(url);
  }, [post]);

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
    const subscribedKey = `sub_subscribed_${activeUserId}_to_${creatorId}`;
    const priceKey = `sub_tier_${creatorId}`;
    try {
      const [subVal, priceVal] = await Promise.all([
        AsyncStorage.getItem(subscribedKey),
        AsyncStorage.getItem(priceKey)
      ]);
      setIsSubscribed(subVal === 'true');
      if (priceVal) {
        const parsed = JSON.parse(priceVal);
        if (parsed && parsed.price) {
          setCreatorPrice(parsed.price);
        }
      }
    } catch (e) {
      console.warn('[ReelItem] Error checking subscription status:', e);
    }
  }, [activeUserId, creatorId, isOwner]);

  useEffect(() => {
    checkSubscriptionStatus();
  }, [checkSubscriptionStatus, isActive]);

  return (
    <View style={{ width: SCREEN_WIDTH, height: containerHeight, backgroundColor: '#000' }}>
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
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
            <Text style={{ color: '#fff' }}>No Image Available</Text>
          </View>
        )
      ) : videoUrl ? (
        <Video
          ref={videoRef}
          source={{ uri: videoUrl }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          isLooping
          shouldPlay={isActive && isPlaying && !isLocked}
          isMuted={isMuted}
          useNativeControls={false}
          usePoster={!!thumbUrl}
          posterSource={thumbUrl ? { uri: thumbUrl } : undefined}
          posterStyle={{ resizeMode: 'cover' }}
          onLoadStart={() => console.log('📡 [Reels] Start loading video:', videoUrl)}
          onLoad={() => {
            console.log('✅ [Reels] Video loaded successfully:', videoUrl);
            setIsLoaded(true);
            setIsBuffering(false);
          }}
          onError={(error) => {
            console.warn('🔴 [Reels] Video load error:', error, 'for URL:', videoUrl);
            setIsLoaded(true); // Prevent infinite spinner if video fails to load
            setIsBuffering(false);
          }}
          onPlaybackStatusUpdate={(status: any) => {
            if (!status.isLoaded) {
              setIsBuffering(true);
            } else {
              setIsBuffering(status.isBuffering);
              if (status.isLoaded && !isLoaded) {
                setIsLoaded(true);
              }
            }
          }}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
          <Text style={{ color: '#fff' }}>No Video Available</Text>
        </View>
      )}

      {/* Centered Buffering Spinner (Overlay) */}
      {(isBuffering || !isLoaded) && (
        <View style={styles.loadingContainer} pointerEvents="none">
          <ActivityIndicator size="large" color="#ffffff" />
        </View>
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
            <Ionicons name="play" size={36} color="#fff" />
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
            color="#ffffff"
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
          <Ionicons name="contract" size={24} color="#ffffff" />
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
            <Ionicons name="arrow-undo" size={26} color="#ffffff" />
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.7}
            style={styles.fullscreenRoundBtn}
            onPress={() => setShowComments(true)}
          >
            <Ionicons name="chatbubbles" size={24} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Side Actions Overlay (Hidden in Fullscreen Mode) */}
      {!isFullscreenMode && (
        <View style={styles.rightOverlay}>
          {/* Creator Profile Avatar */}
          <View style={styles.avatarContainer}>
            <TouchableOpacity
              onPress={() => {
                const uid = post?.userId?._id || post?.userId;
                if (uid) router.push(`/user-profile?uid=${uid}`);
              }}
            >
              <ExpoImage
                source={{ uri: postUserAvatar || 'https://via.placeholder.com/150' }}
                style={styles.avatar}
              />
            </TouchableOpacity>
            {/* Follow Plus overlay */}
            {!isOwner && !isFollowing && (
              <TouchableOpacity style={styles.followBtn} onPress={handleFollow}>
                <Ionicons name="add" size={12} color="#fff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Like Button */}
          <TouchableOpacity style={styles.actionBtn} onPress={handleLike}>
            <Ionicons
              name={isLiked ? "heart" : "heart-outline"}
              size={32}
              color={isLiked ? "#ff3b30" : "#ffffff"}
            />
            <Text style={styles.actionText}>{likeCount}</Text>
          </TouchableOpacity>

          {/* Comment Button */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowComments(true)}>
            <Ionicons name="chatbubble" size={28} color="#ffffff" />
            <Text style={styles.actionText}>{commentCount}</Text>
          </TouchableOpacity>

          {/* Save Button */}
          <TouchableOpacity style={styles.actionBtn} onPress={handleSave}>
            <Ionicons
              name={isSaved ? "bookmark" : "bookmark-outline"}
              size={28}
              color={isSaved ? "#f1c40f" : "#ffffff"}
            />
            <Text style={styles.actionText}>Save</Text>
          </TouchableOpacity>

          {/* Share Button */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowShare(true)}>
            <Feather name="share-2" size={28} color="#ffffff" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>

          {/* Fullscreen Focus Toggle Button */}
          <TouchableOpacity style={styles.actionBtn} onPress={onToggleFullscreen}>
            <Ionicons
              name="expand"
              size={26}
              color="#ffffff"
            />
            <Text style={styles.actionText}>Full</Text>
          </TouchableOpacity>

          {/* Options button (3 dots) at the bottom */}
          <TouchableOpacity style={styles.actionBtn} onPress={() => setShowMenu(true)}>
            <Ionicons name="ellipsis-horizontal" size={26} color="#ffffff" />
          </TouchableOpacity>
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
            <Text style={styles.captionText} numberOfLines={3}>
              {post?.caption || post?.text || ''}
            </Text>
          </View>

          <View style={styles.inputAndEmojiRow} pointerEvents="box-none">
            {/* Add comment mock-input bar */}
            <TouchableOpacity
              style={styles.commentInputBarLeft}
              onPress={() => setShowComments(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.commentPlaceholder}>Add comment...</Text>
            </TouchableOpacity>

            {/* Laugh & Tomato rating buttons */}
            <View style={styles.ratingContainer} pointerEvents="box-none">
              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.ratingBtn, hasLaughed && styles.ratingBtnActiveLaugh]}
                onPress={handleLaughPress}
              >
                <Text style={styles.ratingEmoji}>😂</Text>
                <Text style={styles.ratingCount}>{laughCount}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.7}
                style={[styles.ratingBtn, hasTomatoed && styles.ratingBtnActiveTomato]}
                onPress={handleTomatoPress}
              >
                <Text style={styles.ratingEmoji}>🍅</Text>
                <Text style={styles.ratingCount}>{tomatoCount}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Comments Drawer Modal */}
      <Modal
        visible={showComments}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowComments(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'transparent' }}
          onPress={() => setShowComments(false)}
        />
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
          />
        </Animated.View>
      </Modal>

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

      {/* Post Options Menu Modal */}
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
                router.push(`/create-post?editPostId=${post._id}&initialData=${encodeURIComponent(JSON.stringify(post))}`);
              }}
            >
              <Feather name="edit-3" size={20} color="#333" />
              <Text style={styles.menuItemText}>Edit Reel</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setShowMenu(false);
                Alert.alert(
                  "Report Reel",
                  "Why are you reporting this reel?",
                  [
                    { text: "Spam", onPress: () => apiService.reportContent({ targetId: post._id, targetType: 'post', reason: 'spam' }) },
                    { text: "Inappropriate", onPress: () => apiService.reportContent({ targetId: post._id, targetType: 'post', reason: 'inappropriate' }) },
                    { text: "Cancel", style: "cancel" }
                  ]
                );
              }}
            >
              <Feather name="flag" size={20} color="#ff3b30" />
              <Text style={[styles.menuItemText, { color: '#ff3b30' }]}>Report Reel</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.menuCancelBtn}
            onPress={() => setShowMenu(false)}
          >
            <Text style={styles.menuCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>

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
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.savedToastText}>Saved</Text>
          </View>
          <View style={styles.savedToastRight}>
            <Text style={styles.savedToastActionText}>Add to a collection</Text>
            <Feather name="chevron-right" size={16} color="#fff" />
          </View>
        </TouchableOpacity>
      )}

      {/* Save To Collection Modal */}
      <SaveToCollectionModal
        visible={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        postId={post._id || post.id}
        postImageUrl={thumbUrl}
        currentUserId={activeUserId}
        onSaveChange={(saved) => {
          setIsSaved(saved);
          feedEventEmitter.emitFeedUpdate({
            type: 'POST_UPDATED',
            postId: post._id,
            data: { isSaved: saved }
          });
        }}
        initialGloballySaved={isSaved}
      />

      {isLocked && (
        <View style={styles.lockedOverlay}>
          <LinearGradient
            colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.95)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.lockedContent}>
            <View style={styles.lockBadge}>
              <Ionicons name="lock-closed" size={32} color="#FFD60A" />
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
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
    zIndex: 10,
  },
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
    right: 8,
    bottom: 98,
    alignItems: 'center',
    zIndex: 15,
    gap: 16
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8
  },
  avatar: {
    width: 47,
    height: 47,
    borderRadius: 23.5
  },
  followBtn: {
    position: 'absolute',
    bottom: -6,
    backgroundColor: '#0095f6',
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fff'
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    color: '#ffffff',
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
    bottom: 12,
    zIndex: 15,
    gap: 12
  },
  captionContainer: {
    alignItems: 'flex-start',
    gap: 4,
    paddingRight: 60
  },
  usernameText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2
  },
  captionText: {
    color: '#ffffff',
    fontSize: 14,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff'
  },
  commentsHandle: {
    height: 4,
    width: 40,
    backgroundColor: '#ddd',
    borderRadius: 2
  },
  menuSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    marginTop: 'auto',
    paddingHorizontal: 16
  },
  menuHandle: {
    height: 4,
    width: 40,
    backgroundColor: '#ddd',
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
    color: '#333'
  },
  menuCancelBtn: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8
  },
  menuCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0095f6'
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    height: 38,
    borderRadius: 19,
    gap: 4,
    justifyContent: 'center',
  },
  ratingBtnActiveLaugh: {
    backgroundColor: 'rgba(251, 188, 4, 0.35)',
    borderColor: '#fbbc04',
  },
  ratingBtnActiveTomato: {
    backgroundColor: 'rgba(231, 76, 60, 0.35)',
    borderColor: '#e74c3c',
  },
  ratingEmoji: {
    fontSize: 16,
  },
  ratingCount: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
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
    backgroundColor: '#ffffff',
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
    shadowColor: '#000',
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
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  savedToastRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedToastActionText: {
    color: '#fff',
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
    shadowColor: '#000',
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
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  lockedDesc: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  lockedSubscribeBtn: {
    backgroundColor: '#FFD60A',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  lockedSubscribeText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
});

export default ReelItem;
