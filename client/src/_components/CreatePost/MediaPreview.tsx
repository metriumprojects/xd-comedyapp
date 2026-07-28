import React, { useState, useEffect } from 'react';
import { View, Dimensions, ScrollView, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
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

// Video player component using expo-video
const PreviewVideoPlayer = React.memo(({ videoUrl, height }: { videoUrl: string; height: number }) => {
  const [isPlayingState, setIsPlayingState] = useState(true);
  const [isMuted, setIsMuted] = useState(false);

  const player = useVideoPlayer(videoUrl, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

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
          <Ionicons name="play" size={28} color="#ffffff" style={{ marginLeft: 3 }} />
        </View>
      )}

      {/* Clean Mute / Unmute Button top left */}
      <TouchableOpacity
        onPress={toggleMute}
        style={styles.muteButton}
        activeOpacity={0.7}
      >
        <Ionicons name={isMuted ? "volume-mute" : "volume-high"} size={18} color="#ffffff" />
      </TouchableOpacity>
    </TouchableOpacity>
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
        .catch(() => {});
    }

    return () => { active = false; };
  }, [uri, isVideo, providedThumbnail]);

  return (
    <View style={{ width: windowWidth, height, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
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
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Ionicons name="play" size={28} color="#ffffff" style={{ marginLeft: 3 }} />
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
          <Feather name="trash-2" size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
});

const MediaPreview: React.FC<MediaPreviewProps> = ({ uris, thumbnails, isVideo, height, onRemove }) => {
  if (uris.length === 0) return null;

  return (
    <View style={{ height, width: windowWidth, backgroundColor: '#000000' }}>
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
    shadowColor: '#000',
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
  }
});

export default MediaPreview;
