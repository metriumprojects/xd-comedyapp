import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, Dimensions, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator, PanResponder, GestureResponderEvent } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Image as ExpoImage } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

const { width: windowWidth } = Dimensions.get('window');

/**
 * Copies a native video URI (ph://, content://, assets-library://) to the
 * app cache directory so expo-video can access it.
 * Returns a file:// URI.
 */
import COLORS from '@/src/theme/colors';
async function copyVideoToCache(nativeUri: string): Promise<string> {
  const hash = nativeUri.replace(/[^a-zA-Z0-9]/g, '_').slice(-60);
  const dest = `${FileSystem.cacheDirectory}vidcache_${hash}.mp4`;

  const info = await FileSystem.getInfoAsync(dest);
  if (info.exists) return dest;

  // Try FileSystem.copyAsync first
  try {
    await FileSystem.copyAsync({ from: nativeUri, to: dest });
    const check = await FileSystem.getInfoAsync(dest);
    if (check.exists) return dest;
  } catch (_) {
    // fall through to MediaLibrary path
  }

  // Fallback: use MediaLibrary to get a localUri, then copy that
  try {
    const assetId = nativeUri.startsWith('ph://')
      ? nativeUri.replace('ph://', '').split('/')[0]
      : nativeUri;
    const assetInfo = await MediaLibrary.getAssetInfoAsync(assetId, { copyToLocalContainer: true } as any);
    const localUri = assetInfo?.localUri;
    if (localUri) {
      await FileSystem.copyAsync({ from: localUri, to: dest });
      const check2 = await FileSystem.getInfoAsync(dest);
      if (check2.exists) return dest;
      return localUri;
    }
  } catch (_) {
    // fall through
  }

  return nativeUri;
}

function isNativeUri(uri: string): boolean {
  return uri.startsWith('ph://') || uri.startsWith('assets-library://') || uri.startsWith('content://');
}

interface MediaPreviewProps {
  uris: string[];
  thumbnails: Record<string, string>;
  isVideo: (uri: string) => boolean;
  height: number;
  onRemove?: (index: number) => void;
}

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Video player component using expo-video
const PreviewVideoPlayer = React.memo(({ videoUrl, height }: { videoUrl: string; height: number }) => {
  const [isPlayingState, setIsPlayingState] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTimeStr, setCurrentTimeStr] = useState('0:00');
  const [durationStr, setDurationStr] = useState('0:00');
  const [isScrubbing, setIsScrubbing] = useState(false);

  const barWidthRef = useRef<number>(windowWidth - 110);
  const isScrubbingRef = useRef(false);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  const playerRef = useRef(player);
  playerRef.current = player;

  const seekToRatio = useCallback((ratio: number) => {
    const dur = playerRef.current.duration || 0;
    const clampedRatio = Math.min(1, Math.max(0, ratio));
    const targetTime = clampedRatio * dur;
    playerRef.current.currentTime = targetTime;
    setProgress(clampedRatio);
    setCurrentTimeStr(formatTime(targetTime));
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: (evt: GestureResponderEvent) => {
      isScrubbingRef.current = true;
      setIsScrubbing(true);
      const touchX = evt.nativeEvent.locationX;
      if (barWidthRef.current > 0) {
        seekToRatio(touchX / barWidthRef.current);
      }
    },
    onPanResponderMove: (evt: GestureResponderEvent) => {
      const touchX = evt.nativeEvent.locationX;
      if (barWidthRef.current > 0) {
        seekToRatio(touchX / barWidthRef.current);
      }
    },
    onPanResponderRelease: () => {
      isScrubbingRef.current = false;
      setIsScrubbing(false);
    },
    onPanResponderTerminate: () => {
      isScrubbingRef.current = false;
      setIsScrubbing(false);
    },
  }), [seekToRatio]);

  useEffect(() => {
    player.timeUpdateEventInterval = 0.05;
    const subscription = player.addListener('timeUpdate', (event) => {
      if (isScrubbingRef.current) return;
      const dur = player.duration || 1;
      if (dur > 0) {
        const current = event.currentTime || player.currentTime || 0;
        setProgress(Math.min(1, Math.max(0, current / dur)));
        setCurrentTimeStr(formatTime(current));
        setDurationStr(formatTime(dur));
      }
    });
    return () => subscription.remove();
  }, [player]);

  const togglePlayPause = () => {
    if (player.playing) {
      player.pause();
      setIsPlayingState(false);
    } else {
      player.play();
      setIsPlayingState(true);
    }
  };

  const toggleMute = () => {
    player.muted = !player.muted;
    setIsMuted(player.muted);
  };

  return (
    <View style={{ width: windowWidth, height, backgroundColor: COLORS.black }}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={togglePlayPause}
        style={{ width: windowWidth, height, justifyContent: 'center', alignItems: 'center' }}
      >
        <VideoView
          player={player}
          style={{ width: windowWidth, height }}
          contentFit="contain"
          nativeControls={false}
          allowsPictureInPicture={false}
        />

        {/* Clean Pause icon overlay when user pauses */}
        {!isPlayingState && (
          <View pointerEvents="none" style={styles.playButtonOverlay}>
            <Ionicons name="play" size={28} color={COLORS.textLight} style={{ marginLeft: 3 }} />
          </View>
        )}

        {/* Clean Mute / Unmute Button top left */}
        <TouchableOpacity
          onPress={toggleMute}
          style={styles.muteButton}
          activeOpacity={0.7}
        >
          <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={18} color={COLORS.textLight} />
        </TouchableOpacity>

        {/* Clean Bottom Video Length & Native Pan Progress Seeker Bar */}
        <View style={styles.seekerContainer}>
          <Text style={styles.timeText}>{currentTimeStr}</Text>
          <View
            {...panResponder.panHandlers}
            onLayout={(e) => { barWidthRef.current = e.nativeEvent.layout.width; }}
            style={styles.seekerTrack}
          >
            <View style={[styles.seekerTrackBg, isScrubbing && { height: 6, borderRadius: 3 }]} />
            <View style={[styles.seekerFill, { width: `${progress * 100}%` }, isScrubbing && { height: 6, borderRadius: 3 }]} />
            <View style={[
              styles.seekerKnob,
              { left: `${progress * 100}%` },
              isScrubbing && styles.seekerKnobActive
            ]} />
          </View>
          <Text style={styles.timeText}>{durationStr}</Text>
        </View>
      </TouchableOpacity>
    </View>
  );
});

