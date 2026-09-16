import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { View, FlatList, TouchableOpacity, Dimensions, NativeSyntheticEvent, NativeScrollEvent, Text, Image, StyleSheet, Pressable } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from "@expo/vector-icons";
import { useIsFocused } from '@react-navigation/native';
import { styles } from './PostCard.styles';
import { BACKEND_URL } from '../../../lib/api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── ASPECT RATIO HELPERS ────────────────────────────────────────────────────
// No clamping – return the real ratio. 0 means unknown (measure from content).
export const getDisplayRatio = (aspectRatio?: number): number =>
  aspectRatio && aspectRatio > 0 ? aspectRatio : 0;

export const getMediaHeight = (aspectRatio?: number): number => {
  const r = getDisplayRatio(aspectRatio);
  return r > 0 ? SCREEN_WIDTH / r : SCREEN_WIDTH;
};
// ─────────────────────────────────────────────────────────────────────────────

interface MediaItem {
  url: string;
  type?: 'image' | 'video' | string;
  field?: string;
  aspectRatio?: number;
  thumbnailUrl?: string;
}

import { getOptimizedMediaUrl } from '../../../lib/utils/media';

const getMediaUrl = (url: string) => {
  return getOptimizedMediaUrl(url);
};

// ─── VIDEO ITEM (using high-performance expo-video) ─────────────────────────

interface VideoItemProps {
  url: string;
  containerHeight?: number; // undefined → self-sizes via natural ratio
  shouldPlay: boolean;
  isMuted: boolean;
  toggleMute: () => void;
  onPress: () => void;
  onPlayPress?: () => void;
  thumbnailUrl?: string;
  initialAspectRatio?: number;
  videoRef?: any;
}

