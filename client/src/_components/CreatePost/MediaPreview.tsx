import React, { useState, useEffect } from 'react';
import { View, Dimensions, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import { Feather, Ionicons } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as MediaLibrary from 'expo-media-library';

const { width: windowWidth } = Dimensions.get('window');

interface MediaPreviewProps {
  uris: string[];
  thumbnails: Record<string, string>;
  isVideo: (uri: string) => boolean;
  height: number;
  onRemove?: (index: number) => void;
}

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
  const [playableUri, setPlayableUri] = useState<string>(uri);
  const [thumbUri, setThumbUri] = useState<string | undefined>(providedThumbnail);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsPlaying(false);

    if (uri.startsWith('ph://')) {
      const assetId = uri.replace('ph://', '').split('/')[0];
      MediaLibrary.getAssetInfoAsync(assetId)
        .then((info) => {
          if (isMounted && info?.localUri) {
            setPlayableUri(info.localUri);
          }
        })
        .catch(() => {});
    } else {
      setPlayableUri(uri);
    }

    if (isVideo && !providedThumbnail) {
      VideoThumbnails.getThumbnailAsync(uri, { time: 500 })
        .then(({ uri: generated }) => {
          if (isMounted && generated) setThumbUri(generated);
        })
        .catch(() => {});
    }

    return () => { isMounted = false; };
  }, [uri, isVideo, providedThumbnail]);

  return (
    <View style={{ width: windowWidth, height, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
      {isVideo ? (
        isPlaying ? (
          <Video
            source={{ uri: playableUri }}
            style={{ width: windowWidth, height }}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            isLooping
            shouldPlay={true}
            isMuted={false}
          />
        ) : (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setIsPlaying(true)}
            style={{ width: windowWidth, height, justifyContent: 'center', alignItems: 'center' }}
          >
            <ExpoImage
              source={{ uri: thumbUri || playableUri || uri }}
              style={{ width: windowWidth, height }}
              contentFit="contain"
            />
            {/* Play Button Overlay */}
            <View style={styles.playButtonOverlay}>
              <Ionicons name="play" size={28} color="#ffffff" style={{ marginLeft: 3 }} />
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
  }
});

export default MediaPreview;
