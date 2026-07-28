import React, { useState, useEffect } from 'react';
import { View, Dimensions, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Image as ExpoImage } from 'expo-image';
import { Feather } from '@expo/vector-icons';
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
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setHasError(false);

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
      {isVideo && !hasError ? (
        <Video
          source={{ uri: playableUri }}
          style={{ width: windowWidth, height }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isLooping
          shouldPlay={true}
          isMuted={true}
          onError={() => setHasError(true)}
        />
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
  }
});

export default MediaPreview;