const VideoItem: React.FC<VideoItemProps> = ({
  url,
  containerHeight,
  shouldPlay,
  isMuted,
  toggleMute,
  onPress,
  onPlayPress,
  thumbnailUrl,
  initialAspectRatio,
}) => {
  const videoViewRef = useRef<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  
  // If stored ratio is 1.0, it was likely an unmeasured fallback in DB.
  // We don't lock to 1.0 so thumbnail or video metadata can provide the real aspect ratio.
  const isSuspiciousDefault = initialAspectRatio === 1;
  const [naturalRatio, setNaturalRatio] = useState<number | null>(
    initialAspectRatio && initialAspectRatio > 0 && !isSuspiciousDefault ? initialAspectRatio : null
  );

  const mediaUri = getMediaUrl(url);
  const thumbUri = thumbnailUrl ? getMediaUrl(thumbnailUrl) : undefined;

  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleFullscreen = async () => {
    try {
      setIsFullscreen(true);
      setTimeout(async () => {
        try {
          await videoViewRef.current?.enterFullscreen();
        } catch (e) {
          setIsFullscreen(false);
          console.warn('Fullscreen error:', e);
        }
      }, 60);
    } catch (e) {
      setIsFullscreen(false);
      console.warn('Fullscreen error:', e);
    }
  };

  const handleRatio = useCallback((w: number, h: number) => {
    if (!w || !h || h === 0) return;
    const ratio = w / h;
    setNaturalRatio(ratio);
  }, []);

  // Instantly probe thumbnail dimensions so the container sizes correctly in 0-16ms
  useEffect(() => {
    if (thumbUri && (!naturalRatio || isSuspiciousDefault)) {
      Image.getSize(
        thumbUri,
        (w, h) => {
          if (w && h) handleRatio(w, h);
        },
        () => {}
      );
    }
  }, [thumbUri, naturalRatio, isSuspiciousDefault, handleRatio]);

  // High-performance native player from expo-video
  const player = useVideoPlayer(mediaUri, (p) => {
    p.loop = true;
    p.muted = isMuted;
    if (shouldPlay) {
      p.play();
    }
  });

  // Sync mute state
  useEffect(() => {
    if (player) {
      player.muted = isMuted;
    }
  }, [player, isMuted]);

  // Sync play/pause state
  useEffect(() => {
    if (!player) return;
    if (shouldPlay) {
      if (!player.playing) {
        player.play();
      }
    } else {
      if (player.playing) {
        player.pause();
      }
    }
  }, [player, shouldPlay]);

  // Track playing state directly from player
  useEffect(() => {
    if (!player) return;
    setIsPlaying(player.playing);

    const sub = player.addListener('playingChange', (event: any) => {
      const active = typeof event === 'boolean' ? event : !!event?.isPlaying;
      setIsPlaying(active);
    });

    return () => {
      sub.remove();
    };
  }, [player]);

  // Track readiness to hide thumbnail
  useEffect(() => {
    if (!player) return;
    if (player.status === 'readyToPlay') {
      setIsLoaded(true);
    }

    const sub = player.addListener('statusChange', (statusChange: any) => {
      const status = (typeof statusChange === 'object' && statusChange !== null && 'status' in statusChange)
        ? statusChange.status
        : statusChange;
      if (status === 'readyToPlay' || status === 'error') {
        setIsLoaded(true);
      }
    });

    return () => {
      sub.remove();
    };
  }, [player]);

  const handlePlayButtonPress = useCallback(() => {
    if (player) {
      player.play();
    }
    if (onPlayPress) {
      onPlayPress();
    } else {
      onPress();
    }
  }, [player, onPlayPress, onPress]);

  const handleSurfaceTap = useCallback(() => {
    if (player) {
      if (player.playing) {
        player.pause();
      } else {
        player.play();
      }
    }
    onPress();
  }, [player, onPress]);

  const fixedMode = containerHeight != null;
  const wrapperRatio = naturalRatio || 1;
  const finalHeight = fixedMode ? containerHeight! : (SCREEN_WIDTH / wrapperRatio);

  const showPlayButton = !isFullscreen && (!shouldPlay || !isPlaying);

  return (
    <View
      style={{ width: SCREEN_WIDTH, height: finalHeight, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' }}
    >
      <VideoView
        ref={videoViewRef}
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={isFullscreen}
        allowsFullscreen
        onFullscreenEnter={() => {
          setIsFullscreen(true);
        }}
        onFullscreenExit={() => {
          setIsFullscreen(false);
        }}
      />

      {/* Instant placeholder from cache until video is ready to play */}
      {!isLoaded && thumbUri && (
        <ExpoImage
          source={{ uri: thumbUri }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          cachePolicy="memory-disk"
          transition={0}
          pointerEvents="none"
          onLoad={(e) => {
            const { width, height } = e?.source || {};
            if (width && height && height > 0) {
              handleRatio(width, height);
            }
          }}
        />
      )}

      {/* Touch surface on top of VideoView so user can tap anywhere on the video */}
      {!isFullscreen && (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleSurfaceTap}
        />
      )}

      {/* Central Play Button when paused */}
      {showPlayButton && (
        <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', zIndex: 30 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={handlePlayButtonPress}
            style={{ backgroundColor: 'rgba(0,0,0,0.4)', width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', paddingLeft: 5 }}
          >
            <Ionicons name="play" size={40} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {!isFullscreen && (
        <View style={styles.videoOverlay} pointerEvents="box-none">
          <TouchableOpacity activeOpacity={0.7} style={styles.muteButtonMini} onPress={toggleMute}>
            <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}

      {!isFullscreen && (
        <View style={styles.videoBottomOverlay} pointerEvents="box-none">
          <TouchableOpacity activeOpacity={0.7} style={styles.muteButtonMini} onPress={handleFullscreen}>
            <Ionicons name="expand" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// ─── IMAGE ITEM ───────────────────────────────────────────────────────────────

interface ImageItemProps {
  url: string;
  containerHeight?: number; // undefined → self-sizes via natural ratio
  onPress: () => void;
  priority?: "high" | "normal";
  thumbnailUrl?: string;
  isFullScreen?: boolean;
  onRatioDetected?: (ratio: number) => void;
}

const ImageItem: React.FC<ImageItemProps> = ({
  url,
  containerHeight,
  onPress,
  priority = "normal",
  thumbnailUrl,
  isFullScreen,
  onRatioDetected,
}) => {
  const [naturalRatio, setNaturalRatio] = useState<number | null>(null);
  const mediaUri = getMediaUrl(url);
  const thumbUri = thumbnailUrl ? getMediaUrl(thumbnailUrl) : undefined;

  const handleRatio = useCallback((w: number, h: number) => {
    if (!w || !h || h === 0) return;
    const ratio = w / h;
    setNaturalRatio(ratio);
    onRatioDetected?.(ratio);
  }, [onRatioDetected]);

  useEffect(() => {
    if (thumbUri && !naturalRatio) {
      Image.getSize(
        thumbUri,
        (w, h) => {
          if (w && h) handleRatio(w, h);
        },
        () => {}
      );
    }
  }, [thumbUri, naturalRatio, handleRatio]);

  const fixedMode = containerHeight != null;
  const wrapperRatio = naturalRatio || 1;
  const finalHeight = fixedMode ? containerHeight! : (SCREEN_WIDTH / wrapperRatio);

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onPress}
      style={{ width: SCREEN_WIDTH, height: finalHeight, backgroundColor: '#000' }}
    >
      <ExpoImage
        source={{ uri: mediaUri }}
        placeholder={thumbUri ? { uri: thumbUri } : undefined}
        style={{ width: SCREEN_WIDTH, height: finalHeight }}
        contentFit="contain"
        cachePolicy="memory-disk"
        priority={priority}
        recyclingKey={url}
        transition={150}
        onLoad={(e) => {
          const { width, height } = e?.source || {};
          if (width && height && height > 0) {
            handleRatio(width, height);
          }
        }}
      />
    </TouchableOpacity>
  );
};

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

interface PostMediaProps {
  media: MediaItem[];
  mediaHeight?: number;
  activeIndex: number;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onMediaPress: (index: number) => void;
  onDoubleTap?: () => void;
  isMuted: boolean;
  toggleMute: () => void;
  videoRef?: any;
  isLocked?: boolean;
  isFullScreen?: boolean;
  isActive?: boolean;
}

const PostMedia: React.FC<PostMediaProps> = ({
  media,
  mediaHeight,
  onScroll,
  onMediaPress,
  isMuted,
  toggleMute,
  videoRef,
  onDoubleTap,
  isLocked = false,
  isFullScreen = false,
  isActive,
}) => {
  const isFocused = useIsFocused();
  const [userOverride, setUserOverride] = useState<'play' | 'pause' | null>(null);
  const [localActiveIndex, setLocalActiveIndex] = useState(0);
  const [isInitialScrollDone, setIsInitialScrollDone] = useState(false);

  // Reset user override state when post active status or slide changes
  useEffect(() => {
    setUserOverride(null);
  }, [isActive, localActiveIndex]);

  const lastTap = useRef<number>(0);
  const flatListRef = useRef<FlatList>(null);

  const autoPlayAllowed = (isActive !== undefined ? isActive : true) && isFocused && !isLocked;
  const effectiveShouldPlay = userOverride !== null
    ? (userOverride === 'play')
    : autoPlayAllowed;

  const handlePress = useCallback((index: number, isVideo: boolean = false) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (lastTap.current && (now - lastTap.current) < DOUBLE_TAP_DELAY) {
      if (isVideo) {
        // Double tap liked the post: preserve playback state
        setUserOverride(prev => (prev === 'pause' ? 'play' : prev === 'play' ? 'pause' : null));
      }
      onDoubleTap?.();
    } else if (isVideo) {
      // Direct user tap overrides autoplay and toggles play/pause reliably
      setUserOverride(prev => {
        const currentlyPlaying = prev !== null ? (prev === 'play') : effectiveShouldPlay;
        return currentlyPlaying ? 'pause' : 'play';
      });
    } else {
      onMediaPress(index);
    }
    lastTap.current = now;
  }, [onDoubleTap, onMediaPress, effectiveShouldPlay]);

  const handlePlayPress = useCallback(() => {
    setUserOverride('play');
  }, []);

  const firstItem = media[0];

  // ── SINGLE ITEM ─────────────────────────────────────────────────────────────
  if (media.length === 1) {
    const item = firstItem;
    const isVideo = item.type === 'video'
      || item.url?.toLowerCase().includes('.mp4')
      || item.url?.toLowerCase().includes('.mov')
      || item.url?.includes('video/upload');

    // Full-screen modal: fill entire screen height
    if (isFullScreen) {
      const fsHeight = Dimensions.get('window').height;
      return isVideo ? (
        <VideoItem
          url={item.url}
          containerHeight={fsHeight}
          shouldPlay={effectiveShouldPlay}
          isMuted={isMuted}
          toggleMute={toggleMute}
          videoRef={videoRef}
          onPress={() => handlePress(0, true)}
          onPlayPress={handlePlayPress}
          thumbnailUrl={item.thumbnailUrl}
          initialAspectRatio={item.aspectRatio}
        />
      ) : (
        <ImageItem
          url={item.url}
          containerHeight={fsHeight}
          onPress={() => handlePress(0)}
          priority="high"
          thumbnailUrl={item.thumbnailUrl}
        />
      );
    }

    // Normal: pass containerHeight=undefined → item sizes itself from natural ratio
    // If caller overrides with explicit mediaHeight, respect that.
    return isVideo ? (
      <VideoItem
        url={item.url}
        containerHeight={mediaHeight}
        shouldPlay={effectiveShouldPlay}
        isMuted={isMuted}
        toggleMute={toggleMute}
        videoRef={videoRef}
        onPress={() => handlePress(0, true)}
        onPlayPress={handlePlayPress}
        thumbnailUrl={item.thumbnailUrl}
        initialAspectRatio={item.aspectRatio}
      />
    ) : (
      <ImageItem
        url={item.url}
        containerHeight={mediaHeight}
        onPress={() => handlePress(0)}
        priority="high"
        thumbnailUrl={item.thumbnailUrl}
      />
    );
  }

  // ── MULTI-ITEM CAROUSEL ──────────────────────────────────────────────────────
  // FlatList needs consistent item heights. Use stored ratio of first item,
  // fall back to square. All items use contentFit="contain" so nothing is cropped.
  const storedRatio = firstItem?.aspectRatio;
  const carouselHeight = isFullScreen
    ? Dimensions.get('window').height
    : mediaHeight || (storedRatio && storedRatio > 0 ? SCREEN_WIDTH / storedRatio : SCREEN_WIDTH);

  const renderItem = useCallback(({ item, index }: { item: MediaItem; index: number }) => {
    const isVideo = item.type === 'video'
      || item.url?.toLowerCase().includes('.mp4')
      || item.url?.toLowerCase().includes('.mov')
      || item.url?.includes('video/upload');

    const normalizedIndex = index % media.length;
    const isCurrentSlide = normalizedIndex === localActiveIndex;
    const shouldAutoPlay = effectiveShouldPlay && isCurrentSlide;

    return isVideo ? (
      <VideoItem
        url={item.url}
        containerHeight={carouselHeight}
        shouldPlay={shouldAutoPlay}
        isMuted={isMuted}
        toggleMute={toggleMute}
        videoRef={isCurrentSlide ? videoRef : undefined}
        onPress={() => handlePress(index, true)}
        onPlayPress={handlePlayPress}
        thumbnailUrl={item.thumbnailUrl}
        initialAspectRatio={item.aspectRatio}
      />
    ) : (
      <ImageItem
        url={item.url}
        containerHeight={carouselHeight}
        onPress={() => handlePress(index)}
        priority={index === 0 ? "high" : "normal"}
        thumbnailUrl={item.thumbnailUrl}
        isFullScreen={isFullScreen}
      />
    );
  }, [media, carouselHeight, effectiveShouldPlay, localActiveIndex, isMuted, toggleMute, videoRef, handlePress, handlePlayPress, isFullScreen]);

  const loopedMedia = useMemo(() => {
    if (media.length <= 1) return media;
    return [...media, ...media, ...media];
  }, [media]);

  useEffect(() => {
    if (media.length > 1 && flatListRef.current && !isInitialScrollDone) {
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: media.length * SCREEN_WIDTH,
          animated: false,
        });
        setIsInitialScrollDone(true);
      }, 50);
    }
  }, [media.length, isInitialScrollDone]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = event.nativeEvent.contentOffset.x;
    const totalContentWidth = media.length * SCREEN_WIDTH;

    if (media.length > 1) {
      if (x >= totalContentWidth * 2) {
        flatListRef.current?.scrollToOffset({ offset: x - totalContentWidth, animated: false });
      } else if (x <= totalContentWidth / 2 && x > 0) {
        flatListRef.current?.scrollToOffset({ offset: x + totalContentWidth, animated: false });
      }
    }

    const index = Math.round((x % totalContentWidth) / SCREEN_WIDTH) % media.length;
    if (index !== localActiveIndex) setLocalActiveIndex(index);
    onScroll(event);
  };

  return (
    <View style={{ width: SCREEN_WIDTH, height: carouselHeight }}>
      <FlatList
        ref={flatListRef}
        data={loopedMedia}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        decelerationRate="fast"
        snapToInterval={SCREEN_WIDTH}
        snapToAlignment="center"
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item, index) => `${item.url || index}-${index}`}
        initialNumToRender={3}
        windowSize={5}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
      />
      {media.length > 1 && (
        <View style={{
          position: 'absolute',
          bottom: 12,
          right: 58,
          backgroundColor: 'rgba(0,0,0,0.6)',
          paddingHorizontal: 10,
          paddingVertical: 4,
          borderRadius: 12,
          zIndex: 10,
        }}>
          <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>
            {localActiveIndex + 1}/{media.length}
          </Text>
        </View>
      )}
    </View>
  );
};

export default React.memo(PostMedia);
