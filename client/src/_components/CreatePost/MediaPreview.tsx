import React, { useState, useEffect } from 'react';
import { View, Image, Dimensions, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import * as VideoThumbnails from 'expo-video-thumbnails';

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
  const [posterUri, setPosterUri] = useState<string | undefined>(providedThumbnail);

  useEffect(() => {
    let isMounted = true;
    if (isVideo && !providedThumbnail) {
      VideoThumbnails.getThumbnailAsync(uri, { time: 500 })
        .then(({ uri: thumb }) => {
          if (isMounted && thumb) setPosterUri(thumb);
        })
        .catch(() => {});
    }
    return () => { isMounted = false; };
  }, [uri, isVideo, providedThumbnail]);

  return (
    <View style={{ width: windowWidth, height, backgroundColor: '#000000' }}>
      {isVideo ? (
        <Video
          source={{ uri }}
          style={{ flex: 1 }}
          useNativeControls
          resizeMode={ResizeMode.CONTAIN}
          isLooping
          shouldPlay={true}
          isMuted={true}
        />
      ) : (
        <Image
          source={{ uri }}
          style={{ flex: 1 }}
          resizeMode="cover"
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