const MediaPreviewItem = React.memo(({
  uri,
  index,
  height,
  isVideo,
  providedThumbnail,
  onRemove,
  urisLength
}: {
  uri: string;
  index: number;
  height: number;
  isVideo: boolean;
  providedThumbnail?: string;
  onRemove?: (index: number) => void;
  urisLength: number;
}) => {
  const [playableUri, setPlayableUri] = useState<string>('');
  const [thumbUri, setThumbUri] = useState<string | undefined>(providedThumbnail);
  const [isPlaying, setIsPlaying] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    let active = true;
    setIsPlaying(false);
    setPlayableUri('');

    (async () => {
      if (!isVideo) {
        if (active) setPlayableUri(uri);
        return;
      }

      if (isNativeUri(uri)) {
        if (active) setResolving(true);
        try {
          const cached = await copyVideoToCache(uri);
          if (active) {
            setPlayableUri(cached);
            setResolving(false);
          }
        } catch {
          if (active) {
            setPlayableUri(uri);
            setResolving(false);
          }
        }
      } else {
        if (active) {
          setPlayableUri(uri);
          setResolving(false);
        }
      }
    })();

    // Generate thumbnail
    if (isVideo && !providedThumbnail) {
      VideoThumbnails.getThumbnailAsync(uri, { time: 500 })
        .then(({ uri: generated }) => {
          if (active && generated) setThumbUri(generated);
        })
        .catch(() => { });
    }

    return () => { active = false; };
  }, [uri, isVideo, providedThumbnail]);

  return (
    <View style={{ width: windowWidth, height, backgroundColor: COLORS.black, justifyContent: 'center', alignItems: 'center' }}>
      {isVideo ? (
        isPlaying && playableUri && !isNativeUri(playableUri) ? (
          <PreviewVideoPlayer videoUrl={playableUri} height={height} />
        ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => {
              if (playableUri && !isNativeUri(playableUri) && !resolving) {
                setIsPlaying(true);
              }
            }}
            style={{ width: windowWidth, height, justifyContent: 'center', alignItems: 'center' }}
          >
            <ExpoImage
              source={{ uri: thumbUri || uri }}
              style={{ width: windowWidth, height }}
              contentFit="contain"
            />
            {/* Play Button or Loading Overlay */}
            <View style={styles.playButtonOverlay}>
              {resolving ? (
                <ActivityIndicator size="small" color={COLORS.textLight} />
              ) : (
                <Ionicons name="play" size={28} color={COLORS.textLight} style={{ marginLeft: 3 }} />
              )}
            </View>
          </TouchableOpacity>
        )
      ) : (
        <ExpoImage
          source={{ uri: thumbUri || uri }}
          style={{ width: windowWidth, height }}
          contentFit="contain"
        />
      )}

      {onRemove && urisLength > 1 && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => onRemove(index)}
        >
          <Feather name="trash-2" size={18} color={COLORS.textLight} />
        </TouchableOpacity>
      )}
    </View>
  );
});

const MediaPreview: React.FC<MediaPreviewProps> = ({ uris, thumbnails, isVideo, height, onRemove }) => {
  if (uris.length === 0) return null;

  return (
    <View style={{ height, width: windowWidth, backgroundColor: COLORS.black }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
        {uris.map((uri, index) => (
          <MediaPreviewItem
            key={`${uri}-${index}`}
            uri={uri}
            index={index}
            height={height}
            isVideo={isVideo(uri)}
            providedThumbnail={thumbnails[uri]}
            onRemove={onRemove}
            urisLength={uris.length}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  removeButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  playButtonOverlay: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,141,0,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4
  },
  muteButton: {
    position: 'absolute',
    top: 15,
    left: 15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  seekerContainer: {
    position: 'absolute',
    bottom: 12,
    left: 15,
    right: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    zIndex: 10,
  },
  timeText: {
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'center',
  },
  seekerTrack: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  seekerTrackBg: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  seekerFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
  },
  seekerKnob: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.background,
    marginLeft: -6,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 2,
    elevation: 3,
  },
  seekerKnobActive: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginLeft: -9,
    backgroundColor: COLORS.background,
  }
});

export default MediaPreview;
