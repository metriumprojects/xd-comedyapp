import React from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Dimensions, Platform } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import ProfileGridItem from '@/src/_components/profile/ProfileGridItem';
import { ProfileStatistics } from '@/src/_components/profile/ProfileStatistics';
import { ProfileSubscriptions } from '@/src/_components/profile/ProfileSubscriptions';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ProfileGridProps {
  posts: any[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  renderHeader: React.ReactElement;
  onPressPost: (item: any, index: number) => void;
  normalizeMediaUrl: (url: string) => string;
  isVideoUrl: (url: string) => boolean;
  DEFAULT_IMAGE_URL: string;
  insetsBottom: number;
  segmentTab: 'grid' | 'tagged' | 'heart' | 'star' | 'stats';
  currentUserId?: string | null;
  creatorPosts?: any[];
}

const ProfileGrid: React.FC<ProfileGridProps> = ({
  posts,
  loading,
  refreshing,
  onRefresh,
  renderHeader,
  onPressPost,
  normalizeMediaUrl,
  isVideoUrl,
  DEFAULT_IMAGE_URL,
  insetsBottom,
  segmentTab,
  currentUserId = null,
  creatorPosts = []
}) => {
  const numCols = segmentTab === 'grid' || segmentTab === 'tagged' || segmentTab === 'heart' ? 2 : 1;
  return (
    <FlashList
      key={`profile-list-${numCols}`}
      data={posts}
      keyExtractor={(item, index) => item.id || item._id || `post-${index}`}
      renderItem={({ item, index }) => (
        <ProfileGridItem
          item={item}
          index={index}
          onPress={onPressPost}
          normalizeMediaUrl={normalizeMediaUrl}
          isVideoUrl={isVideoUrl}
          DEFAULT_IMAGE_URL={DEFAULT_IMAGE_URL}
        />
      )}
      numColumns={numCols}
      estimatedItemSize={SCREEN_WIDTH / numCols}
      ListHeaderComponent={renderHeader}
      ListEmptyComponent={() => {
        if (loading) return null;
        if (segmentTab === 'stats') {
          return <ProfileStatistics creatorPosts={creatorPosts} currentUserId={currentUserId} />;
        }
        if (segmentTab === 'heart') {
          return (
            <View style={{ padding: 40, alignItems: 'center' }}>
              <Ionicons name="heart-outline" size={48} color="#ccc" />
              <Text style={{ marginTop: 10, color: '#999', fontWeight: '600' }}>No liked reels yet</Text>
              <Text style={{ marginTop: 4, color: '#bbb', fontSize: 12, textAlign: 'center' }}>
                Reels liked by this user will appear here.
              </Text>
            </View>
          );
        }
        if (segmentTab === 'star') {
          return <ProfileSubscriptions currentUserId={currentUserId} />;
        }
        return (
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Ionicons name="grid-outline" size={48} color="#ccc" />
            <Text style={{ marginTop: 10, color: '#999' }}>No posts yet</Text>
          </View>
        );
      }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingBottom: insetsBottom + 40 }}
      onRefresh={onRefresh}
      refreshing={refreshing}
      scrollEventThrottle={16}
      removeClippedSubviews={Platform.OS === 'android'}
    />
  );
};

export default ProfileGrid;
