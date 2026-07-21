import React from 'react';
import { TouchableOpacity, StyleSheet, Dimensions, View, Text } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import { getVideoThumbnailUrl } from '../../../lib/imageHelpers';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_SIZE = (SCREEN_WIDTH - 4) / 2; // 2 columns

interface ProfileGridItemProps {
  item: any;
  index: number;
  onPress: (item: any, index: number) => void;
  normalizeMediaUrl: (url: string) => string;
  isVideoUrl: (url: string) => boolean;
  DEFAULT_IMAGE_URL: string;
}

const ProfileGridItem = React.memo(({
  item,
  index,
  onPress,
  normalizeMediaUrl,
  isVideoUrl,
  DEFAULT_IMAGE_URL
}: ProfileGridItemProps) => {
  const mainMediaUrl = item.imageUrl || item.mediaUrl || item.media?.[0]?.url || (Array.isArray(item.mediaUrls) && item.mediaUrls[0]) || '';
  const isVideo = item.mediaType === 'video' || isVideoUrl(mainMediaUrl);
  const mediaUrl = item.thumbnailUrl || 
                   (isVideo ? getVideoThumbnailUrl(mainMediaUrl) : mainMediaUrl) || 
                   '';
  
  const normalizedUrl = normalizeMediaUrl(mediaUrl) || DEFAULT_IMAGE_URL;

  const views = item.viewsCount || 0;
  const formattedViews = views >= 1000 ? `${(views / 1000).toFixed(1)}K` : views;

  return (
    <TouchableOpacity
      style={styles.gridItem}
      onPress={() => onPress(item, index)}
      activeOpacity={0.8}
    >
      <ExpoImage
        source={{ uri: normalizedUrl }}
        style={styles.gridImage}
        contentFit="cover"
        transition={150}
        cachePolicy="memory-disk"
      />
      {item.visibility === 'Subscribers' && (
        <View style={{
          position: 'absolute',
          top: 8,
          right: 8,
          backgroundColor: 'rgba(0,0,0,0.65)',
          paddingHorizontal: 6,
          paddingVertical: 3,
          borderRadius: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 2,
        }}>
          <Feather name="lock" size={10} color="#FFD60A" />
          <Text style={{ color: '#FFD60A', fontSize: 9, fontWeight: '700' }}>PRO</Text>
        </View>
      )}
      {/* Play/Reactions Stat Overlays */}
      <View style={styles.thumbnailOverlayBottom}>
        <View style={styles.statLeft}>
          <Feather name="play" size={10} color="#fff" style={{ marginRight: 2 }} />
          <Text style={styles.statText}>{formattedViews}</Text>
        </View>
        <View style={styles.statRight}>
          <Text style={styles.statText}>😂 {item.laughCount || 0}</Text>
          <Text style={styles.statText}> 🍅 {item.tomatoCount || 0}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default ProfileGridItem;

const styles = StyleSheet.create({
  gridItem: {
    width: GRID_SIZE,
    height: GRID_SIZE,
    borderWidth: 1,
    borderColor: '#fff',
    position: 'relative',
    backgroundColor: '#fafafa',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailOverlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingVertical: 4,
    paddingHorizontal: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '600',
  },
});
